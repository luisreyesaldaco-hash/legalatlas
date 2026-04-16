// api/analizar.js
// SSE streaming — single country: QUÉ + CÓMO + JURIS | multi-country: Magnus cross-jurisdictional
import { motorQueRag, getSintesisPrompt } from '../lib/motor-que.js'
import { motorComoRag, promptSintesis }   from '../lib/motor-como.js'
import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const ai        = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export const config = { api: { bodyParser: true } }

function is503(err) {
  return err?.message?.includes('503') || err?.message?.includes('429') ||
    err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand') || err?.message?.includes('RESOURCE_EXHAUSTED')
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Gemini Flash (non-streaming) with Anthropic Haiku fallback ────────────────
async function geminiFlash(prompt, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await ai.models.generateContent({
        model:   'gemini-2.5-flash',
        contents: prompt,
        config:  { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.2, maxOutputTokens: 600 }
      })
      return resp.text
    } catch (err) {
      if (is503(err) && i < retries - 1) { await sleep(2000 * Math.pow(2, i)); continue }
      if (i === retries - 1) {
        console.warn('[geminiFlash] Gemini saturado, usando Claude Haiku:', err.message)
        const resp = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages:   [{ role: 'user', content: prompt + '\n\nResponde SOLO con JSON válido, sin markdown ni comentarios.' }]
        })
        return resp.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      throw err
    }
  }
}

// ── Query dimensional expander ────────────────────────────────────────────────
const IDIOMAS = {
  CZ: 'checo', FR: 'francés', DE: 'alemán',
  MX: 'español', ES: 'español', CH: 'alemán', MC: 'francés'
}

const EXPANDER_PROMPTS = {
  que: (texto, pais, idioma) =>
    `Eres un abogado experto en derecho de ${pais}. Analiza este caso y genera ` +
    `4 queries de búsqueda jurídica, una por dimensión:\n\n` +
    `1. DERECHOS — ¿qué derechos tiene la persona afectada?\n` +
    `2. OBLIGACIONES — ¿qué deben hacer las partes involucradas?\n` +
    `3. CONSECUENCIAS — ¿qué indemnizaciones, sanciones o reparaciones aplican?\n` +
    `4. PROCEDIMIENTO — ¿cómo se ejerce o defiende ese derecho?\n\n` +
    `CRÍTICO: Las queries deben estar EXCLUSIVAMENTE en ${idioma}. Ni una palabra en español o inglés.\n` +
    `Devuelve SOLO un array JSON sin explicación: ["query1","query2","query3","query4"]\n\n` +
    `Caso: "${texto}"`,

  como: (texto, pais, idioma) =>
    `Eres un abogado procesalista experto en derecho de ${pais}. Analiza este caso y genera ` +
    `4 queries sobre el proceso legal:\n\n` +
    `1. INICIO — ¿cómo se inicia el procedimiento? (demanda, denuncia, solicitud)\n` +
    `2. PLAZOS — ¿qué términos y plazos aplican?\n` +
    `3. AUTORIDAD — ¿ante qué órgano o tribunal se presenta?\n` +
    `4. RECURSOS — ¿qué recursos o medios de impugnación existen?\n\n` +
    `CRÍTICO: Las queries deben estar EXCLUSIVAMENTE en ${idioma}. Ni una palabra en español o inglés.\n` +
    `Devuelve SOLO un array JSON sin explicación: ["query1","query2","query3","query4"]\n\n` +
    `Caso: "${texto}"`,

  multi: (texto, pais, idioma) =>
    `Eres un abogado experto en derecho de ${pais}. Analiza este caso y genera ` +
    `4 queries de búsqueda jurídica:\n\n` +
    `1. DERECHOS — ¿qué derechos tiene la persona afectada según el derecho de ${pais}?\n` +
    `2. OBLIGACIONES — ¿qué deben hacer las partes según el derecho de ${pais}?\n` +
    `3. CONSECUENCIAS — ¿qué indemnizaciones o sanciones aplican en ${pais}?\n` +
    `4. PROCEDIMIENTO — ¿cómo se ejerce ese derecho en ${pais}?\n\n` +
    `CRÍTICO: Las queries deben estar EXCLUSIVAMENTE en ${idioma}. Ni una palabra en español o inglés.\n` +
    `Devuelve SOLO un array JSON sin explicación: ["query1","query2","query3","query4"]\n\n` +
    `Caso: "${texto}"`,

  juris: (texto, pais, idioma) =>
    `Eres un abogado constitucionalista experto en derecho de ${pais}. Analiza este caso ` +
    `e identifica los principios jurídicos en juego. Genera 4 queries para buscar jurisprudencia:\n\n` +
    `1. PRINCIPIO CENTRAL — ¿qué principio fundamental está en disputa?\n` +
    `   (ej: igualdad, proporcionalidad, debido proceso, non bis in idem)\n` +
    `2. DERECHO FUNDAMENTAL — ¿qué derecho fundamental podría estar vulnerado?\n` +
    `3. CONFLICTO DE NORMAS — ¿hay tensión entre dos normas o derechos?\n` +
    `4. PRECEDENTE — ¿qué tipo de caso análogo buscarías en jurisprudencia?\n\n` +
    `CRÍTICO: Las queries deben estar EXCLUSIVAMENTE en ${idioma}. Ni una palabra en español o inglés.\n` +
    `Devuelve SOLO un array JSON sin explicación: ["query1","query2","query3","query4"]\n\n` +
    `Caso: "${texto}"`
}

