import { AzureOpenAI } from "openai";

export default async function handler(req, res) {
  try {
    // Validar que el body exista
    if (!req.body) {
      return res.status(400).json({ error: "No se recibió body en la solicitud." });
    }

    // Log para depurar variables de entorno
    console.log("AZURE_OPENAI_ENDPOINT:", process.env.AZURE_OPENAI_ENDPOINT);
    console.log("AZURE_OPENAI_DEPLOYMENT:", process.env.AZURE_OPENAI_DEPLOYMENT);

    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT
    });

    const response = await client.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: req.body.message || "¡Hola!, soy Apolo." }
      ]
    });

    res.setHeader("Content-Type", "application/json");

    return res.status(200).json({
      reply: response.choices[0].message.content
    });

  } catch (error) {
    console.error("ERROR EN /api/chat:", error);

    return res.status(500).json({
      error: error.message || "Error desconocido en el servidor."
    });
  }

}
