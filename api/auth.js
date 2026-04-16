import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_KEY)

export default async function handler(req, res) {
  const { action, code } = req.query

  // ── callback (after Google OAuth redirect) ───────────────────────────────
  if (action === 'callback') {
    if (!code) return res.redirect(302, '/cuenta.html?error=no_code')

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data?.session) {
      console.error('[auth.js] exchangeCodeForSession error:', error)
      return res.redirect(302, '/cuenta.html?error=auth_failed')
    }

    const session = data.session
    const user    = session.user

    // Upsert lawyer record
    await supabase.from('abogados').upsert(
      {
        email:      user.email,
        nombre:     user.user_metadata?.full_name || '',
        foto_url:   user.user_metadata?.avatar_url || '',
        flag_activo: true
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )

    // Pass tokens via query params so cuenta.html can restore the session client-side
    const params = new URLSearchParams({
      access_token:  session.access_token,
      refresh_token: session.refresh_token,
      login: 'ok'
    })
    return res.redirect(302, `/cuenta.html?${params.toString()}`)
  }

  // ── logout ───────────────────────────────────────────────────────────────
  if (action === 'logout') {
    return res.redirect(302, '/cuenta.html?logout=ok')
  }

  return res.status(400).json({ error: 'action debe ser callback | logout' })
}