async function expandirQuery(texto, pais, modo) {
  const idioma = IDIOMAS[pais] || 'español'
  const prompt = EXPANDER_PROMPTS[modo](texto, pais, idioma)
  try {
    const response = await geminiFlash(prompt)
    const queries  = JSON.parse(response.replace(/```json|```/g, '').trim())
    if (Array.isArray(queries) && queries.length > 0) {
      console.log(`[expandirQuery ${modo}/${pais}]`, JSON.stringify(queries))
      return queries
    }
    return [texto]
  } catch (e) {
    console.error('[expandirQuery] parse error, fallback al texto original:', e.message)
    return [texto]
  }
}

// ── RAG deduplication helpers ─────────────────────────────────────────────────
// Deduplica artículos de múltiples motorQueRag results por art.id, conserva mayor similarity
function deduplicarArticulos(ragResults, limit = 20) {
  const artMap = new Map()
  ragResults
    .filter(r => r?.ok && r.articulos_por_nivel)
    .flatMap(r => Object.values(r.articulos_por_nivel).flat())
    .forEach(art => {
      if (!art?.id) return
      const prev = artMap.get(art.id)
      if (!prev || (art.similarity || 0) > (prev.similarity || 0)) artMap.set(art.id, art)
    })
  return Array.from(artMap.values())
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, limit)
}

function formatearArticulos(articulos) {
  if (!articulos.length) return ''
  return articulos
    .map(a => `[⚖️ Legislación] ${a.numero_articulo} — ${a.ley}${a.estado ? ` (${a.estado})` : ''}:\n${(a.texto_original || '').slice(0, 400)}`)
    .join('\n\n---\n\n')
}

// Para CÓMO: usa el resultado más completo y agrega capítulos únicos de los demás
function combinarResultadosComo(ragResults) {
  const buenos = ragResults.filter(r => r?.ok)
  if (!buenos.length) return null
  // Base: el que encontró más artículos
  const base = buenos.sort((a, b) => (b.total_articulos_usados || 0) - (a.total_articulos_usados || 0))[0]
  // Merge capítulos únicos
  const capMap = new Map()
  buenos.forEach(r => (r.capitulos_encontrados || []).forEach(c => {
    if (!capMap.has(c.capitulo)) capMap.set(c.capitulo, c)
  }))
  return { ...base, capitulos_encontrados: Array.from(capMap.values()) }
}

// ── Juris RAG ─────────────────────────────────────────────────────────────────
async function embedQueryJuris(text, retries = 4) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:               'models/gemini-embedding-001',
          content:             { parts: [{ text }] },
          taskType:            'RETRIEVAL_QUERY',
          outputDimensionality: 1536
        })
      }
    )
    if (res.ok) return (await res.json()).embedding.values
    const body = await res.text()
    if ((res.status === 503 || res.status === 429 || body.includes('UNAVAILABLE') || body.includes('high demand') || body.includes('RESOURCE_EXHAUSTED')) && i < retries - 1) {
      await sleep(2000 * Math.pow(2, i)); continue
    }
    throw new Error(`Embedding error ${res.status}: ${body}`)
  }
}

