import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'
import fs from 'fs'

// Lazy-load CJS packages to avoid Vercel bundler issues
let _formidable, _pdfParse, _mammoth
async function loadFormidable() {
  if (!_formidable) {
    const fm = await import('formidable')
    _formidable = fm.formidable ?? fm.default
  }
}
async function loadPdfParse() {
  if (!_pdfParse) {
    const pp = await import('pdf-parse')
    _pdfParse = pp.default ?? pp
  }
}
async function loadMammoth() {
  if (!_mammoth) {
    const mm = await import('mammoth')
    _mammoth = mm.default ?? mm
  }
}

// bodyParser: false — necesario para que formidable lea multipart
export const config = { api: { bodyParser: false } }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
async function llmWithRetry(llm, params, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      return await llm.generateContent(params)
    } catch (err) {
      const transient = err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE') || err?.message?.includes('high demand')
      if (transient && i < retries - 1) { await sleep(1000 * (i + 1)); continue }
      throw err
    }
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // ── GET existente — sin cambios ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { session_id } = req.query
    if (!session_id) return res.status(400).json({ error: 'session_id requerido' })

    const { data, error } = await supabase
      .from('borradores_pago')
      .select('documento_html, tipo_documento, estado')
      .eq('stripe_session_id', session_id)
      .eq('estado', 'completado')
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Documento no encontrado o pago no confirmado aún' })
    }

    return res.status(200).json({ html: data.documento_html, tipo: data.tipo_documento })
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (req.method === 'OPTIONS') return res.status(200).end()
    const { action } = req.query
    if (action === 'analizar') return auditorContrato(req, res)
    return res.status(400).json({ error: 'action inválida' })
  }

  return res.status(405).json({ error: 'Método no permitido' })
}

// ── Auditor principal ─────────────────────────────────────────────────────
async function auditorContrato(req, res) {
  try {
    const { texto, pais } = await parsearArchivo(req)

    if (!texto || texto.length < 200) {
      return res.status(400).json({ error: 'No se pudo extraer texto suficiente del documento.' })
    }

    const llm = ai.models

    // 1.5 — Anonimizar
    const textoAnonimizado = await anonimizar(texto, llm)

    // 2 — Identificar cláusulas
    const clausulas = await identificarClausulas(textoAnonimizado, llm)
    if (!clausulas.length) {
      return res.status(400).json({ error: 'No se pudieron identificar cláusulas en el documento.' })
    }

    // 3 — Analizar en lotes de 5
    const BATCH = 5
    const clausulasAnalizadas = []
    for (let i = 0; i < clausulas.length; i += BATCH) {
      const lote = clausulas.slice(i, i + BATCH)
      const resultados = await Promise.all(lote.map(c => analizarClausula(c, pais, llm)))
      clausulasAnalizadas.push(...resultados)
    }

    // 4 — Resumen ejecutivo
    const resumen = await generarResumen(clausulasAnalizadas, llm)

    // 5 — Guardar en contratos_corpus
    const invalidas = clausulasAnalizadas.filter(c => c.estado === 'invalida').length
    const riesgo    = clausulasAnalizadas.filter(c => c.estado === 'riesgo').length

    await supabase.from('contratos_corpus').insert({
      tipo_documento:       resumen.tipo_contrato,
      estado:               'analizado',
      contrato_anonimizado: textoAnonimizado,
      pais,
      analisis_json: { clausulas: clausulasAnalizadas, resumen },
      num_clausulas:        clausulas.length,
      clausulas_riesgo:     riesgo,
      clausulas_invalidas:  invalidas
    })

    return res.json({
      ok: true,
      tipo_contrato:       resumen.tipo_contrato,
      total_clausulas:     clausulas.length,
      clausulas_validas:   clausulas.length - invalidas - riesgo,
      clausulas_riesgo:    riesgo,
      clausulas_invalidas: invalidas,
      clausulas:           clausulasAnalizadas,
      resumen:             resumen.texto
    })

  } catch (err) {
    console.error('auditorContrato error:', err)
    return res.status(500).json({ error: 'Error interno al analizar el contrato.', detail: err.message })
  }
}

