import { motorQue } from '../lib/motor-que.js'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  try {
    const result = await motorQue(body)
    if (!result.ok) return res.status(400).json(result)
    res.json(result)
  } catch (err) {
    console.error('[marco.js]', err)
    res.status(500).json({ error: 'Error al generar el marco. Intenta de nuevo.' })
  }
}