async function buscarJurisRag(query, pais, matchCount = 3) {
  try {
    const vector = await embedQueryJuris(query.slice(0, 800))
    const { data, error } = await supabase.rpc('buscar_jurisprudencia', {
      query_embedding: vector,
      pais_filter:     pais,
      match_count:     matchCount
    })
    if (error) { console.warn('[juris] RPC error:', error.message); return [] }
    return data || []
  } catch (err) {
    console.warn('[juris] buscarJurisRag falló:', err.message)
    return []
  }
}

// ── Synthesis helpers ─────────────────────────────────────────────────────────
function getSintesisConJurisPrompt(caso, articulosTexto, jurisArr) {
  const base = getSintesisPrompt(caso, articulosTexto)
  if (!jurisArr?.length) return base
  const jurisTexto = jurisArr
    .map(j => `${j.caso} (${j.tribunal}, ${j.fecha}): ${(j.ratio || '').slice(0, 300)}`)
    .join('\n\n')
  return `${base}\n\nRelevant case law found:\n${jurisTexto}\n\nIf any case law above is directly relevant, cite it by name and date in your analysis.`
}

async function streamWithRetry(ai, params, retries = 6) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContentStream(params)
    } catch (err) {
      if (is503(err) && i < retries - 1) { await sleep(2000 * Math.pow(2, i)); continue }
      throw err
    }
  }
}

function flagEmoji(iso) {
  try {
    return iso.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
  } catch { return iso }
}

