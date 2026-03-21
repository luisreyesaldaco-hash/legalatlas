import { buscarArticulos } from "./buscar.js";

export default async function handler(req, res) {
  try {
    const { pais, estado, tema, pregunta, fuente, modo } = req.body;
    const contextoLegal = await buscarArticulos(pregunta, estado, fuente || 'Código Civil');

    // 1. Normalizar número de artículo a solo dígitos ("ART. 2273.-" → "2273")
    const normalizarNum = (n) => (n || '').replace(/\D/g, '') || n

    const contextoNorm = (contextoLegal || []).map(r => ({
      ...r,
      numeroLimpio: normalizarNum(r.numero)
    }))

    const leyesTexto = contextoNorm.length
      ? contextoNorm
          .map(r => `Artículo ${r.numeroLimpio}: ${r.texto || "Contenido no disponible"}`)
          .join("\n\n")
      : "No se encontraron artículos específicos.";

    // 2. System prompt de Apolo
    const systemPrompt = `Eres APOLO, un asistente legal experto para la jurisdicción de ${estado.toUpperCase()}, ${pais.toUpperCase()}.
Tu objetivo es orientar a ciudadanos sobre sus derechos de forma clara, formal y tranquilizante.

FUENTE: ${fuente}

CONTEXTO LEGAL RECUPERADO:
${leyesTexto}

INSTRUCCIONES:
1. Explica de forma clara usando los artículos del contexto.
2. Cita siempre el número de artículo exacto cuando lo uses.
3. Si la información necesaria no está en los artículos proporcionados, dilo con claridad.
4. Nunca inventes leyes, artículos ni interpretaciones.
5. Responde EXCLUSIVAMENTE en formato JSON con esta estructura:
{
  "draftHtml": "Respuesta en HTML con párrafos y listas si aplica",
  "resumen": "Explicación breve de 2 líneas",
  "articulos": ["2273", "2325"],
  "confianza": "Alta | Media | Baja",
  "fuentes": ["Código Civil Art. 2273"]
}`;

    // 3. Llamada a Gemini Flash
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: pregunta }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 1500
          }
        })
      }
    )

    if (!geminiRes.ok) {
      const err = await geminiRes.text()
      throw new Error(`Gemini error: ${geminiRes.status} — ${err}`)
    }

    const geminiJson = await geminiRes.json()
    const raw = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) throw new Error('Gemini no devolvió contenido')
    let parsed
    try { parsed = JSON.parse(raw) }
    catch { throw new Error('Gemini devolvió JSON inválido: ' + raw.slice(0, 120)) }

    // 4. Verificación cruzada — solo artículos que realmente vienen del contexto
    const articulosValidos = []
    const fuentesValidas   = []
    const articulosBrutos  = Array.isArray(parsed.articulos) ? parsed.articulos : []

    articulosBrutos.forEach(num => {
      const numLimpio = normalizarNum(String(num))
      const coincide  = contextoNorm.find(a => a.numeroLimpio === numLimpio)
      if (coincide) {
        articulosValidos.push(numLimpio)
        fuentesValidas.push(`${fuente} Art. ${numLimpio}`)
      }
    })

    // 5. Ajuste de confianza final
    let confianzaFinal = 'Alta'
    if (articulosValidos.length === 0) confianzaFinal = 'Baja'
    else if (articulosValidos.length < articulosBrutos.length) confianzaFinal = 'Media'

    parsed.confianza = confianzaFinal
    parsed.articulos = articulosValidos
    parsed.fuentes   = fuentesValidas

    // 6. Respuesta al frontend
    res.status(200).json({
      respuesta: parsed,
      meta: {
        articulos_procesados: contextoLegal?.length || 0,
        modo_aplicado: modo
      }
    })

  } catch (error) {
    console.error("Error en asesoria.js:", error)
    res.status(500).json({
      error: "Error interno en el motor de IA",
      details: error.message
    })
  }
}
