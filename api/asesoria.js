import { AzureOpenAI } from "openai";

export default async function handler(req, res) {
  try {
    // 1. Recibimos TODO lo que mandó el app.js
    const { pais, estado, tema, pregunta, contextoLegal, fuente } = req.body;

    // 2. Preparamos el cliente de Azure
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: "2024-08-01-preview"
    });

    // 3. Convertimos los artículos del motor en un texto legible para la IA
    const leyesTexto = contextoLegal && contextoLegal.length > 0
      ? contextoLegal.map(r => `ARTÍCULO ${r.articulo}: ${r.regla}`).join("\n\n")
      : "No se encontraron artículos específicos en la base de datos.";

    // 4. El Prompt "Autoritario"
    const systemMessage = `Eres APOLO, un asistente legal experto.
    Jurisdicción actual: ${estado.toUpperCase()}, ${pais.toUpperCase()}.
    Fuente: ${fuente}.

    CONTEXTO LEGAL (Usa esto para responder):
    ${leyesTexto}

    INSTRUCCIONES CRÍTICAS:
    1. Si el CONTEXTO LEGAL contiene información, DEBES citar los números de artículo (ej. "Según el Artículo 1947...").
    2. Si el usuario pregunta por algo que está en los artículos (como rescisión o pago), usa esa base legal obligatoriamente.
    3. Responde de forma clara, profesional y directa.`;

    // 5. Ejecución en Azure
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: pregunta }
      ],
      max_tokens: 1000,
      temperature: 0.3 // Precisión legal
    });

    const respuestaIA = completion.choices[0].message.content;

    res.status(200).json({ 
      respuesta: respuestaIA,
      datos_motor: { fuente, articulos_usados: contextoLegal?.length } 
    });

  } catch (error) {
    console.error("Error en asesoria.js:", error);
    res.status(500).json({ error: error.message });
  }
}