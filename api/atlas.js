// api/atlas.js
// Dialéctica hegeliana: Gemini expande tesis/antítesis → RAG paralelo → Gemini clasifica
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const ai        = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

export const config = { api: { bodyParser: true } }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function is503(err) {
  return err?.message?.includes('503') || err?.message?.includes('429') ||
    err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand') || err?.message?.includes('RESOURCE_EXHAUSTED')
}

async function generateWithRetry(params, retries = 6) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params)
    } catch (err) {
      if (is503(err) && i < retries - 1) { await sleep(2000 * Math.pow(2, i)); continue }
      throw err
    }
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
    if ((res.status === 503 || res.status === 429 || body.includes('UNAVAILABLE') || body.includes('RESOURCE_EXHAUSTED')) && i < retries - 1) {
      await sleep(2000 * Math.pow(2, i)); continue
    }
    throw new Error(`Embedding error ${res.status}: ${body}`)
  }
}

async function rpcSearch(vector, pais, estado_mx, count = 8) {
  const r = await supabase.rpc('buscar_marco_universal', {
    query_embedding: `[${vector.join(',')}]`,
    pais_filter:     pais,
    nivel_filter:    null,
    estado_filter:   estado_mx || null,
    match_count:     count
  })
  if (r.error) { console.error('[atlas] rpc error:', r.error.message, r.error.code); return [] }
  return r.data || []
}

