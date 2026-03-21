import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase.rpc('obtener_materias')
    if (error) throw new Error(error.message)
    res.status(200).json(data || [])
  } catch (e) {
    console.error('Error en materias.js:', e)
    res.status(500).json({ error: e.message })
  }
}
