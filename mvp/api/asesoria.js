import { AzureOpenAI } from "openai";
import { ejecutarMotorEstructurado } from "../mvp/motor.js"; [cite: 1]

export default async function handler(req, res) { [cite: 2]
  try {
    const { pais, estado, tema, pregunta } = req.body; [cite: 2]

    // 1. EJECUCIÓN DEL MOTOR (CORREGIDO)
    // No lo dejes como {}, debe llamar a la función para obtener las leyes
    const payload = await ejecutarMotorEstructurado(pais, estado, tema, pregunta); [cite: 26, 35]


    // 2. Preparar cliente Azure OpenAI
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT
    }); [cite: 4]

    // 3. Validaciones de seguridad para el payload (Evita errores de .join)
    const palabrasClave = Array.isArray(payload.palabras_clave) ? payload.palabras_clave.join(", ") : "No detectadas"; [cite: 25]
    const ontologiaDetectada = Array.isArray(payload.ontologia_detectada) ? payload.ontologia_detectada.join(", ") : "No detectada"; [cite: 25]

    // 4. Construir prompt híbrido con la información del motor
    const reglasTexto = payload.reglas_relevantes
      .map(r => `Art. ${r.articulo}: ${r.regla}`)
      .join("\n"); [cite: 35, 38]

    const prompt = `
      Eres un asistente legal experto. Con base en estas reglas:
      ${reglasTexto}
      
      Responde a la siguiente pregunta del usuario: ${pregunta}
    `; [cite: 26, 35]

    // 5. Llamar a Azure OpenAI de verdad
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "Responde de forma clara y legalmente fundamentada." },
        { role: "user", content: prompt }
      ],
      model: "" // Vercel usará el deployment configurado en el cliente 
    });

    const respuestaIA = completion.choices[0].message.content; [cite: 28, 78]

    // 6. Responder al frontend con la respuesta real
    res.status(200).json({ 
      respuesta: respuestaIA,
      datos_motor: payload // Opcional: para depurar en el frontend [cite: 35, 79]
    });

  } catch (error) {
    console.error("Error en asesoria.js:", error); [cite: 29]
    res.status(500).json({ error: error.message }); [cite: 29]
  }
}