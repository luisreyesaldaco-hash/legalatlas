import { AzureOpenAI } from "openai";
import { ejecutarMotorEstructurado } from "../mvp/motor.js"; [cite: 1]

export default async function handler(req, res) { [cite: 2]
  try {
    const { pais, estado, tema, pregunta } = req.body; [cite: 2]

    // 1. Ejecutar motor computable
    const payload = {}; [cite: 3]

    // 2. Preparar cliente Azure OpenAI
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT
    }); [cite: 4]

    // 3. Validaciones de seguridad para el payload (Evita errores de .join)
    const palabrasClave = Array.isArray(payload.palabras_clave) ? payload.palabras_clave.join(", ") : "No detectadas"; [cite: 25]
    const ontologiaDetectada = Array.isArray(payload.ontologia_detectada) ? payload.ontologia_detectada.join(", ") : "No detectada"; [cite: 25]

    // 4. Construir prompt híbrido
    const prompt = "test";

    // 5. Llamar a Azure OpenAI (Corrección de ID y Deployment)
    const completion = { choices: [ { message: { content: "ok" } } ] };


    const respuestaIA = completion.choices[0].message.content; [cite: 28]

    // 6. Responder al frontend
    res.status(200).json({ respuesta: "funciona" });
 [cite: 28]

  } catch (error) {
    console.error("Error en asesoria.js:", error); [cite: 29]
    res.status(500).json({ error: error.message }); [cite: 29]
  }
}