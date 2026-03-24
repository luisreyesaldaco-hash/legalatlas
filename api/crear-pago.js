import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    const { receta_id, precio_mxn, titulo, datos_usuario, estado, documento_html } = body

    if (!receta_id || !precio_mxn) {
      return res.status(400).json({ error: 'Se requiere receta_id y precio_mxn' })
    }

    // 1. Guardar borrador en Supabase — fuente de verdad antes del redirect
    const { data: borrador, error: borradorErr } = await supabase
      .from('borradores_pago')
      .insert({
        tipo_documento: receta_id,
        datos:          datos_usuario || {},
        documento_html: documento_html || null,
        estado:         'pendiente'
      })
      .select('id')
      .single()

    if (borradorErr) throw borradorErr

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.legalatlas.io'

    // 2. Crear sesión Stripe — solo borrador_id en metadata, sin datos sensibles
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: titulo || receta_id.replace(/_/g, ' '),
            description: `Generado por APOLO · Legal Atlas${estado ? ' · ' + estado : ''}`
          },
          unit_amount: precio_mxn * 100
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${baseUrl}/ciudadano.html?pago=exitoso&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/ciudadano.html?pago=cancelado`,
      metadata: {
        receta_id,
        estado:      estado || '',
        borrador_id: borrador.id
      }
    })

    res.status(200).json({ url: session.url, session_id: session.id })

  } catch (error) {
    console.error('Error en crear-pago.js:', error)
    res.status(500).json({ error: 'Error creando sesión de pago', details: error.message })
  }
}
