# TAREA: Panel B2B — Puerta del Abogado
## Para Claude Code — leer CONTEXTO_LEGAL_ATLAS.md primero

---

## CONTEXTO

Legal Atlas tiene dos puertas: ciudadano (ya funciona) y abogado (construir ahora).
El panel del abogado tiene tres columnas simultáneas en pantalla:

```
| LEY (izquierda) | DIAGRAMA (centro, oculto) | APOLO CHAT (derecha) |
```

---

## ARCHIVO A CREAR: `abogado.html`

### Layout general

Tres columnas en pantalla completa:
- **Columna izquierda (30%)** — navegador de ley colapsable
- **Columna centro (40%)** — área principal: artículo activo + whiteboard SVG (oculto por default)
- **Columna derecha (30%)** — chat Apolo contextual

Misma identidad visual que `ciudadano.html` — pergamino, Cinzel, dorado.

---

## COLUMNA IZQUIERDA — Navegador de ley

### Comportamiento: lazy loading por jerarquía

**Al cargar la página:**
```javascript
// 1. Query SOLO los nivel_primario distintos del estado seleccionado
const { data } = await supabase
  .from('articulos')
  .select('nivel_primario')
  .eq('estado', estadoActivo)
  .eq('ley', leyActiva)
  .not('nivel_primario', 'is', null)

// Mostrar como acordeón colapsado — NO traer artículos todavía
```

**Al expandir un nivel_primario:**
```javascript
// Traer nivel_secundario de esa parte
const { data } = await supabase
  .from('articulos')
  .select('nivel_secundario')
  .eq('estado', estadoActivo)
  .eq('nivel_primario', parteSeleccionada)
```

**Al expandir un nivel_secundario:**
```javascript
// Traer artículos del capítulo — solo id_unico y numero_articulo
const { data } = await supabase
  .from('articulos')
  .select('id_unico, numero_articulo')
  .eq('nivel_secundario', capituloSeleccionado)
  .order('numero_articulo')
```

**Al hacer clic en un artículo:**
```javascript
// Traer el artículo completo
const { data } = await supabase
  .from('articulos')
  .select('*')
  .eq('id_unico', idSeleccionado)
  .single()

// Este artículo se convierte en "contexto activo"
// Aparece en columna centro
// Se inyecta al chat de Apolo como contexto
```

### Controles del navegador
- Dropdown: seleccionar estado (todos los estados disponibles en Supabase)
- Dropdown: seleccionar ley (Código Civil, Constitución, etc.)
- Input: buscar artículo por número exacto (ej: "2398")
- Todos los niveles colapsados por default

---

## COLUMNA CENTRO — Artículo activo + Whiteboard

### Estado default: artículo activo

Cuando el abogado hace clic en un artículo, mostrar:
```
[Número del artículo — grande]
[Jerarquía: Parte > Título > Capítulo]
[Texto completo del artículo]
[Botón: "✦ Explícame este capítulo"]
[Botón: "✍ Redactar con este artículo"]
```

### Botón "Explícame este capítulo" → genera whiteboard

```javascript
async function explicarCapitulo(nivel_secundario, estado, ley) {

  // 1. Verificar si ya existe diagrama guardado
  const { data: existente } = await supabase
    .from('diagramas')
    .select('svg_content')
    .eq('nivel_secundario', nivel_secundario)
    .eq('estado', estado)
    .single()

  if (existente) {
    mostrarWhiteboard(existente.svg_content)
    return
  }

  // 2. Traer todos los artículos del capítulo
  const { data: articulos } = await supabase
    .from('articulos')
    .select('numero_articulo, texto_original')
    .eq('nivel_secundario', nivel_secundario)
    .eq('estado', estado)
    .order('numero_articulo')

  // 3. Pedir a Gemini que genere el diagrama
  const prompt = `
Analiza estos artículos del capítulo "${nivel_secundario}" 
del ${ley} de ${estado} y genera un diagrama de flujo 
del proceso legal en SVG puro.

ARTÍCULOS:
${articulos.map(a => `${a.numero_articulo}: ${a.texto_original}`).join('\n\n')}

