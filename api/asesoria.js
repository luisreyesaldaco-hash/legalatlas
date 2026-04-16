import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { buscarArticulosPorPais } from "../lib/buscar.js";

export const config = { api: { bodyParser: true } };

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function is503(err) {
  return err?.message?.includes('503') || err?.message?.includes('429') ||
    err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand') || err?.message?.includes('RESOURCE_EXHAUSTED')
}

async function generateWithRetry(params, retries = 6) {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.models.generateContent(params)
    } catch (err) {
      if (is503(err) && i < retries - 1) { await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i))); continue }
      throw err
    }
  }
}

function nombrePais(iso) {
  try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(iso) } catch { return iso }
}

async function detectarEscalacion(mensaje) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Eres un clasificador legal. Analiza este mensaje y determina si describe una situación que requiere atención urgente de un abogado real.

Responde ÚNICAMENTE con SI o NO. Sin explicación.

Criterios para SI:
- Proceso judicial activo (demanda, audiencia, amparo, tribunal)
- Materia penal (acusación, detención, ministerio público)
- Urgencia temporal crítica (audiencia mañana, plazo de horas)
- Menores de edad en riesgo (custodia urgente, violencia)
- Monto mayor a $200,000 MXN en riesgo inmediato

Mensaje: "${mensaje}"` }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0 }
        })
      }
    );
    const data = await response.json();
    const resultado = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return resultado === 'SI';
  } catch (e) {
    console.warn('detectarEscalacion falló:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { pais, estado, tema, pregunta, fuente, modo, tipo, historial, alcance } = body;
    const esAbogado = modo === 'abogado';

    if (!pregunta || !String(pregunta).trim()) {
      return res.status(400).json({ error: 'Pregunta requerida.' })
    }

    // Búsqueda de contexto legal + detección de escalación en paralelo
    const ragPromise = buscarArticulosPorPais(String(pregunta).trim(), pais, 10, estado);

    const [contextoLegalResult, requiereAbogado] = await Promise.all([
      ragPromise,
      detectarEscalacion(pregunta)
    ]);
    const contextoLegal = contextoLegalResult;

    // 1. Normalizar número de artículo a solo dígitos ("ART. 2273.-" → "2273")
    const normalizarNum = (n) => (n || '').replace(/\D/g, '') || n

    const contextoNorm = (contextoLegal || []).map(r => ({
      ...r,
      numeroLimpio: normalizarNum(r.numero)
    }))

    const leyesTexto = contextoNorm.length
      ? contextoNorm
          .map(r => `Artículo ${r.numeroLimpio}: ${r.texto || "Contenido no disponible"}`)
          .join("\n\n")
      : "No se encontraron artículos específicos.";

    const paisDisplay  = nombrePais(pais);
    const fuentesActivas = fuente || `legislación de ${paisDisplay}`;
    const jurisdiccion = estado ? `${estado}, ${paisDisplay}` : paisDisplay;
    const instruccionEscalacion = requiereAbogado ? `
INSTRUCCIÓN ADICIONAL OBLIGATORIA: Al final de tu respuesta en draftHtml, agrega un párrafo separado que diga exactamente:
"Este caso tiene elementos que van más allá de lo que puedo resolver solo. Te recomiendo hablar con un abogado especializado. ¿Quieres que te conecte con uno en ${estado || paisDisplay}?"
` : '';
    const instruccionTipo = tipo
      ? `\nINSTRUCCIÓN DE INICIO: El usuario quiere redactar un contrato de tipo "${tipo}". Hazle las preguntas necesarias para generarlo — datos de las partes, términos principales, condiciones especiales. Guíalo paso a paso.\n`
      : '';
    const tonoPrompt = esAbogado ? `
TONO OBLIGATORIO PARA ABOGADO:
- Lenguaje técnico-jurídico sin explicar términos básicos
- Cita artículos con número exacto primero, luego el texto relevante
- Respuestas densas y precisas — sin analogías ni ejemplos cotidianos
- Usa terminología procesal correcta
- Máximo 4 párrafos — la precisión vale más que la extensión
- Trato impersonal o de usted — nunca tuteo
- Si el artículo tiene excepciones o remisiones a otros artículos, menciónalas
` : `
TONO OBLIGATORIO PARA CIUDADANO:
- Eres un asistente jurídico profesional
- Responde con precisión y autoridad
- Usa terminología legal correcta
- Cita siempre el artículo exacto con su número y ley de origen
- Tono: profesional pero accesible
- NO uses lenguaje informal ni coloquial
- Trato de usted
`;

    const alcancePrompt = alcance === 'articulo'
      ? 'Responde enfocándote en el artículo activo proporcionado y sus relaciones con otros artículos del mismo código.'
      : 'Responde con una visión amplia del tema dentro de la ley activa, citando los artículos más relevantes.';

    const systemPrompt = `ABSOLUTE RULE — NON-NEGOTIABLE: Detect the language of this exact string: "${String(pregunta).slice(0, 60)}"
