import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)
const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

export async function buscarArticulos(pregunta, estado, ley = 'Código Civil', limite = 5) {
  // 1. Vectorizar la pregunta con Google text-embedding-004
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' })
  const result = await model.embedContent({
    content: { parts: [{ text: pregunta }] },
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: 1536
  })
  const queryVector = result.embedding.values

  // 2. Buscar en Supabase por similitud semántica
  const { data, error } = await supabase.rpc('buscar_articulos', {
    query_embedding: queryVector,
    filtro_estado:   estado,
    filtro_ley:      ley,
    match_count:     limite
  })
  if (error) throw new Error(`Supabase error: ${error.message}`)

  // 3. Formatear compatible con asesoria.js (r.numero y r.texto)
  return data.map(art => ({
    numero:    art.numero_articulo,
    texto:     art.texto_original,
    jerarquia: [art.libro, art.titulo, art.capitulo].filter(Boolean).join(' > '),
    id_unico:  art.id_unico
  }))
}
