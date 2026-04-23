// lib/motor-como.js
// Motor del CÓMO — RAG a nivel capítulo + carga secuencial
// Fallback jerárquico: capitulo → titulo → error

import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const ai        = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function geminiConFallback(geminiParams, claudePrompt, { maxTokens = 2000, isJson = false } = {}) {
  try {
    const resp = await generateWithRetry(ai, geminiParams)
    return resp.text
  } catch (err) {
    console.warn('[motor-como] Gemini falló, usando Claude Haiku:', err.message)
    const prompt = isJson ? claudePrompt + '\n\nResponde SOLO con JSON válido, sin markdown.' : claudePrompt
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
    let text = resp.content[0].text.trim()
    if (isJson) text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    return text
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function is503(err) {
  return err?.message?.includes('503') || err?.message?.includes('429') ||
    err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand') || err?.message?.includes('RESOURCE_EXHAUSTED')
}

async function generateWithRetry(ai, params, retries = 6) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params)
    } catch (err) {
      if (is503(err) && i < retries - 1) { await sleep(2000 * Math.pow(2, i)); continue }
      throw err
    }
  }
}

async function rpcWithRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const r = await fn()
    if (!r.error) return r.data || []
    if (i < retries - 1) { await sleep(800 * (i + 1)); continue }
    console.error('[motor-como] RPC error:', JSON.stringify({ message: r.error.message, code: r.error.code, details: r.error.details, hint: r.error.hint }))
    return []
  }
}

async function embedQuery(text, retries = 6) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 768
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

function getExpansionPrompt(p, pais) {
  return `You are an expert legal consultant for ${pais} jurisdiction.
A lawyer asks: "${p}"
Generate exactly 4 specific legal search queries to find relevant chapters in the applicable law. Cover different procedural aspects: the triggering event, the main procedure, obligations of each party, and consequences.
Write the queries in the same language as the question.
Respond ONLY with JSON without markdown: {"queries": ["query 1", "query 2", "query 3", "query 4"]}`
}

export function promptSintesis(p, caps, arts) {
  return `ABSOLUTE RULE — NON-NEGOTIABLE: Detect the language of this exact string: "${p.slice(0, 60)}"
If that string is in English → write your ENTIRE response in English only.
If in Spanish → respond entirely in Spanish.
If in Czech → respond entirely in Czech.
The articles below may be in Czech or Spanish — that is FINE. Cite them but explain them in the detected language.
DO NOT let the language of the articles influence the language of your response.
DO NOT announce what language you detected. DO NOT explain this rule. DO NOT write any preamble. START your response directly with the content.

You are Apolo, the legal assistant of Tesseum.
A lawyer asks: "${p}"
Relevant chapters identified:
${caps.map(c => `- ${c.capitulo} (${c.num_articulos} articles)`).join('\n')}
Articles in sequential order:
${arts}
Walk through the applicable procedure as a senior colleague would explain it to a peer. Elaborate where the law is nuanced, be concise where it is straightforward. Cite articles in the order they apply — sequential logic is key. No asterisks or markdown.`
}

// Deduplica resultados del RPC usando `key` como campo de agrupación
function deduplicar(filas, campoKey) {
  const mapa = new Map()
  filas.forEach(fila => {
    const key = fila[campoKey]
    if (!key || key.trim() === '') return
    const prev = mapa.get(key)
    if (!prev || fila.relevancia > prev.relevancia) mapa.set(key, fila)
  })
  return Array.from(mapa.values())
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, 3)
}