// ── Parsear PDF o DOCX ─────────────────────────────────────────────────────
async function parsearArchivo(req) {
  await loadFormidable()
  return new Promise((resolve, reject) => {
    const form = _formidable({ maxFileSize: 10 * 1024 * 1024 })
    form.parse(req, async (err, fields, files) => {
      if (err) return reject(err)
      const archivo = Array.isArray(files.archivo) ? files.archivo[0] : files.archivo
      if (!archivo) return reject(new Error('Sin archivo'))

      const pais   = Array.isArray(fields.pais) ? fields.pais[0] : (fields.pais || 'MX')
      const buffer = fs.readFileSync(archivo.filepath)
      const mime   = archivo.mimetype || ''
      let texto    = ''

      try {
        if (mime.includes('pdf')) {
          await loadPdfParse()
          const data = await _pdfParse(buffer)
          texto = data.text
        } else if (
          mime.includes('wordprocessingml') ||
          mime.includes('docx') ||
          archivo.originalFilename?.endsWith('.docx')
        ) {
          await loadMammoth()
          const result = await _mammoth.extractRawText({ buffer })
          texto = result.value
        } else if (
          mime.includes('text/plain') ||
          archivo.originalFilename?.endsWith('.txt')
        ) {
          texto = buffer.toString('utf-8')
        } else {
          return reject(new Error('Formato no soportado. Usa PDF, DOCX o TXT.'))
        }
        resolve({ texto, pais })
      } catch (e) {
        reject(e)
      }
    })
  })
}

// ── Anonimizar datos personales ───────────────────────────────────────────
async function anonimizar(texto, llm) {
  const resp = await llmWithRetry(llm, {
    model: 'gemini-2.5-flash',
    contents: `Anonimiza este contrato.
Reemplaza TODOS los datos personales:
- Nombres de personas → [PERSONA_1], [PERSONA_2]...
- RFC, CURP, pasaporte, INE → [ID_1], [ID_2]...
- Direcciones → [DOMICILIO_1], [DOMICILIO_2]...
- Teléfonos → [TEL_1]...
- Emails → [EMAIL_1]...
- Cuentas bancarias, CLABEs → [CUENTA_1]...
- Nombres de empresas → [EMPRESA_1], [EMPRESA_2]...

IMPORTANTE:
- Mantén INTACTA la estructura legal
- Mantén todos los artículos y cláusulas
- Sé consistente: misma persona = mismo token
- Devuelve SOLO el texto anonimizado

Contrato:
${texto.slice(0, 8000)}`,
    config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 4000 }
  })
  return resp.text
}

// ── Identificar cláusulas ─────────────────────────────────────────────────
async function identificarClausulas(texto, llm) {
  const resp = await llmWithRetry(llm, {
    model: 'gemini-2.5-flash',
    contents: `Identifica cada cláusula de este contrato.
Devuelve SOLO JSON sin markdown:
{"clausulas":[{"numero":1,"titulo":"...","texto":"..."}]}

Contrato:
${texto.slice(0, 8000)}`,
    config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 3000 }
  })
  try {
    const { clausulas } = JSON.parse(resp.text?.trim())
    return clausulas || []
  } catch {
    return []
  }
}

