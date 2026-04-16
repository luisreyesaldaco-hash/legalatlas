// api/jurisprudencia.js
// Modo semántico: Gemini embedding + pgvector RPC
// Modo clásico:  Supabase query directa con filtros de texto
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export const config = { api: { bodyParser: true } }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function embedQuery(text, retries = 4) {
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
    if ((res.status === 503 || res.status === 429 ||
         body.includes('UNAVAILABLE') || body.includes('high demand') ||
         body.includes('RESOURCE_EXHAUSTED')) && i < retries - 1) {
      await sleep(2000 * Math.pow(2, i)); continue
    }
    throw new Error(`Embedding error ${res.status}: ${body}`)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { mode = 'semantic', pais = 'CZ' } = body

  try {
    // ── MODO SEMÁNTICO ────────────────────────────────────────────────────
    if (mode === 'semantic') {
      const { query, match_count = 15 } = body
      if (!query || query.trim().length < 3) {
        return res.status(400).json({ error: 'Dotaz je příliš krátký.' })
      }
      const vector = await embedQuery(query.slice(0, 800))
      const { data, error } = await supabase.rpc('buscar_jurisprudencia', {
        query_embedding: vector,
        pais_filter:     pais,
        match_count
      })
      if (error) { console.error('[juris semantic] RPC:', error.message); return res.status(500).json({ error: 'Chyba při vyhledávání.' }) }
      return res.json({ resultados: data || [], mode: 'semantic' })
    }

    // ── MODO CLÁSICO ──────────────────────────────────────────────────────
    if (mode === 'classic') {
      const { caso, tribunal, sala, anio_desde, anio_hasta, page = 0, per_page = 20 } = body
      const from = page * per_page
      const to   = from + per_page - 1

      let q = supabase
        .from('jurisprudencia')
        .select('id, caso, tribunal, fecha, ratio, articulos_citados, pais, url_original', { count: 'exact' })
        .eq('pais', pais)
        .order('fecha', { ascending: false })
        .range(from, to)

      if (caso  && caso.trim())    q = q.ilike('caso', `%${caso.trim()}%`)
      if (tribunal && tribunal.trim()) q = q.ilike('tribunal', `%${tribunal.trim()}%`)
      if (sala  && sala.trim())    q = q.ilike('tribunal', `%${sala.trim()}%`)
      if (anio_desde)              q = q.gte('fecha', `${anio_desde}-01-01`)
      if (anio_hasta)              q = q.lte('fecha', `${anio_hasta}-12-31`)

      const { data, error, count } = await q
      if (error) { console.error('[juris classic] query:', error.message); return res.status(500).json({ error: 'Chyba při vyhledávání.' }) }
      return res.json({ resultados: data || [], total: count || 0, page, per_page, mode: 'classic' })
    }

    return res.status(400).json({ error: 'Neznámý mode.' })

  } catch (err) {
    console.error('[jurisprudencia]', err.message)
    res.status(500).json({ error: 'Interní chyba.' })
  }
}
