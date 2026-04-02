import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

export const config = { api: { bodyParser: true } }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

const PESOS = { 1: 1.0, 2: 0.85, 3: 0.70 }

const NIVELES_POR_PAIS = {
  MX: [1, 2, 3],
  CZ: [2]
}

const TOP_X_POR_PAIS = {
  MX: { 1: 3, 2: 5, 3: 6 },
  CZ: { 2: 10 }
}

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

function getExpansionPrompt(caso, pais) {
  if (pais === 'CZ') {
    return `Jsi český právní poradce. Klient popisuje tento případ: "${caso}". Vygeneruj přesně 5 konkrétních právních dotazů pro vyhledávání v české právní databázi. Každý dotaz musí pokrývat jiný právní aspekt případu. Odpověz POUZE v JSON bez markdown: {"queries": ["dotaz 1", "dotaz 2", "dotaz 3", "dotaz 4", "dotaz 5"]}`
  }
  return `Eres un jurisconsulto mexicano experto.
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
{"queries": ["query 1", "query 2", "query 3", "query 4", "query 5"]}`
}

function getSintesisPrompt(caso, articulosTexto, pais) {
  if (pais === 'CZ') {
    return `Jsi Apolo, právní asistent Legal Atlas.
Advokát popisuje tento případ: "${caso}"

Nalezené relevantní články:
${articulosTexto}

Analyzuj případ jako zkušený kolega právník:
1. O jaký typ případu se jedná
2. Co chrání klienta (jeho práva)
3. Jaká je nejpřímější cesta (hlavní žaloba/návrh)
4. Jaká jsou rizika
5. Praktický závěr s citací konkrétních článků

Tón: profesionální, jako kolega.
Pouze cituj články ze seznamu výše.
Maximálně 400 slov.`
  }
  return `Eres Apolo, asistente jurídico de Legal Atlas.
Un abogado te describe este caso: "${caso}"

Artículos encontrados ordenados por jerarquía:
${articulosTexto}

Analiza el caso como lo haría un colega jurista experimentado — no como un catálogo de artículos.

ESTRUCTURA OBLIGATORIA:

Primero: Una oración que identifique el núcleo del problema. Ejemplo: "Lo que tienes aquí es un problema de acreditación de propiedad, no de validez del contrato."

Luego analiza en este orden:
1. ¿Qué protege al cliente? (derechos ya ganados)
2. ¿Cuál es el camino más directo? (acción principal)
3. ¿Qué riesgos hay? (lo que podría complicarlo)
4. Conclusión práctica en 2-3 líneas

TONO:
- Habla como colega, no como enciclopedia
- Usa frases como "Lo que importa aquí es...", "El punto clave es...", "Cuidado con..."
- Cita artículos SOLO los que aparecen en la lista
- No inventes artículos que no estén en el contexto
- Máximo 400 palabras
- Sin asteriscos, sin markdown, texto limpio`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { caso, estado_mx, pais = 'MX' } = body

  if (!caso || caso.trim().length < 20) {
    return res.status(400).json({
      error: 'Describe tu caso con más detalle (mínimo 20 caracteres).'
    })
  }

  const niveles = NIVELES_POR_PAIS[pais] || NIVELES_POR_PAIS.MX
  const topX    = TOP_X_POR_PAIS[pais]  || TOP_X_POR_PAIS.MX

  try {
    // ── PASO 1: Query Expansion ──
    const expansionResp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: getExpansionPrompt(caso, pais),
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 500
      }
    })

    const rawExpansion = expansionResp.text?.trim()
    console.log('[marco] expansion raw:', rawExpansion?.slice(0, 200))

    let queries
    try {
      queries = JSON.parse(rawExpansion).queries
    } catch (e) {
      console.error('[marco] JSON.parse expansion falló:', rawExpansion)
      throw new Error('No se pudo generar las consultas jurídicas. Intenta de nuevo.')
    }

    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('Respuesta de expansión inválida.')
    }

    // ── PASO 2: Embeddear las 5 queries en paralelo ──
    const vectors = await Promise.all(queries.map(q => embedQuery(q)))

    // ── PASO 3: Buscar en cada nivel jerárquico ──
    const resultadosPorNivel = await Promise.all(
      niveles.map(async nivel => {
        const busquedas = await Promise.all(
          vectors.map(v =>
            supabase.rpc('buscar_marco_universal', {
              query_embedding: v,
              pais_filter:     pais,
              nivel_filter:    nivel,
              estado_filter:   nivel === 3 ? (estado_mx || null) : null,
              match_count:     topX[nivel]
            }).then(r => {
              if (r.error) {
                console.error(`[marco] RPC error pais=${pais} nivel=${nivel}:`, r.error)
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
            score_final: art.similarity * (PESOS[nivel] || 1.0),
            nivel,
            nivel_label: NIVEL_LABEL[nivel]
          }))
          .sort((a, b) => b.score_final - a.score_final)
          .slice(0, topX[nivel])
          .filter(art => art.similarity >= 0.65)
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
      contents: getSintesisPrompt(caso, articulosTexto, pais),
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.2,
        maxOutputTokens: 2000
      }
    })

    // Armar respuesta por nivel para el frontend
    const articulosPorNivel = {}
    niveles.forEach((nivel, i) => {
      articulosPorNivel[nivel] = resultadosPorNivel[i]
    })

    res.json({
      ok: true,
      pais,
      queries_generadas: queries,
      articulos_por_nivel: articulosPorNivel,
      total_encontrados: resultadosPorNivel.flat().length,
      sintesis: sintesissResp.text
    })

  } catch (err) {
    console.error('[marco.js]', err)
    res.status(500).json({ error: 'Error al generar el marco. Intenta de nuevo.' })
  }
}