// ── Analizar cláusula con RAG ─────────────────────────────────────────────
async function analizarClausula(clausula, pais, llm) {
  try {
    // Embeddear
    const embedResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: clausula.texto }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: 1536
        })
      }
    )
    if (!embedResp.ok) throw new Error(`Embedding error ${embedResp.status}`)
    const { embedding } = await embedResp.json()

    // RAG — buscar en todos los niveles disponibles para este país
    const NIVELES = pais === 'MX' ? [1, 2, 3] : pais === 'CZ' ? [1, 2] : [2]
    const busquedas = await Promise.all(
      NIVELES.map(nivel =>
        supabase.rpc('buscar_marco_universal', {
          query_embedding: embedding.values,
          pais_filter:     pais,
          nivel_filter:    nivel,
          estado_filter:   null,
          match_count:     2
        }).then(r => r.data || [])
      )
    )
    // Deduplicar por id, quedarse con la similitud más alta
    const mapa = new Map()
    busquedas.flat().forEach(a => {
      const prev = mapa.get(a.id)
      if (!prev || a.similarity > prev.similarity) mapa.set(a.id, a)
    })
    const articulos = Array.from(mapa.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4)

    if (!articulos.length) {
      return { ...clausula, estado: 'sin_referencias', articulos: [], analisis: 'Sin artículos relacionados en el corpus.' }
    }

    const articulosTexto = articulos
      .map(a => `${a.numero_articulo} (${a.ley}): ${(a.texto_original || '').slice(0, 300)}`)
      .join('\n\n')

    const resp = await llmWithRetry(llm, {
      model: 'gemini-2.5-flash',
      contents: `Analiza esta cláusula contra los artículos legales.

Cláusula ${clausula.numero}: "${clausula.titulo}"
"${clausula.texto}"

Artículos relevantes:
${articulosTexto}

Determina si la cláusula es válida, tiene riesgo o es inválida según la ley citada.
Devuelve SOLO JSON sin markdown:
{"estado":"valida|riesgo|invalida","analisis":"2-3 oraciones explicando por qué","articulo_clave":"Art. X — Nombre de la Ley"}`,
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 500 }
    })

    const analisis = JSON.parse(resp.text?.trim())
    return {
      ...clausula,
      estado:         analisis.estado,
      analisis:       analisis.analisis,
      articulo_clave: analisis.articulo_clave,
      articulos: articulos.map(a => ({
        numero:    a.numero_articulo,
        ley:       a.ley,
        similitud: Math.round((a.similarity || 0) * 100)
      }))
    }
  } catch {
    return { ...clausula, estado: 'sin_referencias', articulos: [], analisis: 'Error al analizar esta cláusula.' }
  }
}

// ── Resumen ejecutivo ─────────────────────────────────────────────────────
async function generarResumen(clausulas, llm) {
  const problematicas = clausulas
    .filter(c => c.estado !== 'valida')
    .map(c => `Cláusula ${c.numero}: ${c.analisis}`)
    .join('\n')

  const resp = await llmWithRetry(llm, {
    model: 'gemini-2.5-flash',
    contents: `Eres Apolo. Genera un resumen ejecutivo del contrato.

Cláusulas analizadas: ${clausulas.length}
Inválidas: ${clausulas.filter(c => c.estado === 'invalida').length}
Con riesgo: ${clausulas.filter(c => c.estado === 'riesgo').length}

Problemáticas:
${problematicas || 'Ninguna'}

CLASIFICACIÓN DE TIPO (elige uno exacto):
- "arrendamiento" → si habla de arrendamiento de inmueble, renta mensual, arrendador/arrendatario
- "laboral"       → contrato de trabajo, sueldo, empleado/empleador
- "compraventa"   → compra y venta de bien mueble o inmueble
- "servicios"     → prestación de servicios profesionales
- "prestamo"      → préstamo de dinero, pagaré, crédito
- "sociedad"      → constitución de sociedad, socios, capital social
- "confidencialidad" → NDA, información confidencial, secretos industriales
- "otro"          → cualquier otro tipo

Devuelve SOLO JSON sin markdown:
{"tipo_contrato":"arrendamiento|laboral|compraventa|servicios|prestamo|sociedad|confidencialidad|otro","texto":"resumen ejecutivo de 3-4 oraciones"}`,
    config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 500 }
  })

  try {
    return JSON.parse(resp.text?.trim())
  } catch {
    return { tipo_contrato: 'otro', texto: 'Análisis completado.' }
  }
}
