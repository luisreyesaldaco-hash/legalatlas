export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { pregunta } = req.body;
  if (!pregunta) return res.status(400).json({ error: 'Falta pregunta' });

  const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key no configurada' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: pregunta }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
      })
    });

    const data = await response.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    res.status(200).json({ respuesta: texto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
