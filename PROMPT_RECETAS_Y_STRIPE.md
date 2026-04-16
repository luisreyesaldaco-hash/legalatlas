# TAREA: Recetas prioritarias + Stripe — Legal Atlas
## Para Claude Code — leer CONTEXTO_LEGAL_ATLAS.md primero

---

## CONTEXTO RÁPIDO

Legal Atlas tiene un modo redacción donde Apolo genera documentos legales
basados en artículos reales de Supabase. Ya existe:
- `api/redactar.js` — endpoint que genera documentos con Gemini 2.5 Flash
- `recetas/carta_requerimiento_pago.json` — primera receta funcionando
- El frontend ciudadano con botón de modo redacción

Lo que hay que construir ahora:
1. Las 6 recetas restantes
2. Stripe para cobrar por cada documento generado

---

## PARTE 1 — RECETAS PRIORITARIAS MÉXICO

Crea estos archivos en la carpeta `/recetas/`:

### Receta 1: `pagare.json`

El pagaré es título ejecutivo — regulado por la Ley General de Títulos
y Operaciones de Crédito (LGTOC), no por el Código Civil.

Elementos OBLIGATORIOS por ley (si falta uno, no es pagaré válido):
1. La palabra "PAGARÉ" visible en el documento
2. Lugar y fecha de suscripción
3. Promesa INCONDICIONAL de pagar (no condicional)
4. Monto en número Y en letra
5. Fecha de vencimiento (o "a la vista")
6. Nombre del beneficiario (a cuya orden se paga)
7. Lugar de pago
8. Nombre y firma del suscriptor (deudor)

Datos requeridos al usuario:
- nombre_suscriptor (quien debe — el deudor)
- nombre_beneficiario (quien cobra — el acreedor)
- monto_numero (ej: 15000)
- monto_letra (ej: QUINCE MIL PESOS 00/100 M.N.)
- fecha_vencimiento (dropdown: fecha específica / a la vista / X días)
- lugar_suscripcion
- lugar_pago

Preguntas profundidad (opcionales):
- ¿Hay intereses moratorios pactados? ¿A qué tasa?
- ¿Es a la orden o no negociable?

System prompt especial: el pagaré NO es narrativo — es un formulario
legal estructurado. Gemini debe generarlo como documento formal centrado,
no como carta. Formato típico:

```
                    PAGARÉ

Por este pagaré me obligo a pagar...
```

Precio sugerido: $199 MXN (~$10 USD)
Ley aplicable: LGTOC federal (aplica en todos los estados)

---

### Receta 2: `contrato_arrendamiento.json`

Contrato de arrendamiento de casa habitación entre particulares.

Datos requeridos:
- nombre_arrendador (propietario)
- nombre_arrendatario (inquilino)
- domicilio_inmueble (dirección completa)
- monto_renta (mensual)
- monto_deposito (generalmente 1-2 meses de renta)
- fecha_inicio
- duracion_meses (dropdown: 6, 12, 24 meses o indefinido)
- estado (para citar el CC correcto)

Preguntas profundidad:
- ¿Incluye servicios? ¿Cuáles?
- ¿Se permite subarrendar?
- ¿Hay inventario de muebles?

Secciones del contrato:
1. Declaraciones (datos de las partes)
2. Objeto del contrato (descripción del inmueble)
3. Vigencia
4. Renta y forma de pago
5. Depósito en garantía
6. Obligaciones del arrendador
7. Obligaciones del arrendatario
8. Causas de rescisión
9. Fundamento legal (artículos del CC del estado)
10. Firmas

Precio sugerido: $299 MXN (~$15 USD)

---

### Receta 3: `contrato_compraventa_auto.json`

Compraventa de vehículo entre particulares.

Datos requeridos:
- nombre_vendedor
- nombre_comprador
- marca_auto
- modelo_auto
- anio_auto
- color_auto
- numero_serie (NIV)
- numero_placas
- numero_motor
- precio_venta (número y letra)
- forma_pago (contado / parcialidades)
- estado (jurisdicción)

Secciones:
1. Datos de las partes
2. Descripción del vehículo
3. Precio y forma de pago
4. Declaración de propiedad libre de gravámenes
5. Entrega del vehículo y documentación
6. Responsabilidades post-venta
7. Fundamento legal
8. Firmas ante testigos

Precio sugerido: $249 MXN (~$12 USD)

---

### Receta 4: `contrato_prestacion_servicios.json`

Contrato de prestación de servicios profesionales (freelance, consultoría).

Datos requeridos:
- nombre_prestador (quien da el servicio)
- nombre_cliente (quien recibe)
- descripcion_servicio
- monto_honorarios
- forma_pago (única, mensual, por entregable)
- fecha_inicio
- fecha_fin (o duración en meses)
- estado

Preguntas profundidad:
- ¿Incluye cláusula de confidencialidad?
- ¿Los entregables tienen derechos de autor?
- ¿Hay penalización por cancelación anticipada?

Precio sugerido: $199 MXN (~$10 USD)

---

### Receta 5: `carta_poder_simple.json`

Carta poder simple para trámites (NO equivale a poder notarial).

Datos requeridos:
- nombre_poderdante (quien otorga el poder)
- nombre_apoderado (quien recibe el poder)
- descripcion_facultades (qué puede hacer exactamente)
- vigencia (fecha límite o "hasta revocación")
- tramite_especifico (opcional: SAT, banco, IMSS, etc.)

Nota importante en el documento generado:
"Esta carta poder es para trámites administrativos.
Para actos jurídicos formales (compraventa de inmuebles,
representación judicial) se requiere poder notarial."