function getMagnusPrompt(caso, paises, articulosEtiquetados) {
  const jurisdicciones = paises.map(p => `${flagEmoji(p)} UNDER ${p} LAW: [analysis citing specific articles from ${p}]`).join('\n')
  const flagLines      = paises.map(p => `${flagEmoji(p)} [3 bullet points with the most critical articles from ${p}]`).join('\n')
  return `ABSOLUTE RULE — NON-NEGOTIABLE: Detect the language of this exact string: "${caso.slice(0, 60)}"
If that string is in English → write your ENTIRE response in English only.
If in Spanish → respond entirely in Spanish.
If in Czech → respond entirely in Czech.
The articles below may be in Czech or Spanish — that is FINE. Cite them but explain them in the detected language.
DO NOT let the language of the articles influence the language of your response.
DO NOT announce what language you detected. DO NOT explain this rule. DO NOT write any preamble. START your response directly with the content.

You are Magnus, the multi-jurisdictional legal analysis system of Legal Atlas.

CASE: "${caso}"

ARTICLES FOUND BY JURISDICTION:
${articulosEtiquetados}

Structure your response with EXACTLY these two sections using these exact delimiters:

---EXECUTIVE_SUMMARY---
${flagLines}
⚖️ GOVERNING LAW: [1 line — which law governs and why]
📋 ACT NOW: [max 3 urgent actions the client must take]

---FULL_ANALYSIS---
Analyze the case under each jurisdiction separately, then identify conflicts and conclude with recommendations.

${jurisdicciones}
⚖️ JURISDICTIONAL CONFLICTS: [which law governs each aspect and why — omit if no real conflict]
📋 RECOMMENDATIONS: [concrete actions in each country]

Cite ONLY articles from the context above. No asterisks or markdown.`
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { caso, ley, estado_mx, incluir_juris } = body

  const paises = Array.isArray(body.paises) && body.paises.length
    ? body.paises
    : body.pais ? [body.pais] : ['MX']

  if (!caso || caso.trim().length < 20) {
    return res.status(400).json({ error: 'Describe tu caso con más detalle (mínimo 20 caracteres).' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`)
    if (res.flush) res.flush()
  }

  try {
    // ══════════════════════════════════════════
    // SINGLE COUNTRY — QUÉ + CÓMO + JURIS
    // ══════════════════════════════════════════
    if (paises.length === 1) {
      const pais = paises[0]

      // ── Paso 1: Expandir queries en paralelo para los 3 motores ──────────
      const [queQueries, comoQueries, jurisQueries] = await Promise.all([
        expandirQuery(caso, pais, 'que'),
        ley        ? expandirQuery(caso, pais, 'como')  : Promise.resolve([caso]),
        incluir_juris ? expandirQuery(caso, pais, 'juris') : Promise.resolve([caso])
      ])

      // ── Paso 2: RAG con queries expandidas (paralelo entre motores) ───────
      const [queSettled, comoSettled, jurisSettled] = await Promise.allSettled([
        Promise.all(queQueries.map(q => motorQueRag({ caso: q, pais, estado_mx }))),
        ley
          ? Promise.all(comoQueries.map(q => motorComoRag({ pregunta: q, pais, ley })))
          : Promise.resolve([{ ok: false, error: 'Sin ley seleccionada.' }]),
        incluir_juris
          ? Promise.all(jurisQueries.map(q => buscarJurisRag(q, pais)))
          : Promise.resolve([[]])
      ])

      // ── Paso 3: Deduplicar y consolidar resultados ────────────────────────
      // QUÉ — deduplicar artículos por id, top 20 por similarity
      const queRagList   = queSettled.status  === 'fulfilled' ? queSettled.value  : []
      const queArticulos = deduplicarArticulos(queRagList)
      const que = {
        ok:               queArticulos.length > 0,
        articulos_por_nivel: { null: queArticulos },
        articulosTexto:   formatearArticulos(queArticulos),
        total_encontrados: queArticulos.length,
        error:            queRagList.length === 0 ? (queSettled.reason?.message || 'RAG falló') : undefined
      }

      // CÓMO — usar resultado más completo, merge capítulos únicos
      const comoRagList = comoSettled.status === 'fulfilled' ? comoSettled.value : [{ ok: false }]
      const como        = combinarResultadosComo(comoRagList) ||
                          { ok: false, capitulos_encontrados: [], total_articulos_usados: 0, error: comoSettled.reason?.message }

      // JURIS — deduplicar por id o nombre de caso
      const jurisRawLists = jurisSettled.status === 'fulfilled' ? jurisSettled.value : [[]]
      const jurisMap      = new Map()
      jurisRawLists.flat().forEach(j => {
        const key = j.id || j.caso
        if (key && !jurisMap.has(key)) jurisMap.set(key, j)
      })
      const jurisArticles = Array.from(jurisMap.values()).slice(0, 5)

      // ── Enviar eventos de artículos ───────────────────────────────────────
      send({
        type:               'que_articles',
        ok:                 que.ok,
        articulos_por_nivel: que.articulos_por_nivel,
        total_encontrados:  que.total_encontrados
      })

      send({
        type:                   'como_articles',
        ok:                     como.ok || false,
        capitulos_encontrados:  como.capitulos_encontrados  || [],
        total_articulos_usados: como.total_articulos_usados || 0
      })

      if (incluir_juris) {
        send({
          type:      'juris_articles',
          ok:        jurisArticles.length > 0,
          articulos: jurisArticles
        })
      }

      // ── Síntesis QUÉ (streaming Gemini → fallback Haiku) ──────────────────
      if (que.ok && que.articulosTexto) {
        const quePrompt = incluir_juris && jurisArticles.length > 0
          ? getSintesisConJurisPrompt(caso, que.articulosTexto, jurisArticles)
          : getSintesisPrompt(caso, que.articulosTexto)
        try {
          const streamQue = await streamWithRetry(ai, {
            model:    'gemini-2.5-flash',
            contents: quePrompt,
            config:   { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.4, maxOutputTokens: 4000 }
          })
          for await (const chunk of streamQue) {
            if (chunk.text) send({ type: 'que_chunk', text: chunk.text })
          }
        } catch (err) {
          console.warn('[analizar] síntesis QUÉ Gemini falló, usando Claude Haiku:', err.message)
          try {
            const stream = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001', max_tokens: 4000, stream: true,
              messages: [{ role: 'user', content: quePrompt }]
            })
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                send({ type: 'que_chunk', text: event.delta.text })
              }
            }
          } catch (claudeErr) {
            console.error('[analizar] Claude QUÉ fallback también falló:', claudeErr.message)
          }
        }
      }
      send({ type: 'que_done' })

      // ── Síntesis CÓMO (streaming Gemini → fallback Haiku) ─────────────────
      if (como.ok && como.articulosTexto) {
        try {
          const streamComo = await streamWithRetry(ai, {
            model:    'gemini-2.5-flash',
            contents: promptSintesis(caso, como.capitulos_encontrados, como.articulosTexto),
            config:   { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.4, maxOutputTokens: 4000 }
          })
          for await (const chunk of streamComo) {
            if (chunk.text) send({ type: 'como_chunk', text: chunk.text })
          }
        } catch (err) {
          console.warn('[analizar] síntesis CÓMO Gemini falló, usando Claude Haiku:', err.message)
          try {
            const stream = await anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001', max_tokens: 4000, stream: true,
              messages: [{ role: 'user', content: promptSintesis(caso, como.capitulos_encontrados, como.articulosTexto) }]
            })
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                send({ type: 'como_chunk', text: event.delta.text })
              }
            }
          } catch (claudeErr) {
            console.error('[analizar] Claude CÓMO fallback también falló:', claudeErr.message)
          }
        }
      }
      send({ type: 'como_done' })

    // ══════════════════════════════════════════
    // MULTI-COUNTRY — Magnus cross-jurisdictional
    // ══════════════════════════════════════════
    } else {
      const ragResults = []

      // Secuencial por país para no saturar pgvector
      for (const p of paises) {
        try {
          // Expandir queries dimensionales para este país
          const queries = await expandirQuery(caso, p, 'multi')

          // RAG secuencial por query dentro del país (modo magnus = internal sequential)
          const countryRags = []
          for (const q of queries) {
            const r = await motorQueRag({ caso: q, pais: p, estado_mx: null, modo: 'magnus' })
            if (r.ok) countryRags.push(r)
          }

          // Deduplicar artículos del país, top 20
          const deduped       = deduplicarArticulos(countryRags, 20)
          const articulosTexto = formatearArticulos(deduped)
          const allQueries     = countryRags.flatMap(r => r.queries_generadas || [])

          ragResults.push({
            status: 'fulfilled',
            value:  {
              ok:                  deduped.length > 0,
              pais:                p,
              queries_generadas:   allQueries,
              articulos_por_nivel: { null: deduped },
              articulosTexto,
              total_encontrados:   deduped.length
            }
          })
        } catch (err) {
          ragResults.push({ status: 'rejected', reason: err })
        }
      }

      const resultados = paises.map((p, i) => ({
        pais: p,
        data: ragResults[i].status === 'fulfilled'
          ? ragResults[i].value
          : { ok: false, error: ragResults[i].reason?.message }
      }))

      // Debug diagnostics
      send({
        type:        'magnus_debug',
        diagnostics: resultados.map(r => ({
          pais:    r.pais,
          ok:      r.data.ok,
          total:   r.data.total_encontrados || 0,
          error:   r.data.error || null,
          queries: r.data.queries_generadas || []
        }))
      })

      // Artículos por país al frontend
      send({
        type:       'magnus_articles',
        resultados: resultados.map(r => ({
          pais:                r.pais,
          ok:                  r.data.ok || false,
          articulos_por_nivel: r.data.articulos_por_nivel || {},
          total_encontrados:   r.data.total_encontrados || 0
        }))
      })

      // Síntesis multi-jurisdiccional con Claude Sonnet
      const articulosEtiquetados = resultados
        .filter(r => r.data.ok && r.data.articulosTexto)
        .map(r => `=== ${flagEmoji(r.pais)} ${r.pais} ===\n${r.data.articulosTexto}`)
        .join('\n\n---\n\n')

      if (articulosEtiquetados) {
        try {
          const stream = await anthropic.messages.create({
            model:      'claude-sonnet-4-5',
            max_tokens: 8000,
            stream:     true,
            messages:   [{ role: 'user', content: getMagnusPrompt(caso, paises, articulosEtiquetados) }]
          })
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              send({ type: 'magnus_chunk', text: event.delta.text })
            }
          }
        } catch (err) {
          console.error('[Magnus Claude error]:', err.message, err.status, err.error)
          send({ type: 'error_gemini', message: `Error Claude: ${err.message || 'desconocido'}` })
        }
      }
      send({ type: 'magnus_done' })
    }

    send({ type: 'done' })
  } catch (err) {
    send({ type: 'error', error: err.message })
  } finally {
    res.end()
  }
}