export async function motorComoRag({ pregunta, ley, pais = 'MX' }) {
  if (!pregunta || pregunta.trim().length < 10) {
    return { ok: false, error: 'Describe el proceso con más detalle.' }
  }
  if (!ley) {
    return { ok: false, error: 'No se especificó ley para el motor del Cómo.' }
  }

  // ── Paso 1: Query expansion (gemini-2.0-flash — más rápido, menos saturado) ──
  const promptExp = getExpansionPrompt(pregunta, pais)
  const expansionText = await geminiConFallback(
    { model: 'gemini-2.5-flash', contents: promptExp,
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 2000 } },
    promptExp,
    { maxTokens: 600, isJson: true }
  )
  const queries = JSON.parse(expansionText).queries
  if (!Array.isArray(queries) || queries.length === 0) throw new Error('Respuesta de expansión inválida.')

  // ── Paso 2: Embeddings en paralelo ──
  const vectors = await Promise.all(queries.map(q => embedQuery(q)))

  // ── Paso 3: RAG con fallback jerárquico ──
  const busquedasCap = await Promise.all(
    vectors.map(v =>
      rpcWithRetry(() => supabase.rpc('buscar_capitulos_relevantes', {
        query_embedding: v,
        ley_filter:  ley,
        pais_filter: pais,
        match_count: 3
      }))
    )
  )

  let grupos = deduplicar(busquedasCap.flat(), 'capitulo')
  let campoFiltro = 'capitulo'

  if (grupos.length === 0) {
    const busquedasTit = await Promise.all(
      vectors.map(v =>
        rpcWithRetry(() => supabase.rpc('buscar_titulos_relevantes', {
          query_embedding: v,
          ley_filter:  ley,
          pais_filter: pais,
          match_count: 3
        }))
      )
    )

    const porTitulo = deduplicar(busquedasTit.flat(), 'titulo')

    if (porTitulo.length === 0) {
      const capFlat = busquedasCap.flat()
      const titFlat = busquedasTit.flat()
      const capKeys = capFlat.slice(0,2).map(r => '[' + r.capitulo + '|' + (r.titulo||'') + ']').join(' ')
      const titKeys = titFlat.slice(0,2).map(r => '[' + (r.titulo||'') + ']').join(' ')
      throw new Error('DBG cap=' + capFlat.length + ' tit=' + titFlat.length + ' capK=' + capKeys + ' titK=' + titKeys)
    }

    grupos = porTitulo.map(t => ({ ...t, capitulo: t.titulo }))
    campoFiltro = 'titulo'
  }

  // ── Paso 4: Cargar artículos en orden secuencial ──
  const nombresGrupos = grupos.map(g => g.capitulo)

  let { data: articulos, error: errorArts } = await supabase
    .from('articulos')
    .select('numero_articulo, texto_original, capitulo, titulo, orden_lectura')
    .eq('ley', ley)
    .eq('pais', pais)
    .in(campoFiltro, nombresGrupos)
    .not('texto_original', 'is', null)
    .order('orden_lectura', { ascending: true, nullsFirst: false })

  if (errorArts || !articulos?.length) {
    const { data: artsFallback } = await supabase
      .from('articulos')
      .select('numero_articulo, texto_original, capitulo, titulo')
      .eq('ley', ley)
      .eq('pais', pais)
      .in(campoFiltro, nombresGrupos)
      .not('texto_original', 'is', null)
      .limit(80)

    if (!artsFallback?.length) {
      return { ok: false, error: 'No se encontraron artículos para los grupos identificados.' }
    }
    articulos = artsFallback
  }

  // ── Paso 5: Formatear artículos agrupados en orden ──
  let articulosTexto = ''
  nombresGrupos.forEach(nombre => {
    const artsDelGrupo = articulos.filter(a =>
      campoFiltro === 'titulo' ? a.titulo === nombre : a.capitulo === nombre
    )
    if (artsDelGrupo.length > 0) {
      articulosTexto += `\n\n── ${nombre} ──\n`
      articulosTexto += artsDelGrupo
        .map(a => `${a.numero_articulo}: ${a.texto_original?.slice(0, 500)}`)
        .join('\n\n')
    }
  })

  return {
    ok: true,
    capitulos_encontrados: grupos,
    articulosTexto,
    total_articulos_usados: articulos.length,
    ley,
    pais,
    queries_generadas: queries,
  }
}

export async function motorComo({ pregunta, ley, pais = 'MX' }) {
  const rag = await motorComoRag({ pregunta, ley, pais })
  if (!rag.ok) return rag

  const sintesisPrompt = promptSintesis(pregunta, rag.capitulos_encontrados, rag.articulosTexto)
  const flujo = await geminiConFallback(
    { model: 'gemini-2.5-flash', contents: sintesisPrompt,
      config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.2, maxOutputTokens: 2000 } },
    sintesisPrompt,
    { maxTokens: 2000 }
  )

  return { ...rag, flujo }
}
