import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const STAFF_KEY = process.env.STAFF_KEY || 'apolo2026'


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Staff-Key')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.headers['x-staff-key'] !== STAFF_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { tipo } = req.query

  try {
    // ── stats ────────────────────────────────────────────────────────────────
    if (tipo === 'stats') {
      const [
        { count: articulos },
        { data: pData },
        { data: lData },
        { count: usuarios }
      ] = await Promise.all([
        supabase.from('articulos').select('*', { count: 'exact', head: true }),
        supabase.from('articulos').select('pais'),
        supabase.from('articulos').select('ley'),
        supabase.from('abogados').select('*', { count: 'exact', head: true })
      ])
      const paises = new Set((pData || []).map(r => r.pais)).size
      const leyes  = new Set((lData || []).map(r => r.ley)).size
      return res.status(200).json({ ok: true, articulos, paises, leyes, usuarios })
    }

    // ── corpus ───────────────────────────────────────────────────────────────
    if (tipo === 'corpus') {
      const { data, error } = await supabase.rpc('corpus_por_pais_v2')
      if (error) throw error
      return res.status(200).json({ ok: true, rows: data || [] })
    }

    // ── usuarios ─────────────────────────────────────────────────────────────
    if (tipo === 'usuarios') {
      const { data, error } = await supabase
        .from('abogados')
        .select('id,nombre,email,pais,is_pro,subscription_status,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return res.status(200).json({ ok: true, usuarios: data || [] })
    }

    // ── logins de hoy (auth.users) ───────────────────────────────────────────
    if (tipo === 'logins') {
      const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      if (error) throw error
      const since = new Date(Date.now() - 86_400_000).toISOString()
      const logins = (users || [])
        .filter(u => u.last_sign_in_at && u.last_sign_in_at >= since)
        .sort((a, b) => new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at))
        .map(u => ({
          email:           u.email,
          nombre:          u.user_metadata?.full_name || u.user_metadata?.name || '',
          avatar:          u.user_metadata?.avatar_url || '',
          last_sign_in_at: u.last_sign_in_at,
          created_at:      u.created_at,
          es_nuevo:        !!(u.created_at && u.created_at >= since)
        }))
      return res.status(200).json({ ok: true, logins, total: logins.length })
    }

    // ── raw: todas las combinaciones agregadas (para pivot client-side) ──────
    if (tipo === 'raw') {
      const { data, error } = await supabase.rpc('articulos_pivot_raw')
      if (error) throw error
      return res.status(200).json({ ok: true, rows: data || [] })
    }

    // ── pivot dinámico ───────────────────────────────────────────────────────
    if (tipo === 'pivot') {
      // RPC returns: { pais, materia, nivel, leyes, articulos }
      const DIMS = ['pais', 'materia', 'nivel']
      const rowDim = DIMS.includes(req.query.rows) ? req.query.rows : 'pais'
      const colDim = DIMS.includes(req.query.cols) ? req.query.cols : 'materia'
      const val    = req.query.val === 'leyes' ? 'leyes' : 'articulos'

      const { data, error: pivotErr } = await supabase.rpc('articulos_pivot_raw')
      if (pivotErr) throw pivotErr

      // Sum pre-aggregated values into matrix
      const matrix = {}
      const colSet = new Set()
      for (const r of (data || [])) {
        const rv = r[rowDim] || '—'
        const cv = r[colDim] || '—'
        colSet.add(cv)
        if (!matrix[rv]) matrix[rv] = {}
        matrix[rv][cv] = (matrix[rv][cv] || 0) + (r[val] || 0)
      }

      return res.status(200).json({
        ok: true,
        rows: Object.keys(matrix).sort(),
        cols: [...colSet].sort(),
        matrix,
        val
      })
    }

    return res.status(400).json({ error: 'tipo debe ser stats | corpus | usuarios | logins | pivot' })

  } catch (err) {
    console.error('[staff.js] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
