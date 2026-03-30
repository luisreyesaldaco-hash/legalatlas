import { GoogleGenAI } from "@google/genai";
import { buscarArticulos } from "./buscar.js";

export const config = { api: { bodyParser: true } };

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const CPEUM_LEY = 'Constitución Política de los Estados Unidos Mexicanos';

// ISO alpha-2 → display name (add more as needed)
const PAIS_NOMBRES = { MX: 'México', CZ: 'República Checa', CO: 'Colombia', PA: 'Panamá', FR: 'Francia', DE: 'Alemania' };
function nombrePais(iso) { return PAIS_NOMBRES[iso] || iso; }

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

    // Búsqueda de contexto legal + detección de escalación en paralelo
    let contextoLegal;
    const esMexico = !pais || pais === 'MX';

    let ragPromise;
    if (estado && esMexico) {
      ragPromise = Promise.allSettled([
        buscarArticulos(pregunta, estado, fuente || 'Código Civil', 7),
        buscarArticulos(pregunta, '', CPEUM_LEY, 3)
      ]).then(([ccResults, cpuemResults]) => [
        ...(ccResults.status   === 'fulfilled' ? ccResults.value   : []),
        ...(cpuemResults.status === 'fulfilled' ? cpuemResults.value : [])
      ]);
    } else if (esMexico) {
      ragPromise = buscarArticulos(pregunta, '', CPEUM_LEY, 10);
    } else {
      ragPromise = buscarArticulos(pregunta, '', fuente || '', 10);
    }

    const [contextoLegalResult, requiereAbogado] = await Promise.all([
      ragPromise,
      detectarEscalacion(pregunta)
    ]);
    contextoLegal = contextoLegalResult;

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

    const fuentesActivas = estado
      ? `${fuente || 'Código Civil'} de ${estado} y ${CPEUM_LEY}`
      : esMexico ? CPEUM_LEY : (fuente || 'Ley seleccionada');

    // 2. System prompt de Apolo
    const paisDisplay  = nombrePais(pais || 'MX');
    const jurisdiccion = estado ? `${estado}, ${paisDisplay}` : `${paisDisplay} (Federal)`;
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
- Habla como un amigo que sabe derecho, no como un abogado en audiencia
- Frases cortas. Máximo 2 líneas por párrafo
- Si usas un término legal, explícalo entre paréntesis
- NUNCA uses: "en virtud de", "de conformidad con", "el suscrito"
- Siempre termina con un paso concreto que el usuario puede hacer hoy
- Usa "tú" no "usted"
`;

    const alcancePrompt = alcance === 'articulo'
      ? 'Responde enfocándote en el artículo activo proporcionado y sus relaciones con otros artículos del mismo código.'
      : 'Responde con una visión amplia del tema dentro de la ley activa, citando los artículos más relevantes.';

    const systemPrompt = `Eres APOLO, un asistente legal experto para la jurisdicción de ${jurisdiccion.toUpperCase()}.
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
5. REGLA DE IDIOMA: Responde SIEMPRE en el mismo idioma en que el usuario escribió su pregunta. Si pregunta en checo, responde en checo. Si pregunta en español, responde en español.
6. Responde EXCLUSIVAMENTE en formato JSON con esta estructura:
${instruccionEscalacion}
{
  "draftHtml": "Respuesta en HTML con párrafos y listas si aplica",
  "resumen": "Explicación breve de 2 líneas",
  "articulos": ["2273", "2325"],
  "confianza": "Alta | Media | Baja",
  "fuentes": ["Código Civil Art. 2273", "CPEUM Art. 1"]
}`;

    // 3. Llamada a Gemini Flash
    const mensajes = historial?.length > 0
      ? [
          ...historial.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: pregunta }] }
        ]
      : pregunta;

    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: mensajes,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType:  'application/json',
        temperature:       0.1,
        maxOutputTokens:   4000
      }
    })

    const raw = geminiResponse.text
    if (!raw) throw new Error('Gemini no devolvió contenido')
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
