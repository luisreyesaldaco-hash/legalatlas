import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { buscarArticulos } from "../lib/buscar.js";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: true } };

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function leerReceta(pais, tipo) {
  const ruta = path.join(process.cwd(), "recetas", pais, `${tipo}.json`);
  return JSON.parse(fs.readFileSync(ruta, "utf8"));
}

// ── Interpolar {placeholders} en un string ───────────────────────────────────
function interpolar(texto, datos) {
  let result = texto;
  Object.entries(datos).forEach(([k, v]) => {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v ?? '');
  });
  return result;
}

// ── Helper: una llamada Gemini focalizada (con fallback a Claude Haiku) ───────
async function llamarGemini(systemInstruction, userPrompt) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature:     0.1,
        maxOutputTokens: 900
      }
    });
    return response.text || '';
  } catch (err) {
    console.warn('[redactar] llamarGemini falló, usando Claude Haiku:', err.message)
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      system: systemInstruction,
      messages: [{ role: 'user', content: userPrompt }]
    })
    return resp.content[0].text || ''
  }
}

// ── TEMPLATES: secciones deterministas ──────────────────────────────────────
const TEMPLATES = {

  declaraciones_vendedor_comprador(datos) {
    return `<h3>SECCIÓN 1 — DECLARACIONES</h3>
<p>En <strong>${datos.estado || 'la Ciudad'}</strong>, siendo el <strong>${datos.fecha_actual}</strong>, comparecen:</p>
<p><strong>EL VENDEDOR:</strong> ${datos.nombre_vendedor}, en lo sucesivo denominado "EL VENDEDOR", quien declara ser el legítimo propietario del vehículo descrito en la Sección 2 del presente contrato, y que dicho bien se encuentra libre de gravámenes, embargos, adeudos fiscales y cualquier otra limitación de dominio que impida su transmisión.</p>
<p><strong>EL COMPRADOR:</strong> ${datos.nombre_comprador}, en lo sucesivo denominado "EL COMPRADOR", quien declara su voluntad de adquirir el vehículo en los términos y condiciones que se estipulan en el presente instrumento.</p>
<p>Ambas partes declaran tener capacidad legal para contratar y obligarse, y que suscriben el presente contrato de manera libre y voluntaria, sin que medie dolo, error, mala fe ni ningún vicio del consentimiento.</p>`;
  },

  precio_forma_pago_vehiculo(datos) {
    const precio = datos.precio_venta || 'No especificado';
    const forma  = datos.forma_pago  || 'No especificada';
    let parrafo = `El precio pactado de común acuerdo por las partes es de <strong>${precio}</strong>.`;
    if (forma.toLowerCase().includes('efectivo')) {
      parrafo += ` El pago se realizará en <strong>efectivo, en una sola exhibición</strong>, al momento de la firma del presente contrato y entrega del vehículo.`;
    } else if (forma.toLowerCase().includes('transferencia')) {
      parrafo += ` El pago se realizará mediante <strong>transferencia bancaria</strong> a la cuenta que el Vendedor indique por escrito, quedando acreditado el pago con el comprobante electrónico correspondiente.`;
    } else if (forma.toLowerCase().includes('parcialidades')) {
      parrafo += ` El pago se realizará <strong>en parcialidades</strong>, conforme al calendario que ambas partes acuerden por escrito como anexo al presente contrato.`;
    } else {
      parrafo += ` Forma de pago acordada: <strong>${forma}</strong>.`;
    }
    return `<h3>SECCIÓN 3 — PRECIO Y FORMA DE PAGO</h3>
<p>${parrafo}</p>
<p>El incumplimiento en el pago facultará al Vendedor a exigir el cumplimiento forzoso o la rescisión del contrato, más el pago de daños y perjuicios ocasionados.</p>`;
  },

  fundamento_legal(datos, articulos) {
    if (!articulos?.length) {
      return `<h3>SECCIÓN 8 — FUNDAMENTO LEGAL</h3>
<p>El presente contrato se celebra al amparo de las disposiciones aplicables del Código Civil del Estado de <strong>${datos.estado || 'México'}</strong> en materia de compraventa de bienes muebles.</p>`;
    }
    const lista = articulos
      .map(a => `<p><strong>Art. ${a.numero}:</strong> ${a.texto}</p>`)
      .join('\n');
    return `<h3>SECCIÓN 8 — FUNDAMENTO LEGAL</h3>
<p>El presente contrato se fundamenta en las siguientes disposiciones legales:</p>
${lista}`;
  },

  firmas_vendedor_comprador(datos) {
    return `<h3>SECCIÓN 9 — FIRMAS</h3>
<p>Leído que fue el presente contrato por las partes y enteradas de su contenido, alcance y efectos legales, lo firman de conformidad en la ciudad de <strong>${datos.estado || ''}</strong>, el <strong>${datos.fecha_actual}</strong>.</p>
<br>
<p><strong>EL VENDEDOR</strong></p>
<p>Nombre: ${datos.nombre_vendedor}</p>
<p>Firma: ______________________________</p>
<br>
<p><strong>EL COMPRADOR</strong></p>
<p>Nombre: ${datos.nombre_comprador}</p>
<p>Firma: ______________________________</p>
<br>
<p><strong>TESTIGO 1</strong></p>
<p>Nombre: ______________________________</p>
<p>Firma: ______________________________</p>
<br>
<p><strong>TESTIGO 2</strong></p>
<p>Nombre: ______________________________</p>
<p>Firma: ______________________________</p>`;
  }
};

