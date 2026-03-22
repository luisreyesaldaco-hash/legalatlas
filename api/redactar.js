import { AzureOpenAI } from "openai";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: true } };

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey:   process.env.AZURE_OPENAI_KEY,
  apiVersion: "2024-12-01-preview",
  deployment: "gpt-4o-mini"
});

function leerReceta(tipo) {
  const ruta = path.join(process.cwd(), "recetas", `${tipo}.json`);
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

export default async function handler(req, res) {

  // ── GET: metadatos de receta(s) ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { tipo } = req.query;

    if (!tipo) {
      // Listar todas las recetas disponibles
      try {
        const carpeta  = path.join(process.cwd(), "recetas");
        const archivos = fs.readdirSync(carpeta).filter(f => f.endsWith('.json'));
        const lista    = archivos.map(f => {
          const r = JSON.parse(fs.readFileSync(path.join(carpeta, f), "utf8"));
          return { tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion };
        });
        return res.status(200).json(lista);
      } catch (e) {
        return res.status(500).json({ error: "No se pudieron cargar las recetas" });
      }
    }

    // Devolver metadatos de una receta específica (preguntas, sin system_prompt)
    try {
      const r = leerReceta(tipo);
      return res.status(200).json({
        tipo:                 r.tipo,
        titulo:               r.titulo,
        datos_requeridos:     r.datos_requeridos,
        preguntas_profundidad: r.preguntas_profundidad,
        nota_al_usuario:      r.nota_al_usuario
      });
    } catch (e) {
      return res.status(404).json({ error: `Receta '${tipo}' no encontrada` });
    }
  }

  // ── POST: generar el documento ───────────────────────────────────────────
  try {
    const body  = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { tipo, datos } = body;

    if (!tipo || !datos) {
      return res.status(400).json({ error: "Se requiere tipo y datos" });
    }

    const receta = leerReceta(tipo);

    // Interpolar datos en el system prompt
    let systemPrompt = receta.system_prompt;
    Object.entries(datos).forEach(([k, v]) => {
      systemPrompt = systemPrompt.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });

    // Construir mensaje con todos los datos recopilados
    const requeridos = (receta.datos_requeridos || [])
      .map(d => `${d.campo}: ${datos[d.campo] || 'No proporcionado'}`)
      .join('\n');

    const opcionales = (receta.preguntas_profundidad || [])
      .filter(d => datos[d.campo] && datos[d.campo].toLowerCase() !== 'no')
      .map(d => `${d.campo}: ${datos[d.campo]}`)
      .join('\n');

    const mensajeUsuario =
      `Redacta la carta con los siguientes datos:\n${requeridos}` +
      (opcionales ? `\n${opcionales}` : '');

    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: mensajeUsuario }
      ],
      max_tokens: 2500,
      temperature: 0.1
    });

    const html = completion.choices[0]?.message?.content;
    if (!html) throw new Error("Azure no devolvió contenido");

    res.status(200).json({
      html,
      titulo: receta.titulo,
      nota:   receta.nota_al_usuario
    });

  } catch (error) {
    console.error("Error en redactar.js:", error);
    res.status(500).json({
      error:   "Error generando el documento",
      details: error.message
    });
  }
}
