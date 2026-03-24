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

    // 1. Marcar borrador como completado — desbloquea el documento al usuario
    if (borrador_id) {
      try {
        await supabase
          .from('borradores_pago')
          .update({
            estado:            'completado',
            stripe_session_id: session.id,
            payment_intent_id: session.payment_intent || null
          })
          .eq('id', borrador_id)
        console.log(`Borrador desbloqueado: ${borrador_id}`)
      } catch (borradorErr) {
        console.error('Error actualizando borrador:', borradorErr.message)
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
  }

  res.json({ received: true })
}

async function buffer(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}
