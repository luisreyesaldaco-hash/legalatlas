import { AzureOpenAI } from "openai";
import { ejecutarMotorEstructurado } from "../src/motor.js";

export default async function handler(req, res) {
  try {
    const { pais, estado, tema, pregunta } = req.body;

    // 1. Ejecutar motor computable (Obtener leyes relevantes)
    const payload = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);

    // 2. Preparar cliente Azure OpenAI
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: "2024-08-01-preview"
    });

    // 3. Formatear las reglas encontradas para el prompt
    const reglasTexto = payload.reglas_relevantes && payload.reglas_relevantes.length > 0
      ? payload.reglas_relevantes.map(r => `Art. ${r.articulo}: ${r.regla}`).join("\n")
      : "No se encontraron artículos específicos en la base de datos para esta consulta.";

    // 4. Construir prompt híbrido
    const prompt = `
      Eres un asistente legal experto para la jurisdicción de ${payload.contexto}.
      Utiliza EXCLUSIVAMENTE las siguientes reglas legales para fundamentar tu respuesta:
      
      ${reglasTexto}
      
      Pregunta del usuario: ${pregunta}
      
      Instrucciones: Responde de forma profesional, clara y cita siempre el número de artículo si está disponible. 
      Si la información no es suficiente, indícalo basándote solo en las reglas proporcionadas.
    `;

    // 5. Llamar a Azure OpenAI
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "Asistente legal especializado en análisis de normas computables." },
        { role: "user", content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.3 // Temperatura baja para mayor precisión legal
    });

    const respuestaIA = completion.choices[0].message.content;

    // 6. Responder al frontend
    res.status(200).json({ 
      respuesta: respuestaIA,
      datos_motor: {
        contexto: payload.contexto,
        palabras_clave: payload.palabras_clave,
        ontologia: payload.ontologia_detectada
      }
    });

  } catch (error) {
    console.error("Error en asesoria.js:", error);
    res.status(500).json({ error: error.message });
  }
}