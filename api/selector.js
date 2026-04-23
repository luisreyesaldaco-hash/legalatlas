// api/selector.js — Selector v2
// Flow: load compact markdown indices → Claude Sonnet with fetch_articulos tool →
// Claude reads indices, decides which articles to fetch → executes tool → synthesizes.
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { api: { bodyParser: true }, maxDuration: 180 }

const MAX_TOOL_LOOPS = 4

const TOOLS = [
  {
    name: 'fetch_articulos',
    description:
      'Fetch the full text of specific articles from one of the selected laws. ' +
      'Use this whenever you need to read the exact wording of articles referenced in the index. ' +
      'You may call this multiple times across different laws during the same turn.',
    input_schema: {
      type: 'object',
      properties: {
        pais: { type: 'string', description: 'ISO code of the country. Must be one of the selected laws (CZ, MX, FR, DE, ES, CH, MC).' },
        ley: { type: 'string', description: 'Law name, exactly as listed in the index header.' },
        estado: { type: 'string', description: 'Optional sub-jurisdiction (e.g. Mexican state). Omit or use "Nacional" for federal/national laws.' },
        rangos: {
          type: 'array',
          items: { type: 'string' },
          description: 'Article identifiers or ranges. Examples: "§ 2128", "2130", "2130-2135", "art. 49". Max 20 items per call.'
        }
      },
      required: ['pais', 'ley', 'rangos']
    }
  }
]

