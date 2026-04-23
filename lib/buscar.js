import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

async function embedWithRetry(text, retries = 6) {
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
    const retryable = res.status === 503 || res.status === 429 ||
      body.includes('UNAVAILABLE') || body.includes('high demand') || body.includes('RESOURCE_EXHAUSTED')
    if (retryable && i < retries - 1) {
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i))); continue
    }
    throw new Error(`Gemini embedding error: ${res.status} — ${body}`)
  }
}

export async function buscarArticulosPorPais(pregunta, pais, limite = 10, estado = null) {
  if (!pregunta || !pregunta.trim()) return []
  const queryVector = await embedWithRetry(pregunta.trim())

  const { data, error } = await supabase.rpc('buscar_marco_universal', {
    query_embedding: queryVector,
    pais_filter:     pais,
    nivel_filter:    null,
    estado_filter:   estado || null,
    match_count:     limite
  })
  if (error) {
    console.warn('buscar_marco_universal error (returning empty):', error.message)
    return []
  }

  return (data || []).map(art => ({
    numero:    art.numero_articulo,
    texto:     art.texto_original,
    jerarquia: [art.titulo, art.capitulo].filter(Boolean).join(' > '),
    id_unico:  art.id
  }))
}

export async function buscarArticulos(pregunta, estado, ley = 'Código Civil', limite = 10) {
  // 1. Vectorizar la pregunta con gemini-embedding-001
  const embedRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: pregunta }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: 768
      })
    }
  )
  if (!embedRes.ok) {
    const err = await embedRes.text()
    throw new Error(`Gemini embedding error: ${embedRes.status} — ${err}`)
  }
  const embedJson = await embedRes.json()
  const queryVector = embedJson.embedding.values

  // 2. Buscar en Supabase por similitud semántica (pgvector)
  const { data, error } = await supabase.rpc('buscar_articulos', {
    query_embedding: queryVector,
    filtro_estado:   estado || 'Federal',
    filtro_ley:      ley,
    match_count:     limite
  })
  if (error) throw new Error(`Supabase error: ${error.message}`)

  // 3. Formatear para asesoria.js
  return (data || []).map(art => ({
    numero:    art.numero_articulo,
    texto:     art.texto_original,
    jerarquia: [art.libro, art.titulo, art.capitulo].filter(Boolean).join(' > '),
    id_unico:  art.id_unico
  }))
}
