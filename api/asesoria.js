import { AzureOpenAI } from "openai";

export default async function handler(req, res) {
  try {
    const { pais, estado, tema, pregunta, contextoLegal, fuente, modo } = req.body;

    // 1. Cliente Azure (Uso de variables de entorno para evitar bloqueos de GitHub)
    // NOTA: Configura estas variables en tu panel de Vercel/Hosting
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://legalatlas-openai-sweden.openai.azure.com/",
      apiKey: process.env.AZURE_OPENAI_API_KEY, 
      deployment: "gpt-4o-mini",
      apiVersion: "2024-08-01-preview"
    });

    // 2. Convertimos artículos del motor (Asegúrate de usar .texto y .numero)
const leyesTexto = contextoLegal?.length
  ? contextoLegal
      .map(r => `ARTÍCULO ${r.numero}: ${r.texto || "Contenido no disponible"}`)
      .join("\n\n")
  : "No se encontraron artículos específicos.";


    // 3. Prompt optimizado para APOLO
    const systemMessage = `
Eres APOLO, un asistente legal experto para la jurisdicción de ${estado.toUpperCase()}, ${pais.toUpperCase()}.
Tu objetivo es analizar casos y redactar documentos basados estrictamente en la ley proporcionada.

MODO ACTUAL: ${modo}
FUENTE: ${fuente}

CONTEXTO LEGAL RECUPERADO:
${leyesTexto}

INSTRUCCIONES:
1. Si el usuario pregunta (Modo Consulta), explica de forma clara usando los artículos citados.
2. Si el usuario pide redactar (Modo Redactar), genera un documento legal formal.
3. Debes responder EXCLUSIVAMENTE en formato JSON con esta estructura:
{
  "draftHtml": "Contenido principal o borrador en HTML",
  "resumen": "Explicación breve de 2 líneas",
  "articulos": ["1911", "1899"],
  "confianza": "Alta | Media | Baja",
  "fuentes": ["Código Civil Art. 1911"]
}
4. No menciones artículos que no estén en el CONTEXTO LEGAL arriba.
5. Si no hay artículos en el CONTEXTO LEGAL, responde con tus conocimientos generales pero marca confianza 'Baja'.
`;

    // 4. Llamada al modelo
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: pregunta }
      ],
      max_tokens: 1500,
      temperature: 0.1, // Baja temperatura para mayor precisión legal
      response_format: { type: "json_object" } // Fuerza la salida JSON
    });

    let raw = completion.choices[0].message.content;
    let parsed = JSON.parse(raw);

    // 5. Verificación cruzada de seguridad (Artículos reales vs inventados)
    const articulosValidos = [];
    const fuentesValidas = [];

    if (parsed.articulos && Array.isArray(parsed.articulos)) {
      parsed.articulos.forEach(num => {
        // Buscamos en el contexto legal que vino del motor
        const coincide = contextoLegal.find(a => a.numero == num);
        if (coincide) {
          articulosValidos.push(num);
          fuentesValidas.push(`${fuente} Art. ${num}`);
        }
      });
    }

    // 6. Ajuste de confianza final
    let confianzaFinal = "Alta";
    if (articulosValidos.length === 0) confianzaFinal = "Baja";
    else if (articulosValidos.length < parsed.articulos.length) confianzaFinal = "Media";

    parsed.confianza = confianzaFinal;
    parsed.articulos = articulosValidos;
    parsed.fuentes = fuentesValidas;

    // 7. Respuesta al frontend
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