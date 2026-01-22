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

    // 3. Formatear las reglas encontradas (Mejorado para claridad de la IA)
    const reglasTexto = payload.reglas_relevantes && payload.reglas_relevantes.length > 0
      ? payload.reglas_relevantes.map(r => `[ARTÍCULO ${r.articulo}]: ${r.regla}`).join("\n\n")
      : "No se encontraron artículos específicos.";

    // 4. Construir prompt híbrido (Menos restrictivo, más analítico)
    const systemMessage = `Eres APOLO, un asistente legal experto para la jurisdicción de ${payload.fuente || estado}. 
    Tu misión es analizar la duda del usuario usando la base legal que te proporciona el motor de búsqueda.
    
    BASE LEGAL DISPONIBLE:
    ${reglasTexto}
    
    INSTRUCCIONES:
    1. Si hay artículos disponibles, utilízalos y menciona el numero del articulo para dar una respuesta fundamentada y juridica. 
    2. No te limites a buscar palabras exactas; interpreta si el artículo aplica a la situación (ej: "rescisión por falta de pago" aplica a dudas sobre "no pagar la renta").
    3. Cita SIEMPRE el número de artículo.
    4. Si los artículos no son suficientes, usa tu conocimiento general para orientar al usuario, pero aclara qué parte es interpretación general y qué parte es ley local.`;

    // 5. Llamar a Azure OpenAI
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `Pregunta del usuario: ${pregunta}` }
      ],
      max_tokens: 1000,
      temperature: 0.5 // Subimos levemente para permitir razonamiento legal
    });

    const respuestaIA = completion.choices[0].message.content;

    // 6. Responder al frontend con los datos originales del motor
    res.status(200).json({ 
      respuesta: respuestaIA,
      datos_motor: {
        contexto: payload.fuente,
        reglas: payload.reglas_relevantes, // Para que veas qué le llegó
        palabras_clave: payload.palabras_clave || []
      }
    });

  } catch (error) {
    console.error("Error en asesoria.js:", error);
    res.status(500).json({ error: error.message });
  }
}