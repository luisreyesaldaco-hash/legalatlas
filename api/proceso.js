import { motorComo } from '../lib/motor-como.js'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
  try {
    const result = await motorComo(body)
    if (!result.ok) return res.status(400).json(result)
    res.json(result)
  } catch (err) {
    console.error('[proceso.js]', err)
    res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 300) })
  }
}
