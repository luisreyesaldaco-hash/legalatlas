import { GoogleGenAI } from "@google/genai";
import { buscarArticulos } from "./buscar.js";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: true } };

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

function leerReceta(pais, tipo) {
  const ruta = path.join(process.cwd(), "recetas", pais, `${tipo}.json`);
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

export default async function handler(req, res) {

  // ── GET: metadatos de receta(s) ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { tipo, pais } = req.query;

    if (!tipo) {
      // Listar recetas del país solicitado (o todas si no se especifica)
      try {
        const raiz = path.join(process.cwd(), "recetas");
        const paises = pais
          ? [pais]
          : fs.readdirSync(raiz).filter(d => fs.statSync(path.join(raiz, d)).isDirectory());
        const lista = paises.flatMap(p => {
          const dir = path.join(raiz, p);
          try {
            return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
              const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
              return { tipo: r.tipo, titulo: r.titulo, descripcion: r.descripcion, pais: p };
            });
          } catch { return []; }
        });
        return res.status(200).json(lista);
      } catch (e) {
        return res.status(500).json({ error: "No se pudieron cargar las recetas" });
      }
    }

    try {
      const paisBuscar = pais || 'MX';
      const r = leerReceta(paisBuscar, tipo);
      return res.status(200).json({
        tipo:                  r.tipo,
        titulo:                r.titulo,
        precio_mxn:            r.precio_mxn,
        pais:                  paisBuscar,
        datos_requeridos:      r.datos_requeridos,
        preguntas_profundidad: r.preguntas_profundidad,
        nota_al_usuario:       r.nota_al_usuario
      });
    } catch (e) {
      return res.status(404).json({ error: `Receta '${tipo}' no encontrada para país '${pais}'` });
    }
  }

  // ── POST: generar el documento ───────────────────────────────────────────
  try {
    const body  = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    console.log("datos recibidos:", JSON.stringify(body, null, 2));
    const { tipo, datos, pais } = body;

    if (!tipo || !datos) {
      return res.status(400).json({ error: "Se requiere tipo y datos" });
    }

    const receta = leerReceta(pais || 'MX', tipo);

    // Inyectar fecha actual y estado si no vienen del cliente
    if (!datos.fecha_actual) {
      datos.fecha_actual = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // ── RAG: buscar artículos relevantes en Supabase ──────────────────────
    const CPEUM_LEY = 'Constitución Política de los Estados Unidos Mexicanos';
    const esMexico  = !receta.pais || receta.pais === 'MX';

    let contextoLegal = [];
    try {
      if (receta.rag_queries?.length) {
        // Múltiples queries con n específico por query (formato nuevo)
        const promises = receta.rag_queries.map(({ query, n }) =>
          buscarArticulos(query, datos.estado || '', receta.fuente_ley || 'Código Civil', n)
        );
        const resultados = await Promise.allSettled(promises);
        contextoLegal = resultados.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      } else if (esMexico && datos.estado) {
        // Formato original: query_rag único + CPEUM paralelo
        const queryRAG = receta.query_rag
          ? `${receta.query_rag} ${datos.concepto || ''}`.trim()
          : [datos.concepto, datos.peticion].filter(Boolean).join(' ') || tipo.replace(/_/g, ' ');
        const [leyResults, cpuemResults] = await Promise.allSettled([
          buscarArticulos(queryRAG, datos.estado, receta.fuente_ley || 'Código Civil', 4),
          buscarArticulos('acceso justicia petición derecho acudir tribunales garantías', '', CPEUM_LEY, 2)
        ]);
        contextoLegal = [
          ...(leyResults.status   === 'fulfilled' ? leyResults.value   : []),
          ...(cpuemResults.status === 'fulfilled' ? cpuemResults.value : [])
        ];
      } else {
        const queryRAG = receta.query_rag || tipo.replace(/_/g, ' ');
        contextoLegal = await buscarArticulos(queryRAG, datos.estado || '', receta.fuente_ley || 'Código Civil', 5);
      }
    } catch (e) {
      console.warn('RAG falló en redactar:', e.message);
    }
    // Deduplicar por número de artículo
    const vistos = new Set();
    const contextoUnico = contextoLegal.filter(r => {
      if (vistos.has(r.numero)) return false;
      vistos.add(r.numero); return true;
    });
    const contexto_legal_texto = contextoUnico.length
      ? contextoUnico.map(r => `Art. ${r.numero}: ${r.texto}`).join('\n\n')
      : '[SIN CONTEXTO LEGAL — REVISAR]';
    console.log(`RAG redactar: ${contextoLegal.length} artículos para "${queryRAG}"`);

    // Interpolar datos + contexto_legal en el system prompt
    let systemPrompt = receta.system_prompt;
    Object.entries(datos).forEach(([k, v]) => {
      systemPrompt = systemPrompt.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    systemPrompt = systemPrompt.replace('{contexto_legal}', contexto_legal_texto);

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: mensajeUsuario,
      config: {
        systemInstruction: systemPrompt,
        temperature:       0.1,
        maxOutputTokens:   4000
      }
    });

    const html = response.text;
    if (!html) throw new Error("Gemini no devolvió contenido");

    res.status(200).json({
      html,
      titulo:      receta.titulo,
      nota:        receta.nota_al_usuario,
      nota_upsell: receta.nota_upsell || null
    });

  } catch (error) {
    console.error("Error en redactar.js:", error);
    res.status(500).json({
      error:   "Error generando el documento",
      details: error.message
    });
  }
}
