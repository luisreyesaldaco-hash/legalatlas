import { GoogleGenAI } from "@google/genai";
import { buscarArticulos } from "./buscar.js";

export const config = { api: { bodyParser: true } };

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const CPEUM_LEY = 'Constitución Política de los Estados Unidos Mexicanos';

// ISO alpha-2 → display name (add more as needed)
const PAIS_NOMBRES = { MX: 'México', CZ: 'República Checa', CO: 'Colombia', PA: 'Panamá', FR: 'Francia', DE: 'Alemania' };
function nombrePais(iso) { return PAIS_NOMBRES[iso] || iso; }

export default async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { pais, estado, tema, pregunta, fuente, modo } = body;

    // Búsqueda de contexto legal
    let contextoLegal;
    const esMexico = !pais || pais === 'MX';
    if (estado && esMexico) {
      // México con estado: ley estatal (7) + CPEUM (3) en paralelo
      const [ccResults, cpuemResults] = await Promise.allSettled([
        buscarArticulos(pregunta, estado, fuente || 'Código Civil', 7),
        buscarArticulos(pregunta, '', CPEUM_LEY, 3)
      ]);
      contextoLegal = [
        ...(ccResults.status   === 'fulfilled' ? ccResults.value   : []),
        ...(cpuemResults.status === 'fulfilled' ? cpuemResults.value : [])
      ];
    } else if (esMexico) {
      // México federal: solo CPEUM
      contextoLegal = await buscarArticulos(pregunta, '', CPEUM_LEY, 10);
    } else {
      // Otro país: buscar por nombre de ley (fuente)
      contextoLegal = await buscarArticulos(pregunta, '', fuente || '', 10);
    }

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
    const systemPrompt = `Eres APOLO, un asistente legal experto para la jurisdicción de ${jurisdiccion.toUpperCase()}.
Tu objetivo es orientar a ciudadanos sobre sus derechos de forma clara, formal y tranquilizante.

FUENTES CONSULTADAS: ${fuentesActivas}

CONTEXTO LEGAL RECUPERADO:
${leyesTexto}

INSTRUCCIONES:
1. Explica de forma clara usando los artículos del contexto.
2. Cita siempre el número de artículo exacto y la ley de donde proviene.
3. Si la información necesaria no está en los artículos proporcionados, dilo con claridad.
4. Nunca inventes leyes, artículos ni interpretaciones.
5. Responde EXCLUSIVAMENTE en formato JSON con esta estructura:
{
  "draftHtml": "Respuesta en HTML con párrafos y listas si aplica",
  "resumen": "Explicación breve de 2 líneas",
  "articulos": ["2273", "2325"],
  "confianza": "Alta | Media | Baja",
  "fuentes": ["Código Civil Art. 2273", "CPEUM Art. 1"]
}`;

    // 3. Llamada a Gemini Flash
    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: pregunta,
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
