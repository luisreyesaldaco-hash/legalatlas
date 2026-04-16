import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const sig  = req.headers['stripe-signature']
  const body = await buffer(req)

  let event
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } else {
      // Sin webhook secret (desarrollo / configuración pendiente)
      event = JSON.parse(body.toString())
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { receta_id, estado, borrador_id } = session.metadata || {}

    // 1. Leer borrador completo y marcarlo como completado
    if (borrador_id) {
      try {
        const { data: borrador } = await supabase
          .from('borradores_pago')
          .select('documento_html, email, tipo_documento, datos')
          .eq('id', borrador_id)
          .single()

        await supabase
          .from('borradores_pago')
          .update({
            estado:            'completado',
            stripe_session_id: session.id,
            payment_intent_id: session.payment_intent || null
          })
          .eq('id', borrador_id)

        console.log(`Borrador desbloqueado: ${borrador_id}`)

        // 2. Enviar email si hay dirección y documento
        if (borrador?.email && borrador?.documento_html && process.env.RESEND_API_KEY) {
          const nombreUsuario = Object.values(borrador.datos || {}).find(v =>
            typeof v === 'string' && v.length > 2 && v.split(' ').length >= 2
          ) || 'Cliente'
          const tipoDoc = (borrador.tipo_documento || 'documento').replace(/_/g, ' ')
          const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.legalatlas.io'

          const resendRes = await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type':  'application/json'
            },
            body: JSON.stringify({
              from:    'Legal Atlas <documentos@legalatlas.io>',
              to:      [borrador.email],
              subject: `Tu ${tipoDoc} está listo — Legal Atlas`,
              html: `
                <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px;background:#f5edd8;color:#1a1508;">
                  <h2 style="font-family:Georgia,serif;color:#8a6820;letter-spacing:0.1em;margin-bottom:8px;">LEGAL ATLAS</h2>
                  <p style="color:#5a4a28;font-size:13px;margin-bottom:24px;letter-spacing:0.05em;">APOLO · Asistente Legal</p>
                  <p>Hola <strong>${nombreUsuario}</strong>,</p>
                  <p>Tu <strong>${tipoDoc}</strong> ha sido generado exitosamente. Puedes descargarlo en cualquier momento desde el siguiente enlace:</p>
                  <div style="text-align:center;margin:32px 0;">
                    <a href="${baseUrl}/ciudadano.html?pago=exitoso&session_id=${session.id}"
                       style="background:#8a6820;color:#f5edd8;padding:14px 32px;border-radius:8px;text-decoration:none;font-family:Georgia,serif;font-size:14px;letter-spacing:0.1em;">
                      Descargar documento
                    </a>
                  </div>
                  <hr style="border:none;border-top:1px solid rgba(138,104,32,0.2);margin:24px 0;">
                  <p style="font-size:12px;color:#8a7060;font-style:italic;">
                    Este documento es orientativo. Para mayor seguridad jurídica se recomienda revisarlo con un abogado.
                  </p>
                </div>
              `
            })
          })
          if (!resendRes.ok) {
            const resendError = await resendRes.json()
            console.error('Resend error:', resendRes.status, resendError)
            throw new Error(`Resend ${resendRes.status}: ${JSON.stringify(resendError)}`)
          }
          console.log('Email enviado correctamente a:', borrador.email)
        }

      } catch (borradorErr) {
        console.error('Error en borrador/email:', borradorErr.message)
      }
    }

    // 2. Registrar en tabla pagos (historial)
    try {
      await supabase.from('pagos').insert({
        stripe_session_id: session.id,
        receta_id:         receta_id || null,
        estado:            estado    || null,
        monto:             (session.amount_total || 0) / 100,
        moneda:            session.currency || 'mxn',
        datos_usuario:     {},
        pagado:            true,
        created_at:        new Date().toISOString()
      })
      console.log(`Pago registrado: ${session.id} — ${receta_id} — $${(session.amount_total / 100)} MXN`)
    } catch (dbErr) {
      console.error('Error registrando pago en Supabase:', dbErr.message)
    }

    // 3. Guardar en corpus anonimizado — secundario, nunca interrumpe
    if (borrador_id) {
      try {
        const { data: borradorCorpus } = await supabase
          .from('borradores_pago')
          .select('documento_html, tipo_documento, datos')
          .eq('id', borrador_id)
          .single()

        if (borradorCorpus?.documento_html) {
          await anonimizarYGuardar(
            borradorCorpus.documento_html,
            borradorCorpus.tipo_documento,
            borradorCorpus.datos?.estado,
            (session.amount_total || 0) / 100
          )
        }
      } catch (corpusErr) {
        console.error('Error guardando en corpus — no crítico:', corpusErr.message)
      }
    }
  }

  res.json({ received: true })
}

async function anonimizarYGuardar(documentoHtml, tipoDocumento, estado, precioMxn) {
  const textoLimpio = documentoHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+ [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\b/g, 'NOMBRE')
    .replace(/\$[\d,]+(\.\d{2})?\s*(MXN|USD)?/g, 'MONTO')
    .replace(/\b\d{1,2} de \w+ de \d{4}\b/g, 'FECHA')
    .replace(/\b[A-Z0-9]{17}\b/g, 'NIV')
    .replace(/[A-Z]{3}-\d{3}-[A-Z]\b/g, 'PLACAS')
    .replace(/C\.P\.\s*\d{5}/g, 'CP')
    .replace(/\b\d{10}\b/g, 'TELEFONO')
    .trim()

  const embeddingRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:   'models/gemini-embedding-001',
        content: { parts: [{ text: textoLimpio }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 1536
      })
    }
  )
  const embeddingData = await embeddingRes.json()
  const embedding = embeddingData.embedding?.values

  await supabase.from('contratos_corpus').insert({
    tipo_documento:        tipoDocumento,
    estado:                estado || null,
    contrato_anonimizado:  textoLimpio,
    embedding:             embedding || null,
    precio_mxn:            Math.round(precioMxn)
  })
  console.log(`Corpus: contrato guardado — ${tipoDocumento} / ${estado}`)
}

async function buffer(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}