If that string is in English → write your ENTIRE response in English only. This applies to ALL JSON fields (draftHtml, resumen, fuentes).
If in Spanish → respond entirely in Spanish.
If in Czech → respond entirely in Czech.
The legal articles below may be in Czech or Spanish — that is FINE. Cite them but explain them in the detected language.
DO NOT let the language of the articles influence the language of your response.
DO NOT announce what language you detected. DO NOT explain this rule. DO NOT write any preamble. START your response directly with the content.

Eres APOLO, un asistente legal experto para la jurisdicción de ${jurisdiccion.toUpperCase()}.
${instruccionTipo}

FUENTES CONSULTADAS: ${fuentesActivas}

CONTEXTO LEGAL RECUPERADO:
${leyesTexto}
${tonoPrompt}
${alcancePrompt}

INSTRUCCIONES:
1. Explica usando los artículos del contexto.
2. Cita siempre el número de artículo exacto y la ley de donde proviene.
3. Si la información necesaria no está en los artículos proporcionados, dilo con claridad.
4. Nunca inventes leyes, artículos ni interpretaciones.
5. Responde EXCLUSIVAMENTE en formato JSON con esta estructura:
${instruccionEscalacion}
{
  "draftHtml": "Respuesta en HTML con párrafos y listas si aplica",
  "resumen": "Explicación breve de 2 líneas",
  "articulos": ["2273", "2325"],
  "confianza": "Alta | Media | Baja",
  "fuentes": ["Código Civil Art. 2273", "CPEUM Art. 1"]
}`;

    // 3. Llamada a Gemini Flash
    const preguntaTrimmed = String(pregunta).trim();
    const mensajes = historial?.length > 0
      ? [
          ...historial.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: preguntaTrimmed }] }
        ]
      : preguntaTrimmed;

    let raw
    try {
      const geminiResponse = await generateWithRetry({
        model: "gemini-2.5-flash",
        contents: mensajes,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType:  'application/json',
          thinkingConfig:    { thinkingBudget: 0 },
          temperature:       0.1,
          maxOutputTokens:   4000
        }
      })
      raw = geminiResponse.text
      if (!raw) throw new Error('Gemini no devolvió contenido')
    } catch (geminiErr) {
      console.warn('[asesoria] Gemini falló, usando Claude Haiku:', geminiErr.message)
      const claudeMessages = Array.isArray(mensajes)
        ? mensajes.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.parts?.[0]?.text || ''
          }))
        : [{ role: 'user', content: mensajes }]
      const claudeResp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt + '\n\nResponde SOLO con JSON válido, sin markdown.',
        messages: claudeMessages
      })
      raw = claudeResp.content[0].text.trim()
        .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    if (!raw) throw new Error('No se obtuvo respuesta del modelo')
    let parsed
    try { parsed = JSON.parse(raw) }
    catch {
      // Respuesta cortada: devolver el texto parcial en lugar de 500
      return res.status(200).json({
        respuesta: {
          draftHtml: raw.replace(/^[\s\S]*?"draftHtml"\s*:\s*"/, '').replace(/"[\s\S]*$/, '').replace(/\\n/g, '<br>') || raw,
          resumen:   'Respuesta generada (puede estar incompleta).',
          articulos: [],
          confianza: 'Baja',
          fuentes:   []
        },
        meta: { articulos_procesados: contextoLegal?.length || 0, modo_aplicado: modo, advertencia: 'JSON truncado' }
      })
    }

    // 4. Verificación cruzada — solo artículos que realmente vienen del contexto
    const articulosValidos = []
    const fuentesValidas   = []
    const articulosBrutos  = Array.isArray(parsed.articulos) ? parsed.articulos : []

    articulosBrutos.forEach(num => {
      const numLimpio = normalizarNum(String(num))
      const coincide  = contextoNorm.find(a => a.numeroLimpio === numLimpio)
      if (coincide) {
        articulosValidos.push(numLimpio)
        fuentesValidas.push(`${fuente || 'Ley'} Art. ${numLimpio}`)
      }
    })

    // 5. Ajuste de confianza final
    let confianzaFinal = 'Alta'
    if (articulosValidos.length === 0) confianzaFinal = 'Baja'
    else if (articulosValidos.length < articulosBrutos.length) confianzaFinal = 'Media'

    parsed.confianza = confianzaFinal
    parsed.articulos = articulosValidos
    parsed.fuentes   = fuentesValidas

    // 6. Respuesta al frontend
    res.status(200).json({
      respuesta: parsed,
      meta: {
        articulos_procesados: contextoLegal?.length || 0,
        modo_aplicado: modo
      }
    })

  } catch (error) {
    console.error("Error en asesoria.js:", error)
    res.status(500).json({
      error: "Error interno en el motor de IA",
      details: error.message
    })
  }
}