function deriveNivel(ley = '') {
  const l = ley.toLowerCase()
  if (l.includes('constituc')) return 1
  if (l.includes('federal') || l.includes('código') || l.includes('ley general') || l.includes('zákoník') || l.includes('gesetzbuch')) return 2
  return 3
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { caso, pais = 'MX', estado_mx } = body

  if (!caso || caso.trim().length < 20) {
    return res.status(400).json({ error: 'Describe tu caso con más detalle (mínimo 20 caracteres).' })
  }

  try {
    // ══════════════════════════════════════════
    // FASE 1 — Expansor dialéctico (Gemini → Claude fallback)
    // ══════════════════════════════════════════
    const DIALECTIC_PROMPT = `Eres un expansor dialéctico jurídico.
Dado este caso: "${caso}"
Para el país: "${pais}"

Genera DOS listas de queries:

TESIS (5 queries que apoyan al cliente):
Buscan artículos que protegen su posición.

ANTÍTESIS (3 queries que contradicen):
Buscan excepciones, limitaciones, causales en contra. Ej: "excepciones a [derecho]", "causales que excluyen [acción]"

REGLA ADICIONAL: Si el caso menciona explícitamente un mecanismo de resolución de conflictos (mediace, rozhodčí řízení, smírčí řízení, mediación, arbitraje, conciliación), SIEMPRE incluye:
- Una query TESIS sobre los requisitos y validez de ese mecanismo
- Una query ANTÍTESIS sobre las limitaciones o causales de invalidez de ese mecanismo
Estas queries van dentro del conteo normal de 5 tesis + 3 antítesis.

Responde SOLO en JSON:
{
  "tesis": ["query1", "query2", "query3", "query4", "query5"],
  "antitesis": ["query1", "query2", "query3"]
}`

    let rawExpansion
    try {
      const geminiResp = await generateWithRetry({
        model: 'gemini-2.0-flash',
        contents: DIALECTIC_PROMPT,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 800
        }
      })
      rawExpansion = geminiResp.text.trim()
    } catch (geminiErr) {
      throw new Error('Expansión dialéctica falló: ' + geminiErr.message)
    }

    let tesisQueries, antitesisQueries
    try {
      const parsed = JSON.parse(rawExpansion)
      tesisQueries    = parsed.tesis    || []
      antitesisQueries = parsed.antitesis || []
    } catch (err) {
      throw new Error('Expansión dialéctica inválida: ' + err.message)
    }

    if (tesisQueries.length === 0 && antitesisQueries.length === 0) {
      throw new Error('Gemini no generó queries de búsqueda')
    }

    console.log(`[atlas] queries: t=${tesisQueries.length} a=${antitesisQueries.length} pais=${pais}`)

    // ══════════════════════════════════════════
    // FASE 2 — RAG paralelo (embeddings + búsqueda)
    // ══════════════════════════════════════════
    const allQueries  = [...tesisQueries, ...antitesisQueries]
    const queryTypes  = [
      ...tesisQueries.map(() => 'tesis'),
      ...antitesisQueries.map(() => 'antitesis')
    ]

    const vectors      = await Promise.all(allQueries.map(q => embedQuery(q)))
    const searchResults = await Promise.all(vectors.map(v => rpcSearch(v, pais, estado_mx)))

    // Deduplicar por id, conservando mayor similarity y tipo RAG de origen
    const mapa = new Map()
    searchResults.forEach((results, qi) => {
      const tipo = queryTypes[qi]
      results.forEach(art => {
        const prev = mapa.get(art.id)
        if (!prev || art.similarity > prev.similarity) {
          mapa.set(art.id, { ...art, _tipo_rag: tipo })
        }
      })
    })

    const top20 = Array.from(mapa.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20)

    console.log(`[atlas] rag: queries=${allQueries.length} hits=[${searchResults.map(r=>r.length).join(',')}] mapa=${mapa.size} top20=${top20.length}`)

    if (top20.length === 0) {
      return res.json({ tesis: [], antitesis: [], neutral: [], queries: { tesis: tesisQueries, antitesis: antitesisQueries } })
    }

    // ══════════════════════════════════════════
    // FASE 3 — Clasificador Gemini (fallback: _tipo_rag)
    // ══════════════════════════════════════════
    const articulosTexto = top20
      .map(a => `ID:${a.id} | ${a.numero_articulo} — ${a.ley}${a.estado ? ` (${a.estado})` : ''}:\n${(a.texto_original || '').slice(0, 300)}`)
      .join('\n\n---\n\n')

    const CLASSIFIER_PROMPT = `Caso: "${caso}"

Clasifica cada artículo como:
- "tesis": apoya la posición del cliente
- "antitesis": podría usarse en contra
- "neutral": relacionado pero no decisivo

Artículos:
${articulosTexto}

Responde SOLO en JSON array (sin markdown):
[{"id":"...","clasificacion":"tesis|antitesis|neutral","razon":"en 10 palabras máximo"}]`

    let clasificaciones = []
    try {
      const geminiClas = await generateWithRetry({
        model: 'gemini-2.0-flash',
        contents: CLASSIFIER_PROMPT,
        config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 2000 }
      })
      const raw = geminiClas.text.trim()
      const jsonStr = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['))
      clasificaciones = JSON.parse(jsonStr)
      console.log('[atlas] clasificación vía Gemini')
    } catch (err) {
      // Fallback: use the RAG query type (tesis/antitesis queries that found each article)
      console.warn('[atlas] clasificador falló, usando _tipo_rag como fallback:', err.message)
      clasificaciones = top20.map(a => ({ id: String(a.id), clasificacion: a._tipo_rag || 'neutral', razon: 'RAG signal' }))
    }

    const clasMap = new Map(clasificaciones.map(c => [String(c.id), c]))

    // Build flat classified articles
    const articulosFlat = { tesis: [], antitesis: [], neutral: [] }

    top20.forEach(art => {
      const clas = clasMap.get(String(art.id))
      const clasificacion = clas?.clasificacion || 'neutral'
      const bucket = articulosFlat[clasificacion] ? clasificacion : 'neutral'
      articulosFlat[bucket].push({
        id:               art.id,
        numero_articulo:  art.numero_articulo,
        ley:              art.ley,
        estado:           art.estado || null,
        similarity:       art.similarity,
        texto_original:   art.texto_original,
        razon:            clas?.razon || '',
        nivel_jerarquico: deriveNivel(art.ley),
        clasificacion:    bucket
      })
    })

    // Group by ley — same ley can appear in tesis AND antitesis independently
    function agruparPorLey(articulos, clasificacion) {
      const mapa = new Map()
      articulos.forEach(art => {
        if (!mapa.has(art.ley)) {
          mapa.set(art.ley, {
            ley:              art.ley,
            nivel_jerarquico: art.nivel_jerarquico,
            estado:           art.estado || null,
            articulos:        [],
            clasificacion
          })
        }
        mapa.get(art.ley).articulos.push(art)
      })
      return Array.from(mapa.values()).map(g => {
        const sum = g.articulos.reduce((acc, a) => acc + a.similarity, 0)
        return { ...g, score_promedio: sum / g.articulos.length, total_articulos: g.articulos.length }
      }).sort((a, b) => b.score_promedio - a.score_promedio)
    }

    const resultado = {
      tesis:    agruparPorLey(articulosFlat.tesis,    'tesis'),
      antitesis: agruparPorLey(articulosFlat.antitesis, 'antitesis'),
      neutral:   agruparPorLey(articulosFlat.neutral,   'neutral'),
      queries:  { tesis: tesisQueries, antitesis: antitesisQueries }
    }

    console.log(`[atlas] leyes: ${resultado.tesis.length}T + ${resultado.antitesis.length}A + ${resultado.neutral.length}N`)
    return res.json(resultado)

  } catch (err) {
    console.error('[atlas] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
