// api/selector.js
// Selector: el usuario elige 1-2 leyes completas y hace una pregunta.
// El LLM lee el texto completo antes de responder.
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { api: { bodyParser: true }, maxDuration: 120 }

/* ── helpers ─────────────────────────────────────────────────────── */

async function fetchAllArticles(ley, pais) {
  const PAGE = 1000
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('articulos')
      .select('texto_original, numero_articulo')
      .eq('ley', ley)
      .eq('pais', pais)
      .order('orden_lectura', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

function buildLawText(articles, ley, pais) {
  const header = `\n══════════════════════════════════════\n${ley} (${pais})\n══════════════════════════════════════\n`
  const body = articles
    .map(a => `Art. ${a.numero_articulo ?? '?'}\n${a.texto_original}`)
    .join('\n\n')
  return header + body
}

/* ── GET: listar leyes disponibles ───────────────────────────────── */

async function handleGet(req, res) {
  try {
    const PAGE = 1000
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('articulos')
        .select('pais, ley')
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }

    // Aggregate in JS — Supabase JS client doesn't support GROUP BY natively
    const map = {}
    for (const row of all) {
      const key = `${row.pais}|||${row.ley}`
      map[key] = (map[key] || 0) + 1
    }

    const result = Object.entries(map)
      .map(([key, count]) => {
        const [pais, ley] = key.split('|||')
        return { pais, ley, total_articulos: count }
      })
      .sort((a, b) => a.pais.localeCompare(b.pais) || a.ley.localeCompare(b.ley))

    return res.status(200).json(result)
  } catch (err) {
    console.error('GET /api/selector error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/* ── POST: responder pregunta sobre leyes seleccionadas ──────────── */

async function handlePost(req, res) {
  const { leyes, pregunta } = req.body || {}

  if (!leyes || !Array.isArray(leyes) || leyes.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una ley en el array "leyes".' })
  }
  if (!pregunta || typeof pregunta !== 'string') {
    return res.status(400).json({ error: 'Se requiere el campo "pregunta".' })
  }

  try {
    // 1. Fetch all articles for each selected law
    const lawTexts = []
    for (const { ley, pais } of leyes) {
      if (!ley || !pais) {
        return res.status(400).json({ error: 'Cada ley debe tener "ley" y "pais".' })
      }
      const articles = await fetchAllArticles(ley, pais)
      if (articles.length === 0) {
        return res.status(404).json({ error: `No se encontraron articulos para "${ley}" (${pais}).` })
      }
      lawTexts.push(buildLawText(articles, ley, pais))
    }

    const fullText = lawTexts.join('\n')

    // 2. Estimate tokens
    const estimatedTokens = Math.ceil(fullText.length / 4)
    if (estimatedTokens > 200000) {
      return res.status(413).json({ error: 'Token limit exceeded', tokens: estimatedTokens })
    }

    // 3. Build system prompt
    const systemPrompt =
      'Eres un abogado experto con acceso al texto completo de las siguientes leyes. ' +
      'Responde citando el articulo exacto (§ o Art.) cuando sea relevante. ' +
      'Responde en el idioma del usuario.\n\n' +
      fullText

    // 4. Stream via Anthropic SDK
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: pregunta }]
    })

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
    })

    stream.on('error', (err) => {
      console.error('Stream error:', err)
      res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`)
      res.end()
    })

    stream.on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
    })
  } catch (err) {
    console.error('POST /api/selector error:', err)
    // If headers already sent, try to push error via SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`)
      return res.end()
    }
    return res.status(500).json({ error: err.message })
  }
}

/* ── handler ─────────────────────────────────────────────────────── */

export default async function handler(req, res) {
  if (req.method === 'GET')  return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
