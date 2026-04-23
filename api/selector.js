// api/selector.js — Selector v2
// Flow: load compact markdown indices → Claude Sonnet with fetch_articulos tool →
// Claude reads indices, decides which articles to fetch → executes tool → synthesizes.
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = { api: { bodyParser: true }, maxDuration: 180 }

const MAX_TOOL_LOOPS = 8

const TOOLS = [
  {
    name: 'fetch_articulos',
    description:
      'Fetch the full text of specific articles by number/range from one of the selected laws. ' +
      'Use this when the index tells you the exact articles you want (e.g. "Arts. 2398-2496 Arrendamiento").',
    input_schema: {
      type: 'object',
      properties: {
        pais: { type: 'string', description: 'ISO code of the country. Must be one of the selected laws (CZ, MX, FR, DE, ES, CH, MC).' },
        ley: { type: 'string', description: 'Law name, EXACTLY as it appears in the index header between ═══ separators (e.g. "Código Civil", "Občanský zákoník"). Do NOT invent variant names.' },
        estado: { type: 'string', description: 'Sub-jurisdiction EXACTLY as in the index header (e.g. "Ciudad de México", "Nacional").' },
        rangos: {
          type: 'array',
          items: { type: 'string' },
          description: 'Article numbers or ranges. Examples: "2128", "2130-2135", "2398-2496". Numeric only; prefixes like §/Art. are stripped. Max 20 items per call.'
        }
      },
      required: ['pais', 'ley', 'rangos']
    }
  },
  {
    name: 'buscar_texto',
    description:
      'Full-text search within one of the selected laws. Use this as a FALLBACK when ' +
      'the index does not list the topic you need — for example, if the user asks about ' +
      '"arrendamiento" but the index for that law has no such section, search for the ' +
      'relevant keywords here. Returns up to 10 top-ranked articles.',
    input_schema: {
      type: 'object',
      properties: {
        pais: { type: 'string' },
        ley: { type: 'string', description: 'Law name exactly as in the index header.' },
        estado: { type: 'string' },
        consulta: { type: 'string', description: 'Spanish-language keywords — BE CONCRETE and USE 1-2 TERMS, not sentences. Examples: "arrendamiento", "despido injustificado", "patria potestad". Text search uses OR semantics across terms, so more words = broader match, not stricter.' },
        limite: { type: 'integer', description: 'Max articles to return (default 8, cap 15).' }
      },
      required: ['pais', 'ley', 'consulta']
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

function coerceRangos(rangos) {
  if (Array.isArray(rangos)) return rangos.map(r => String(r).replace(/^["']|["']$/g, '').trim()).filter(Boolean)
  if (typeof rangos === 'string') {
    try {
      const maybe = JSON.parse(rangos)
      if (Array.isArray(maybe)) return maybe.map(r => String(r).trim()).filter(Boolean)
    } catch {}
    // CSV fallback — strip quotes around each piece
    return rangos.split(/[,;]\s*/).map(r => r.replace(/^["']|["']$/g, '').trim()).filter(Boolean)
  }
  return []
}

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

async function executeFetchArticulos({ pais, ley, estado, rangos }) {
  rangos = coerceRangos(rangos)
  if (!pais || !ley || !rangos.length) {
    throw new Error('fetch_articulos requires pais, ley, rangos (non-empty array).')
  }
  const parsed = parseRangos(rangos)
  if (!parsed.length) return []

  // Build target set — numeric values to match against the number extracted
  // from numero_articulo (works regardless of "§ 2128", "Artículo 1000.-",
  // "ARTÍCULO 574.-", "Artículo 1949." etc.)
  const targetNums = new Set()
  const ranges = []
  for (const p of parsed) {
    if (p.type === 'exact') {
      const n = parseInt(p.val, 10)
      if (!isNaN(n)) targetNums.add(n)
    } else if (p.type === 'range') {
      const from = parseInt(p.from, 10)
      const to   = parseInt(p.to, 10)
      if (!isNaN(from) && !isNaN(to) && to >= from && to - from <= 400) {
        ranges.push([from, to])
      }
    }
  }
  if (!targetNums.size && !ranges.length) return []

  // Estado: include both accented and unaccented variants since articulos
  // sometimes stores "Estado de Mexico" while leyes_indices has "Estado de México".
  let q = supabase
    .from('articulos')
    .select('numero_articulo, texto_original, capitulo, titulo, orden_lectura, estado')
    .eq('pais', pais)
    .eq('ley', ley)
    .not('texto_original', 'is', null)
    .order('orden_lectura', { ascending: true, nullsFirst: false })
    .limit(10000)

  if (estado && estado !== 'Nacional') {
    const variants = [...new Set([estado, stripAccents(estado)])]
    q = q.in('estado', variants)
  }

  const { data, error } = await q
  if (error) throw new Error(`Supabase: ${error.message}`)

  // JS-side filter: extract first integer from numero_articulo, match against
  // targetNums ∪ ranges.
  const matched = (data || []).filter(a => {
    const m = /(\d+)/.exec(String(a.numero_articulo || ''))
    if (!m) return false
    const n = parseInt(m[1], 10)
    if (targetNums.has(n)) return true
    for (const [from, to] of ranges) { if (n >= from && n <= to) return true }
    return false
  }).slice(0, 200)

  return matched.map(a => ({
    numero: a.numero_articulo,
    texto: a.texto_original,
    capitulo: a.capitulo || null,
    titulo: a.titulo || null
  }))
}

async function executeBuscarTexto({ pais, ley, estado, consulta, limite }) {
  if (!pais || !ley || !consulta) {
    throw new Error('buscar_texto requires pais, ley, consulta.')
  }
  const lim = Math.min(Math.max(parseInt(limite, 10) || 8, 1), 15)

  let q = supabase
    .from('articulos')
    .select('numero_articulo, texto_original, capitulo, titulo')
    .eq('pais', pais)
    .eq('ley', ley)
    .not('texto_original', 'is', null)
    .textSearch('texto_original', consulta, { type: 'websearch', config: 'spanish' })
    .limit(lim * 3) // pull a bit extra before dedup

  if (estado && estado !== 'Nacional') {
    const variants = [...new Set([estado, stripAccents(estado)])]
    q = q.in('estado', variants)
  }

  const { data, error } = await q
  if (error) throw new Error(`Supabase: ${error.message}`)

  // Deduplicate by numero_articulo and cap
  const seen = new Set()
  const out = []
  for (const a of (data || [])) {
    if (seen.has(a.numero_articulo)) continue
    seen.add(a.numero_articulo)
    out.push({
      numero: a.numero_articulo,
      texto: a.texto_original,
      capitulo: a.capitulo || null,
      titulo: a.titulo || null
    })
    if (out.length >= lim) break
  }
  return out
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
2. **Strict: always use the law name and estado EXACTLY as they appear in the index header** (between the ═══ separators). Do not invent "Código Civil de Guanajuato" when the header just says "Código Civil · Guanajuato" — use \`ley: "Código Civil"\` and \`estado: "Guanajuato"\`.
3. Scan the indices to identify relevant articles. If the index lists ranges for the topic (e.g. "Arts. 2398-2496 Arrendamiento"), call \`fetch_articulos\` with those rangos.
4. **If the index does NOT list the topic** (some indices are incomplete — they may not have a dedicated arrendamiento / matrimonio / etc. section even though the law regulates it), use \`buscar_texto\` with keywords from the question to discover the relevant articles.
5. Tool calls should be efficient: 1-2 per law, batch rangos. Avoid re-querying the same range with slight variants.
6. As soon as you have relevant article text, **write the final answer**. Do not keep fetching speculatively.
7. If a tool returns 0 or very few articles, try \`buscar_texto\` as a fallback once, then synthesize with what you have. Never claim you "cannot respond" if you have at least some article text.

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
        const input = block.input || {}
        const { pais, ley, estado } = input
        let label
        try {
          let articulos
          if (block.name === 'buscar_texto') {
            label = `${pais}/${ley}${estado && estado !== 'Nacional' ? ' · ' + estado : ''} · «${input.consulta}»`
            articulos = await executeBuscarTexto(input)
          } else {
            const rangosArr = coerceRangos(input.rangos)
            label = `${pais}/${ley}${estado && estado !== 'Nacional' ? ' · ' + estado : ''} · ${rangosArr.join(', ')}`
            articulos = await executeFetchArticulos(input)
          }
          sseWrite(res, 'tool', { text: label })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: articulos.length
              ? JSON.stringify(articulos)
              : JSON.stringify({ articulos: [], note: 'No matching articles found. If using fetch_articulos, consider buscar_texto as fallback.' })
          })
        } catch (err) {
          console.error('[selector] tool exec:', err.message)
          sseWrite(res, 'tool', { text: label || `${pais}/${ley} · error` })
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
    // Compact but information-dense log — survives Vercel's log truncation per line
    console.error('[selector v2] FAIL:', err.message)
    if (err.stack) console.error('[selector v2] stack:', err.stack.split('\n').slice(0, 5).join(' | '))
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
