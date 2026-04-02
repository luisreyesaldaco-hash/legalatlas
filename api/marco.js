import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

export const config = { api: { bodyParser: true } }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

const PESOS       = { 1: 1.0, 2: 0.85, 3: 0.70 }
const TOP_X_NIVEL = { 1: 3,   2: 5,    3: 6    }
const NIVEL_LABEL = {
  1: '🏛️ Constitución',
  2: '⚖️ Ley Federal',
  3: '📖 Código Civil Estatal'
}

async function embedQuery(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: 1536
      })
    }
  )
  if (!res.ok) throw new Error(`Embedding error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.embedding.values
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { caso, estado_mx } = body

  if (!caso || caso.trim().length < 20) {
    return res.status(400).json({
      error: 'Describe tu caso con más detalle (mínimo 20 caracteres).'
    })
  }

  try {
    // ── PASO 1: Query Expansion ──
    const expansionResp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Eres un jurisconsulto mexicano experto.
Un abogado describe este caso: "${caso}"

Genera exactamente 5 consultas jurídicas MUY ESPECÍFICAS
para buscar en una base de datos legal mexicana.

IMPORTANTE:
- Usa términos jurídicos precisos del derecho mexicano
- Incluye nombres de documentos, trámites y figuras jurídicas
- Una query debe ser sobre el tipo de contrato/acto jurídico
- Una query sobre los derechos del afectado
- Una query sobre las obligaciones de la contraparte
- Una query sobre el procedimiento legal aplicable
- Una query sobre las consecuencias o sanciones

Responde SOLO con JSON sin markdown:
{"queries": ["query 1", "query 2", "query 3", "query 4", "query 5"]}`,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.1,
        maxOutputTokens: 500
      }
    })

    const { queries } = JSON.parse(expansionResp.text)

    // ── PASO 2: Embeddear las 5 queries en paralelo ──
    const vectors = await Promise.all(queries.map(q => embedQuery(q)))

    // ── PASO 3: Buscar en cada nivel jerárquico ──
    const resultadosPorNivel = await Promise.all(
      [1, 2, 3].map(async nivel => {
        const busquedas = await Promise.all(
          vectors.map(v =>
            supabase.rpc('buscar_marco_mx', {
              query_embedding: v,
              nivel_filter: nivel,
              estado_filter: nivel === 3 ? (estado_mx || null) : null,
              match_count: TOP_X_NIVEL[nivel]
            }).then(r => {
              if (r.error) {
                console.error(`[marco] RPC error nivel ${nivel}:`, r.error)
                return []
              }
              return r.data || []
            })
          )
        )

        // Deduplicar por id, conservar mayor similitud
        const mapa = new Map()
        busquedas.flat().forEach(art => {
          const prev = mapa.get(art.id)
          if (!prev || art.similarity > prev.similarity) mapa.set(art.id, art)
        })

        return Array.from(mapa.values())
          .map(art => ({
            ...art,
            score_final: art.similarity * PESOS[nivel],
            nivel,
            nivel_label: NIVEL_LABEL[nivel]
          }))
          .sort((a, b) => b.score_final - a.score_final)
          .slice(0, TOP_X_NIVEL[nivel])
      })
    )

    // ── PASO 4: Síntesis con Gemini ──
    const articulosTexto = resultadosPorNivel.flat()
      .map(a =>
        `[${a.nivel_label}] ${a.numero_articulo} — ${a.ley}` +
        (a.estado ? ` (${a.estado})` : '') +
        `:\n${(a.texto_original || '').slice(0, 400)}`
      ).join('\n\n---\n\n')

    const sintesissResp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Eres Apolo, asistente jurídico de Legal Atlas.
Un abogado mexicano describe este caso: "${caso}"

Artículos relevantes encontrados, ordenados por jerarquía:
${articulosTexto}

Construye el marco teórico jurídico completo:
1. Tipo de caso y ramas del derecho aplicables
2. Norma constitucional que rige el caso
3. Leyes federales aplicables
4. Artículos del Código Civil estatal relevantes
5. Conexión y jerarquía entre las normas
6. Conclusión práctica con artículos clave citados

REGLA CRÍTICA: SOLO cita artículos que aparezcan en la lista de artículos encontrados arriba. No inventes ni agregues artículos que no estén en esa lista.
Cita siempre artículo y ley exactos. Máximo 600 palabras.
Tono profesional jurídico en español.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.2,
        maxOutputTokens: 2000
      }
    })

    res.json({
      ok: true,
      queries_generadas: queries,
      articulos_por_nivel: {
        constitucion: resultadosPorNivel[0],
        federal: resultadosPorNivel[1],
        estatal: resultadosPorNivel[2]
      },
      total_encontrados: resultadosPorNivel.flat().length,
      sintesis: sintesissResp.text
    })

  } catch (err) {
    console.error('[marco.js]', err)
    res.status(500).json({ error: 'Error al generar el marco. Intenta de nuevo.' })
  }
}