Precio sugerido: $99 MXN (~$5 USD)

---

### Receta 6: `contrato_prestamo_dinero.json`

Contrato de mutuo (préstamo de dinero) entre particulares.

Datos requeridos:
- nombre_prestamista (quien presta)
- nombre_deudor (quien recibe)
- monto (número y letra)
- fecha_entrega
- fecha_devolucion
- genera_intereses (sí/no)
- tasa_interes (si aplica, % mensual)
- estado

Precio sugerido: $149 MXN (~$7 USD)

---

## PARTE 2 — STRIPE INTEGRATION

### Variables de entorno a agregar en Vercel:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Para desarrollo usar keys de test:
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Instalar:
```bash
npm install stripe @stripe/stripe-js
```

### Crear: `api/crear-pago.js`

```javascript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  const { receta_id, precio_mxn, datos_usuario, estado } = req.body

  // Precio en centavos (Stripe usa centavos)
  const monto_centavos = precio_mxn * 100

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'mxn',
        product_data: {
          name: `Documento Legal — ${receta_id.replace(/_/g, ' ')}`,
          description: `Generado por APOLO · Legal Atlas · ${estado}`
        },
        unit_amount: monto_centavos,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/ciudadano.html?pago=exitoso&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/ciudadano.html?pago=cancelado`,
    metadata: {
      receta_id,
      estado,
      datos_usuario: JSON.stringify(datos_usuario)
    }
  })

  res.status(200).json({ url: session.url, session_id: session.id })
}
```

### Crear: `api/webhook-stripe.js`

```javascript
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  const sig = req.headers['stripe-signature']
  const body = await buffer(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { receta_id, estado, datos_usuario } = session.metadata

    // Registrar pago en Supabase
    await supabase.from('pagos').insert({
      stripe_session_id: session.id,
      receta_id,
      estado,
      monto: session.amount_total / 100,
      moneda: session.currency,
      datos_usuario: JSON.parse(datos_usuario),
      pagado: true,
      created_at: new Date().toISOString()
    })
  }

  res.json({ received: true })
}

async function buffer(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}
```

### SQL en Supabase — crear tabla pagos:

```sql
CREATE TABLE IF NOT EXISTS pagos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE,
  receta_id         TEXT,
  estado            TEXT,
  monto             DECIMAL,
  moneda            TEXT DEFAULT 'mxn',
  datos_usuario     JSONB,
  documento_html    TEXT,
  pagado            BOOLEAN DEFAULT false,
  created_at        TIMESTAMP DEFAULT now()
);

ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo service role puede leer pagos"
ON pagos FOR ALL
USING (auth.role() = 'service_role');
```

### Flujo completo en ciudadano.html:

```
1. Usuario completa preguntas conversacionales de la receta
2. Apolo muestra preview: "Tu documento está listo. Precio: $199 MXN"
3. Botón "Pagar y Descargar" → llama POST /api/crear-pago
4. Stripe redirige a checkout
5. Usuario paga con tarjeta
6. Stripe webhook registra el pago en tabla pagos
7. Stripe redirige a success_url con session_id
8. Frontend detecta ?pago=exitoso → llama POST /api/redactar con los datos
9. Apolo genera el documento
10. Botón "Descargar DOCX" disponible
```

---

## PARTE 3 — PRECIOS EN MXN (no USD)

Cambia todos los precios a pesos mexicanos:

| Documento | Precio MXN | USD aprox |
|---|---|---|
| Carta poder simple | $99 | ~$5 |
| Carta requerimiento pago | $149 | ~$7 |
| Pagaré | $199 | ~$10 |
| Contrato préstamo dinero | $149 | ~$7 |
| Contrato prestación servicios | $199 | ~$10 |
| Contrato compraventa auto | $249 | ~$12 |
| Contrato arrendamiento | $299 | ~$15 |

---

## ORDEN DE EJECUCIÓN

1. Crea las 6 recetas JSON en `/recetas/`
2. Verifica que `api/redactar.js` lee dinámicamente cualquier receta de esa carpeta
3. Crea `api/crear-pago.js`
4. Crea `api/webhook-stripe.js`
5. Crea tabla `pagos` en Supabase con el SQL de arriba
6. Actualiza ciudadano.html con el flujo de pago completo
7. Agrega las variables de entorno en Vercel

## TESTS A CORRER AL TERMINAR

```bash
# Test 1: Lista de recetas disponibles
curl https://www.legalatlas.io/api/redactar

# Test 2: Generar pagaré
curl -X POST https://www.legalatlas.io/api/redactar \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "pagare",
    "datos": {
      "nombre_suscriptor": "Juan Pérez",
      "nombre_beneficiario": "María García",
      "monto_numero": "5000",
      "monto_letra": "CINCO MIL PESOS 00/100 M.N.",
      "fecha_vencimiento": "2026-06-01",
      "lugar_suscripcion": "Puebla, Pue.",
      "lugar_pago": "Puebla, Pue."
    },
    "estado": "Puebla"
  }'

# Test 3: Crear sesión de pago Stripe (test mode)
curl -X POST https://www.legalatlas.io/api/crear-pago \
  -H "Content-Type: application/json" \
  -d '{
    "receta_id": "pagare",
    "precio_mxn": 199,
    "estado": "Puebla",
    "datos_usuario": { "nombre_suscriptor": "Juan Pérez" }
  }'
```

## NO TOQUES
- buscar.js
- asesoria.js
- embedder.py
- preparador_embeddings.py
- La tabla articulos en Supabase

Confirma cada paso antes de continuar al siguiente.