// ── Generar documento con arquitectura híbrida ───────────────────────────────
async function generarHibrido(receta, datos, contextoUnico) {
  const contexto_legal_texto = contextoUnico.length
    ? contextoUnico.map(r => `Art. ${r.numero}: ${r.texto}`).join('\n\n')
    : '[SIN CONTEXTO LEGAL]';

  // Base de contexto para secciones Gemini
  const baseSystem = `Eres APOLO, redactor legal mexicano. Generas UNA SOLA SECCIÓN de un contrato de compraventa de vehículo entre particulares en ${datos.estado || 'México'}, fecha ${datos.fecha_actual}.
CONTEXTO LEGAL DISPONIBLE:\n${contexto_legal_texto}
DATOS:
- Vendedor: ${datos.nombre_vendedor}
- Comprador: ${datos.nombre_comprador}
- Vehículo: ${datos.descripcion_vehiculo}
- NIV: ${datos.numero_serie}
- Placas: ${datos.placas}
- Precio: ${datos.precio_venta}
- Forma de pago: ${datos.forma_pago}
- Estado del vehículo: ${datos.estado_vehiculo || 'Sin desperfectos declarados'}
- Adeudos: ${datos.adeudos || 'Sin adeudos'}
- Fecha de entrega: ${datos.fecha_entrega || 'En el momento de la firma'}
REGLAS:
- Responde EXCLUSIVAMENTE con HTML usando <p>, <strong>, <br>
- Empieza SIEMPRE con el <h3> de la sección indicada
- Sin <html>, <body>, <head>, <style> ni markdown
- Tono formal pero comprensible`;

  // Separar secciones por tipo
  const pendientesGemini = receta.secciones.filter(s => s.tipo === 'gemini');
  const userPromptBase = `Datos del contrato:\nVendedor: ${datos.nombre_vendedor}\nComprador: ${datos.nombre_comprador}\nVehículo: ${datos.descripcion_vehiculo}`;

  // Strip el primer <h3> que Gemini pueda incluir — el título lo ponemos nosotros
  const limpiarTitulo = (html) => html.replace(/<h3>.*?<\/h3>/is, '').trim();

  // Lanzar todas las llamadas Gemini en paralelo
  const instruccionBase = 'No incluyas ningún título ni encabezado en tu respuesta.\nEmpieza directamente con el contenido en <p>.\n\n';
  const promesasGemini = pendientesGemini.map(seccion =>
    llamarGemini(
      `${baseSystem}\n\nTU TAREA: ${instruccionBase}${seccion.instruccion}`,
      userPromptBase
    ).then(html => ({ id: seccion.id, html: limpiarTitulo(html) }))
     .catch(() => ({ id: seccion.id, html: '<p>[Error generando sección]</p>' }))
  );

  const resultadosGemini = await Promise.all(promesasGemini);
  const mapGemini = Object.fromEntries(resultadosGemini.map(r => [r.id, r.html]));

  // Ensamblar en orden garantizado — títulos siempre desde la receta, nunca de Gemini
  const partes = receta.secciones.map(seccion => {
    if (seccion.tipo === 'codigo') {
      const fn = TEMPLATES[seccion.template];
      if (!fn) return `<h3>SECCIÓN ${seccion.id} — ${seccion.titulo}</h3><p>[Template no encontrado: ${seccion.template}]</p>`;
      return fn(datos, contextoUnico);
    } else if (seccion.tipo === 'rag') {
      if (!contextoUnico.length) {
        return `<h3>SECCIÓN ${seccion.id} — ${seccion.titulo}</h3>\n<p>El presente contrato se fundamenta en las disposiciones aplicables del Código Civil del Estado de <strong>${datos.estado || 'México'}</strong>.</p>`;
      }
      const lista = contextoUnico
        .map(a => `<p><strong>${a.fuente || 'Código Civil'} Art. ${a.numero}:</strong> ${a.texto}</p>`)
        .join('\n');
      return `<h3>SECCIÓN ${seccion.id} — ${seccion.titulo}</h3>\n${lista}`;
    } else {
      const contenido = mapGemini[seccion.id] || '<p>[Sin contenido]</p>';
      return `<h3>SECCIÓN ${seccion.id} — ${seccion.titulo}</h3>\n${contenido}`;
    }
  });

  return partes.join('\n\n');
}

