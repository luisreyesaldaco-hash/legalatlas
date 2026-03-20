import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export async function buscarArticulos(pregunta, estado, ley = 'Código Civil', limite = 5) {
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
        outputDimensionality: 1536
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
    filtro_estado:   estado,
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
