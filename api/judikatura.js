// api/judikatura.js
// Semantic search over court decisions (jurisprudence)
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export const config = { api: { bodyParser: true } }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function embedQuery(text, retries = 4) {
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
          outputDimensionality: 1536
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { caso, pais = 'CZ', tribunal } = body

  if (!caso || caso.trim().length < 10) {
    return res.status(400).json({ error: 'Describe el caso con más detalle (mínimo 10 caracteres).' })
  }

  try {
    const vector = await embedQuery(caso)

    const { data, error } = await supabase.rpc('buscar_jurisprudencia', {
      query_embedding: vector,
      pais_filter: pais,
      match_count: 12
    })

    if (error) {
      console.error('[judikatura] rpc error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    let resultados = data || []

    if (tribunal) {
      resultados = resultados.filter(r => r.tribunal && r.tribunal.includes(tribunal))
    }

    return res.json({ resultados })

  } catch (err) {
    console.error('[judikatura] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