REGLAS DEL SVG:
- viewBox="0 0 600 400"
- Solo rect, line, text, path — sin imágenes
- Máximo 7 nodos
- Fondo transparente
- Colores: relleno #f5edd8, stroke #8a6820, texto #1a1508
- Muestra el flujo del proceso: quién hace qué, en qué orden
- Responde SOLO con el SVG, sin explicación
`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  )
  const json = await response.json()
  const svg = json.candidates[0].content.parts[0].text

  // 4. Guardar en Supabase para no regenerar
  await supabase.from('diagramas').insert({
    nivel_secundario,
    estado,
    ley,
    svg_content: svg,
    created_at: new Date().toISOString()
  })

  mostrarWhiteboard(svg)
}

function mostrarWhiteboard(svg) {
  // Ocultar texto del artículo
  // Mostrar el SVG en columna centro
  // Botón "← Volver al artículo"
  document.getElementById('whiteboard').innerHTML = svg
  document.getElementById('whiteboard').style.display = 'block'
  document.getElementById('articulo-vista').style.display = 'none'
}
```

---

## SQL — Crear tabla diagramas en Supabase

```sql
CREATE TABLE IF NOT EXISTS diagramas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel_secundario  TEXT NOT NULL,
  estado            TEXT NOT NULL,
  ley               TEXT NOT NULL,
  svg_content       TEXT NOT NULL,
  created_at        TIMESTAMP DEFAULT now(),
  UNIQUE(nivel_secundario, estado, ley)
);

ALTER TABLE diagramas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura publica de diagramas"
ON diagramas FOR SELECT USING (true);

CREATE POLICY "Solo service role escribe diagramas"
ON diagramas FOR INSERT
USING (auth.role() = 'service_role');
```

---

## COLUMNA DERECHA — Chat Apolo contextual

### Sistema de contexto en tres capas

```javascript
function construirContextoApolo(articuloActivo, capituloArticulos) {
  return `
Eres APOLO, asistente legal para abogados profesionales.
El abogado está consultando el ${articuloActivo.ley} de ${articuloActivo.estado}.

ARTÍCULO ACTIVO:
${articuloActivo.numero_articulo}: ${articuloActivo.texto_original}

CAPÍTULO ACTIVO: "${articuloActivo.nivel_secundario}"
Artículos del capítulo disponibles:
${capituloArticulos.map(a => `${a.numero_articulo}`).join(', ')}

INSTRUCCIONES:
- Responde con precisión jurídica — este usuario es abogado
- Cita siempre el número de artículo exacto
- Si la pregunta sale del capítulo activo, indícalo y responde igual
- Puedes hacer búsqueda semántica si necesitas artículos de otros capítulos
- Responde en el idioma en que te pregunten
`
}
```

### Comportamiento del chat
- Input en la parte inferior de la columna derecha
- Historial de la conversación en la columna
- Cuando el abogado cambia de artículo → el contexto se actualiza automáticamente
- El chat mantiene historial de la sesión (no persistente entre sesiones)
- Llama a `api/asesoria.js` existente con el contexto construido arriba

---

## BÚSQUEDA RÁPIDA POR NÚMERO

En la columna izquierda, input de búsqueda:

```javascript
async function buscarPorNumero(numero, estado, ley) {
  const { data } = await supabase
    .from('articulos')
    .select('*')
    .eq('estado', estado)
    .eq('ley', ley)
    .ilike('numero_articulo', `%${numero}%`)
    .limit(10)

  // Mostrar resultados como lista
  // Al hacer clic → activa ese artículo en columna centro
}
```

---

## VARIABLES DE ENTORNO NECESARIAS
Todas ya existen en Vercel:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GOOGLE_API_KEY`

---

## ORDEN DE EJECUCIÓN

1. Crea tabla `diagramas` en Supabase con el SQL de arriba
2. Crea `abogado.html` con el layout de tres columnas
3. Implementa lazy loading del navegador de ley
4. Implementa artículo activo en columna centro
5. Implementa botón "Explícame" con generación y caché de SVG
6. Implementa chat Apolo con contexto de tres capas
7. Implementa búsqueda por número de artículo

## TEST AL TERMINAR

1. Abrir abogado.html
2. Seleccionar Puebla → Código Civil
3. Expandir LIBRO PRIMERO → expandir un título → ver artículos
4. Hacer clic en Art. 2398
5. Verificar que aparece en columna centro
6. Presionar "Explícame este capítulo"
7. Verificar que aparece SVG (primera vez tarda ~3s)
8. Volver a presionar "Explícame" → debe aparecer instantáneo (desde caché)
9. Preguntar en el chat: "¿Qué pasa si el inquilino no paga?"
10. Verificar que Apolo cita artículos reales del capítulo activo

## NO TOQUES
- ciudadano.html
- api/buscar.js
- api/asesoria.js
- La tabla articulos en Supabase
- embedder.py
- preparador_embeddings.py
