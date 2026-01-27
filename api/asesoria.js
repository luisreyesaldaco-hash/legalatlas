import { AzureOpenAI } from "openai";

export default async function handler(req, res) {
  try {
    const { pais, estado, tema, pregunta, contextoLegal, fuente } = req.body;

    // 1. Cliente Azure usando variables de entorno
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: "2024-08-01-preview"
    });

    // 2. Convertimos artículos del motor (nuevo formato)
    const leyesTexto = contextoLegal?.length
      ? contextoLegal
          .map(r => `ARTÍCULO ${r.numero}: ${r.regla || "Regla no disponible"}`)
          .join("\n\n")
      : "No se encontraron artículos específicos en la base de datos.";

    // 3. Prompt optimizado
    const systemMessage = `
Eres APOLO, un asistente legal experto y preciso.

Jurisdicción: ${estado.toUpperCase()}, ${pais.toUpperCase()}
Fuente normativa: ${fuente}

CONTEXTO LEGAL (pasajes recuperados):
${leyesTexto}

INSTRUCCIONES CRÍTICAS:
1. Si el CONTEXTO LEGAL contiene artículos, DEBES citarlos con número exacto.
2. Si el usuario pide redactar un escrito, genera un borrador formal completo (encabezado, hechos, fundamentos, petitorio y firma simulada).
3. Devuelve SIEMPRE un JSON con esta estructura:

{
  "draftHtml": "...",
  "resumen": "...",
  "articulos": ["1947", "210", ...],
  "confianza": "Alta | Media | Baja",
  "fuentes": ["Código Civil Art. 1947", ...]
}

4. NO inventes artículos. Si no puedes verificar uno, elimínalo y marca confianza "Baja".
5. Si la confianza es Media o Baja, sugiere conectar con un abogado colaborador.
6. Responde siempre de forma profesional, directa y sin ambigüedades.
`;

    // 4. Llamada al modelo
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: pregunta }
      ],
      max_tokens: 1500,
      temperature: 0.2
    });

    let raw = completion.choices[0].message.content;

    // 5. Intentamos parsear JSON
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return res.status(200).json({
        error: "El modelo no devolvió JSON válido.",
        raw
      });
    }

    // 6. Verificación automática de artículos (nuevo formato)
    const articulosValidos = [];
    const fuentesValidas = [];

    if (parsed.articulos && Array.isArray(parsed.articulos)) {
      parsed.articulos.forEach(num => {
        const coincide = contextoLegal.find(a => a.numero == num);
        if (coincide) {
          articulosValidos.push(num);
          fuentesValidas.push(`${fuente} Art. ${num}`);
        }
      });
    }

    // 7. Cálculo de confianza
    let confianza = "Alta";
    if (articulosValidos.length === 0) confianza = "Baja";
    if (
      articulosValidos.length > 0 &&
      articulosValidos.length < (parsed.articulos?.length || 0)
    ) {
      confianza = "Media";
    }

    parsed.confianza = confianza;
    parsed.articulos = articulosValidos;
    parsed.fuentes = fuentesValidas;

    // 8. Respuesta final
    res.status(200).json({
      respuesta: parsed,
      datos_motor: {
        fuente,
        articulos_usados: contextoLegal?.length
      }
    });

  } catch (error) {
    console.error("Error en asesoria.js:", error);
    res.status(500).json({ error: error.message });
  }
}