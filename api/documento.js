import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: true } }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' })

  const { session_id } = req.query
  if (!session_id) return res.status(400).json({ error: 'session_id requerido' })

  const { data, error } = await supabase
    .from('borradores_pago')
    .select('documento_html, tipo_documento, estado')
    .eq('stripe_session_id', session_id)
    .eq('estado', 'completado')
    .single()

  if (error || !data) {
    return res.status(404).json({ error: 'Documento no encontrado o pago no confirmado aún' })
  }

  res.status(200).json({ html: data.documento_html, tipo: data.tipo_documento })
}