/* ── GET: listar leyes disponibles (solo las que tienen índice markdown) ─── */
async function handleGet(req, res) {
  try {
    const { data, error } = await supabase
      .from('leyes_indices')
      .select('pais, ley, estado, total_articulos, tokens_indice, tokens_completo')
      .order('pais', { ascending: true })
      .order('ley', { ascending: true })
    if (error) throw error
    return res.status(200).json({ leyes: data || [] })
  } catch (err) {
    console.error('GET /api/selector error:', err)
    return res.status(500).json({ error: err.message })
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function sseWrite(res, type, payload) {
  res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`)
}

function parseRangos(rangos) {
  const out = []
  for (const raw of rangos) {
    let s = String(raw || '').trim()
    // strip prefixes: §, §§, Art., art., čl., article, articulo
    s = s.replace(/^(§§|§|art\.?|articulo|artículo|čl\.?|article)\s*/i, '').trim()
    if (!s) continue
    if (s.includes('-') || s.includes('–')) {
      const [from, to] = s.split(/[-–]/).map(x => x.trim())
      if (from && to) out.push({ type: 'range', from, to })
    } else {
      out.push({ type: 'exact', val: s })
    }
  }
  return out
}

async function executeFetchArticulos({ pais, ley, estado, rangos }) {
  // Coerce rangos to array — Claude sometimes sends a string or JSON-string
  if (typeof rangos === 'string') {
    try {
      const maybe = JSON.parse(rangos)
      rangos = Array.isArray(maybe) ? maybe : [rangos]
    } catch { rangos = rangos.split(/[,;]\s*/).filter(Boolean) }
  }
  if (!pais || !ley || !Array.isArray(rangos) || !rangos.length) {
    throw new Error('fetch_articulos requires pais, ley, rangos (non-empty array).')
  }
  const parsed = parseRangos(rangos)
  if (!parsed.length) return []

  const orParts = []
  for (const p of parsed) {
    if (p.type === 'exact') {
      orParts.push(`numero_articulo.eq.${p.val}`)
      orParts.push(`numero_articulo.ilike.% ${p.val}`)
      orParts.push(`numero_articulo.ilike.§ ${p.val}`)
      orParts.push(`numero_articulo.ilike.Art. ${p.val}`)
    } else {
      orParts.push(`and(numero_articulo.gte.${p.from},numero_articulo.lte.${p.to})`)
    }
  }

  let q = supabase
    .from('articulos')
    .select('numero_articulo, texto_original, capitulo, titulo, orden_lectura')
    .eq('pais', pais)
    .eq('ley', ley)
    .not('texto_original', 'is', null)
    .order('orden_lectura', { ascending: true, nullsFirst: false })
    .limit(120)

  if (estado && estado !== 'Nacional') q = q.eq('estado', estado)
  if (orParts.length) q = q.or(orParts.join(','))

  const { data, error } = await q
  if (error) throw new Error(`Supabase: ${error.message}`)

  return (data || []).map(a => ({
    numero: a.numero_articulo,
    texto: a.texto_original,
    capitulo: a.capitulo || null,
    titulo: a.titulo || null
  }))
}

function buildSystemPrompt(indices) {
  const indicesText = indices.map(i => {
    const estadoSuffix = i.estado && i.estado !== 'Nacional' ? ` · ${i.estado}` : ''
    return `═══════════════════════════════════════\n${i.pais} · ${i.ley}${estadoSuffix} (${i.total_articulos} articles)\n═══════════════════════════════════════\n${i.indice_md}`
  }).join('\n\n')

  return `You are APOLO, Tesseum's senior legal research assistant. You help lawyers analyse questions across one or more laws simultaneously.

You have been given structured MARKDOWN INDICES of the following selected laws. Each index lists the hierarchy (parts → titles → chapters → articles) with brief descriptions, not full text.

${indicesText}

# How to work

1. Read the user's question carefully.
2. Scan the indices to identify which articles from which law(s) are likely relevant.
3. Use the \`fetch_articulos\` tool to retrieve the full text of those articles. You may call the tool multiple times (different laws, different rangos). Prefer fetching focused ranges (3-15 articles per call) over huge ranges.
4. Once you have the text you need, produce a comprehensive answer.

# Output rules

- Respond in the user's language (typically Czech or Spanish; match the pregunta).
- Cite every legal claim with the exact article number (use § for Czech, Art. for Spanish/French/German).
- For cross-border questions, structure the answer per jurisdiction, then compare.
- Never invent article content. If an article you expected isn't returned by the tool, say so explicitly.
- No markdown asterisks. Use plain prose with article citations inline.
- Be direct. No filler openings like "Great question".`
}

/* ── POST: answer across selected laws ───────────────────────────────────── */
async function handlePost(req, res) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  const { leyes, pregunta, historial } = body

  if (!Array.isArray(leyes) || leyes.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una ley.' })
  }
  if (!pregunta || typeof pregunta !== 'string' || pregunta.trim().length < 3) {
    return res.status(400).json({ error: 'Pregunta demasiado corta.' })
  }

  try {
    // 1. Load markdown indices for selected laws
    const orKeys = leyes.map(l => {
      const estado = (l.estado && l.estado !== 'Nacional') ? l.estado : 'Nacional'
      return `and(pais.eq.${l.pais},ley.eq.${l.ley},estado.eq.${estado})`
    })
    const { data: indices, error: idxErr } = await supabase
      .from('leyes_indices')
      .select('pais, ley, estado, indice_md, total_articulos, tokens_indice')
      .or(orKeys.join(','))

    if (idxErr) throw new Error(`Indices fetch: ${idxErr.message}`)
    if (!indices || indices.length === 0) {
      return res.status(404).json({ error: 'No se encontraron índices para las leyes seleccionadas.' })
    }

    // 2. Set up SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const systemPrompt = buildSystemPrompt(indices)
    const messages = [
      ...(Array.isArray(historial) ? historial : []),
      { role: 'user', content: pregunta }
    ]

    // 3. Agentic loop — tool_use until end_turn (or hard cap)
    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const isFinalAnswer = loop > 0 // heuristic: first turn usually tool_use
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages
      })

      // Relay text deltas to the client
      stream.on('text', (text) => {
        sseWrite(res, 'delta', { text })
      })

      const finalMessage = await stream.finalMessage()
      messages.push({ role: 'assistant', content: finalMessage.content })

      if (finalMessage.stop_reason !== 'tool_use') {
        sseWrite(res, 'done', {})
        return res.end()
      }

      // Execute tool calls emitted in this turn
      const toolResults = []
      for (const block of finalMessage.content) {
        if (block.type !== 'tool_use') continue
        const { pais, ley, estado, rangos } = block.input || {}
        const rangosArr = Array.isArray(rangos) ? rangos : (typeof rangos === 'string' ? [rangos] : [])
        const label = `${pais}/${ley}${estado && estado !== 'Nacional' ? ' · ' + estado : ''} · §§ ${rangosArr.join(', ')}`
        sseWrite(res, 'tool', { text: `Čtu ${label}` })
        try {
          const articulos = await executeFetchArticulos(block.input || {})
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: articulos.length
              ? JSON.stringify(articulos)
              : JSON.stringify({ articulos: [], note: 'No matching articles for the provided rangos.' })
          })
        } catch (err) {
          console.error('[selector] tool exec:', err.message)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: err.message }),
            is_error: true
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    }

    // Hit tool loop cap without an end_turn — synthesize a closing message
    sseWrite(res, 'delta', { text: '\n\n[Analýza zastavena: příliš mnoho iterací nástrojů]' })
    sseWrite(res, 'done', {})
    return res.end()

  } catch (err) {
    console.error('POST /api/selector v2 error:', err)
    if (res.headersSent) {
      sseWrite(res, 'error', { text: err.message })
      return res.end()
    }
    return res.status(500).json({ error: err.message })
  }
}

/* ── handler ─────────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  if (req.method === 'GET')  return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