export default async function handler(req, res) {

  // ── GET: metadatos de receta(s) ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { tipo, pais } = req.query;

    if (!tipo) {
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

    // Inyectar fecha actual si no viene del cliente
    if (!datos.fecha_actual) {
      datos.fecha_actual = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // ── RAG: buscar artículos relevantes en Supabase ──────────────────────
    const CPEUM_LEY = 'Constitución Política de los Estados Unidos Mexicanos';
    const esMexico  = !receta.pais || receta.pais === 'MX';

    let contextoLegal = [];
    try {
      if (receta.rag_queries?.length) {
        const promises = receta.rag_queries.map(({ query, n }) =>
          buscarArticulos(query, datos.estado || '', receta.fuente_ley || 'Código Civil', n)
        );
        const resultados = await Promise.allSettled(promises);
        contextoLegal = resultados.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      } else if (esMexico && datos.estado) {
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
    console.log(`RAG redactar: ${contextoLegal.length} artículos encontrados`);

    // ── ARQUITECTURA HÍBRIDA (recetas con secciones[]) ────────────────────
    if (receta.secciones?.length) {
      const html = await generarHibrido(receta, datos, contextoUnico);
      if (!html) throw new Error("generarHibrido no devolvió contenido");
      return res.status(200).json({
        html,
        titulo:      receta.titulo,
        nota:        receta.nota_al_usuario,
        nota_upsell: receta.nota_upsell || null
      });
    }

    // ── ARQUITECTURA CLÁSICA (recetas sin secciones[]) ────────────────────
    const contexto_legal_texto = contextoUnico.length
      ? contextoUnico.map(r => `Art. ${r.numero}: ${r.texto}`).join('\n\n')
      : '[SIN CONTEXTO LEGAL — REVISAR]';

    let systemPrompt = receta.system_prompt;
    Object.entries(datos).forEach(([k, v]) => {
      systemPrompt = systemPrompt.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    systemPrompt = systemPrompt.replace('{contexto_legal}', contexto_legal_texto);

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

    let html
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: mensajeUsuario,
        config: {
          systemInstruction: systemPrompt,
          temperature:       0.1,
          maxOutputTokens:   4000
        }
      });
      html = response.text
      if (!html) throw new Error("Gemini no devolvió contenido")
    } catch (geminiErr) {
      console.warn('[redactar] modo clásico Gemini falló, usando Claude Haiku:', geminiErr.message)
      const resp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: mensajeUsuario }]
      })
      html = resp.content[0].text
      if (!html) throw new Error("Claude Haiku no devolvió contenido")
    }

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
