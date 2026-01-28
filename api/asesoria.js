import { AzureOpenAI } from "openai";

export default async function handler(req, res) {
  try {
    const { pais, estado, tema, pregunta, contextoLegal, fuente, modo } = req.body;

    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deployment: "gpt-4o-mini",
      apiVersion: "2024-08-01-preview"
    });

    // 1. Construcción del CONTEXTO LEGAL usando REGLA y NOMBRE_LEY
    const leyesTexto = contextoLegal?.length
      ? contextoLegal
          .map(r =>
            `${r.nombre_ley} — ARTÍCULO ${r.numero}:\n${r.texto || "Contenido no disponible"}`
          )
          .join("\n\n")
      : "No se encontraron artículos específicos.";

    // 2. Prompt para APOLO
    const systemMessage = `
Eres APOLO, un asistente legal experto para la jurisdicción de ${estado.toUpperCase()}, ${pais.toUpperCase()}.
Tu objetivo es analizar casos y redactar documentos basados estrictamente en la ley proporcionada.

MODO ACTUAL: ${modo}
FUENTES DISPONIBLES: ${fuente}

CONTEXTO LEGAL RECUPERADO:
${leyesTexto}

INSTRUCCIONES:
1. Usa exclusivamente los artículos proporcionados arriba.
2. Si el usuario pregunta (Modo Consulta), explica de forma clara usando los artículos citados.
3. Si el usuario pide redactar (Modo Redactar), genera un documento legal formal.
4. Responde EXCLUSIVAMENTE en formato JSON:
{
  "draftHtml": "...",
  "resumen": "...",
  "articulos": ["1911", "1899"],
  "confianza": "Alta | Media | Baja",
  "fuentes": ["Nombre de Ley Art. 1911"]
}
5. No cites artículos que no estén en el CONTEXTO LEGAL.
6. Si no hay artículos relevantes, responde con conocimientos generales y marca confianza "Baja".
`;

    // 3. Llamada al modelo
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: pregunta }
      ],
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    let raw = completion.choices[0].message.content;
    let parsed = JSON.parse(raw);

    // 4. Validación de artículos
    const articulosValidos = [];
    const fuentesValidas = [];

    if (parsed.articulos && Array.isArray(parsed.articulos)) {
      parsed.articulos.forEach(num => {
        const coincide = contextoLegal.find(a => a.numero == num);
        if (coincide) {
          articulosValidos.push(num);
          fuentesValidas.push(`${coincide.nombre_ley} Art. ${num}`);
        }
      });
    }

    // 5. Ajuste de confianza
    let confianzaFinal = "Alta";
    if (articulosValidos.length === 0) confianzaFinal = "Baja";
    else if (articulosValidos.length < parsed.articulos.length) confianzaFinal = "Media";

    parsed.confianza = confianzaFinal;
    parsed.articulos = articulosValidos;
    parsed.fuentes = fuentesValidas;

    // 6. Respuesta final
    res.status(200).json({
      respuesta: parsed,
      meta: {
        articulos_procesados: contextoLegal?.length || 0,
        modo_aplicado: modo
      }
    });

  } catch (error) {
    console.error("Error en asesoria.js:", error);
    res.status(500).json({
      error: "Error interno en el motor de IA",
      details: error.message
    });
  }
}