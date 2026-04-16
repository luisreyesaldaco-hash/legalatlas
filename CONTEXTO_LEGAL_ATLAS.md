# Legal Atlas — Contexto Maestro del Proyecto
> Última actualización: 19 de marzo de 2026
> Instrucción: Lee este archivo completo antes de tocar cualquier código.

---

## 1. QUÉ ES ESTE PROYECTO

**Legal Atlas** es una plataforma de consulta legal con RAG real (Retrieval-Augmented Generation). A diferencia de otros chatbots legales, Apolo **no alucina** — cada respuesta está anclada a artículos reales de la ley vigente, extraídos y procesados por un pipeline propio.

El bot se llama **Apolo**. La plataforma se llama **Legal Atlas**.

**Tagline:** *"Navega la ley con claridad"*

---

## 2. LAS DOS PUERTAS

### Puerta 1 — Ciudadano (B2C)
- Usuario sin conocimientos legales
- Pregunta en lenguaje natural: *"me quieren desalojar"*, *"me despidieron sin avisar"*
- Apolo responde en lenguaje simple + cita el artículo real con jerarquía completa
- Si detecta situación de riesgo alto → sugiere conectar con abogado del directorio
- Primera visita: onboarding (quién es Apolo, cómo funciona, 3 pasos)
- Segunda visita: saludo por nombre si se registró con correo

### Puerta 2 — Abogado (B2B)
- Usuario profesional que sabe exactamente qué busca
- Búsqueda por artículo, materia, jurisdicción
- Resultados directos sin explicaciones innecesarias
- Acceso a múltiples jurisdicciones simultáneas
- Sin onboarding — directo al grano
- Suscripción mensual fija (no comisión por cliente)

---

## 3. MODELO DE NEGOCIO

| Segmento | Modelo | Precio |
|---|---|---|
| Ciudadano | Freemium | Gratis / $8 USD/mes |
| Ciudadano | Contratos con RAG | $15-25 USD por documento |
| Abogado independiente | Suscripción fija | $49 USD/mes |
| Despacho mediano | Suscripción fija | $149 USD/mes |
| Despacho grande | Suscripción fija | $299 USD/mes |
| Instituciones / datos | Licencia anual | A negociar |

### El puente B2C → B2B
Cuando Apolo detecta situación de riesgo (*"me quieren quitar a mis hijos"*, *"me desalojan"*), pregunta si el usuario quiere contactar un abogado. Los abogados suscritos aparecen como contactos verificados — su suscripción es implícitamente un sello de calidad.

### Secuencia de lanzamiento recomendada
1. **Fase 1 — B2B primero** (despachos): ingreso rápido, 10 clientes = $2,000-5,000 USD/mes
2. **Fase 2 — B2C** con aprendizaje del B2B
3. **Fase 3 — B2G** cuando haya tracción

---

## 4. STACK TECNOLÓGICO

```
Frontend:     HTML / CSS / JS vanilla (página web existente)
Backend:      Supabase (base de datos + pgvector para embeddings)
Embeddings:   Google text-embedding-004 (créditos CZK 6,000 disponibles)
LLM chat:     Azure GPT-4o mini (ya integrado, API key activa)
Pipeline:     Python (módulos propios del usuario)
Hosting:      Por definir
Control:      GitHub (repo existente)
```

### Flujo RAG completo
```
Usuario pregunta
      ↓
Pregunta se vectoriza (Google text-embedding-004)
      ↓
Supabase pgvector busca por similitud semántica
      ↓
Artículos relevantes recuperados (con metadata)
      ↓
Graph-RAG: si Tiene_Referencias=True → segunda query para artículos referenciados
      ↓
Contexto enviado a Azure GPT-4o mini
      ↓
Apolo responde en lenguaje humano con cita real
```

### Búsqueda híbrida en Supabase
```sql
-- Semántica + filtros duros
SELECT * FROM articulos
WHERE estado = 'San Luis Potosí'
  AND ruta_auditoria != 'RUTA NEGRA'
ORDER BY embedding <=> query_vector
LIMIT 5;
```

---

## 5. PIPELINE DE DATOS (El Cartógrafo)

### Flujo completo
```
PDF de ley gubernamental
      ↓
Paso 1: PDF → TXT → CSV crudo (limpieza estética, quitar encabezados repetidos)
      ↓
Paso 2: Azure GPT-4o mini detecta formato de artículos dinámicamente
        (Artículo 1°.-, Art., ART., etc.) → Python corta correctamente
      ↓
Paso 3: Ancla matemática detecta artículos mal cortados
        (secuencias rotas: 1,2,3,16,5 → "16" es suspicious)
        (múltiples números naturales en una celda → tarjeta roja)
      ↓
Paso 4: Revisión manual rápida (5-10 min) de suspicious
      ↓
Paso 5: Limpieza de paréntesis: (reformado), (derogado), (sic) → eliminados
      ↓
Paso 6: Estructuras jerárquicas
        - Pre-filtro Python elimina ruido (romanos solos, DECRETA, TRANSITORIO)
        - Azure GPT-4o mini detecta patrón jerárquico dinámicamente
        - Cache por jurisdicción: si ya procesamos Oaxaca, no vuelve a preguntar
        - Python etiqueta: # LIBRO, ## TITULO, ### CAPITULO
      ↓
construir_gold_standard.py → CSV Gold Standard (12 columnas)
      ↓
embedder.py (próximo) → Google text-embedding-004 → Supabase pgvector
```

### Script principal: construir_gold_standard.py
- Lee metadatos desde pestaña "Resumen" del XLSX (Estado, Ley, Materia, Fecha)
- Propaga jerarquías como columnas en cada artículo
- Elimina letra muerta (derogados, preámbulos)
- Construye ID con zero-padding y abreviatura INEGI
- Detecta referencias cruzadas (Tiene_Referencias)
- Construye Texto_Para_Embedding (super-string)
- **Archivo disponible en:** `pipeline/construir_gold_standard.py`

---

## 6. CSV GOLD STANDARD — 12 COLUMNAS

| Columna | Descripción | Ejemplo |
|---|---|---|
| ID_Unico | Zero-padding + abreviatura INEGI | `SLP-CC-0015` |
| Estado | Metadato duro para filtrar | `San Luis Potosí` |
| Ley | Cuerpo legal | `Código Civil` |
| Materia | Rama jurídica | `Civil y Familiar` |
| Fecha_Ultima_Reforma | Extraída del preámbulo | `09 de septiembre de 2024` |
| Libro | Jerarquía nivel 1 | `LIBRO PRIMERO` |
| Titulo | Jerarquía nivel 2 | `TITULO SEGUNDO` |
| Capitulo | Jerarquía nivel 3 | `CAPITULO IV` |
| Numero_Articulo | Número exacto para citar | `ART. 15.-` |
| Texto_Original | Texto del legislador | `Las personas jurídicas...` |
| Tiene_Referencias | Booleano Graph-RAG | `True` / `False` |
| Texto_Para_Embedding | Super-string para vectorizar | `Código Civil de San Luis Potosí. LIBRO PRIMERO. TITULO SEGUNDO. ART. 15.- Texto: ...` |

### Notas importantes
- `Texto_Reformulado` y `Ruta_Auditoria` **NO están en el Gold Standard** — son para el proyecto B2G (Brújula), no para Legal Atlas B2C/B2B
- Los artículos derogados se eliminan completamente — no se embeddean
- Zero-padding garantiza ORDER BY correcto: `SLP-CC-0010` antes que `SLP-CC-0002` ✓

---

## 7. ABREVIATURAS INEGI OFICIALES

```python
ABREVIATURAS_INEGI = {
    "Aguascalientes": "Ags",    "Baja California": "BC",
    "Baja California Sur": "BCS", "Campeche": "Camp",
    "Chiapas": "Chis",          "Chihuahua": "Chih",
    "Ciudad de México": "CDMX", "Coahuila": "Coah",
    "Colima": "Col",            "Durango": "Dgo",
    "Guanajuato": "Gto",        "Guerrero": "Gro",
    "Hidalgo": "Hgo",           "Jalisco": "Jal",
    "México": "MEX",            "Michoacán": "Mich",
    "Morelos": "Mor",           "Nayarit": "Nay",
    "Nuevo León": "NL",         "Oaxaca": "Oax",
    "Puebla": "Pue",            "Querétaro": "Qro",
    "Quintana Roo": "QR",       "San Luis Potosí": "SLP",
    "Sinaloa": "Sin",           "Sonora": "Son",
    "Tabasco": "Tab",           "Tamaulipas": "Tamps",
    "Tlaxcala": "Tlax",         "Veracruz": "Ver",
    "Yucatán": "Yuc",           "Zacatecas": "Zac",
}
```

Formato de ID: `{ESTADO}-{LEY}-{NUMERO:04d}[-BIS/-TER]`
Ejemplos: `SLP-CC-0001`, `OAX-CC-0182`, `JAL-CF-0045-BIS`

---

## 8. JERARQUÍA NORMATIVA (5 niveles)

```
Nivel 1: Tratados internacionales    (ONU, OEA, convenios)
Nivel 2: Constitución                (CPEUM — mayor peso en búsqueda)
Nivel 3: Leyes federales             (LFT, Código Civil Federal...)
Nivel 4: Leyes estatales             (32 estados + internacional)
Nivel 5: Leyes especiales            (Reglamentos, normas técnicas)
```

En Supabase cada artículo tiene campo `nivel` (1-5). Búsquedas priorizan niveles superiores automáticamente.

---

## 9. GRAPH-RAG (Referencias cruzadas)

Cuando `Tiene_Referencias = True`, el sistema dispara una segunda query:

```
Art. 182 encontrado
      ↓
Detecta: "véase Artículo 267"
      ↓
Query secundaria: SELECT * WHERE ID_Unico = 'SLP-CC-0267'
      ↓
Ambos artículos van al LLM como contexto
```

**Límite:** máximo 2 niveles de profundidad para evitar traer medio código civil.

---

## 10. ARQUITECTURA MULTIIDIOMA

**Estrategia:** subdominios por país, un solo codebase
```
mx.legalatlas.ai    → México (español)
cz.legalatlas.ai    → Chequia (checo)
ar.legalatlas.ai    → Argentina (español)
es.legalatlas.ai    → España (español)
```

**Idioma de interfaz:** archivo JSON por idioma (~30 frases)
```json
{
  "es": { "bienvenida": "Hola, soy Apolo" },
  "cs": { "bienvenida": "Ahoj, jsem Apolo" }
}
```

**Embeddings multilingüe:** Google text-embedding-004 entiende semántica en cualquier idioma. Una pregunta en checo encuentra artículos del Obcanský zákoník automáticamente.

**El pipeline no cambia** — solo cambian los metadatos (Estado, Ley, Prefijo).

---

## 11. ESTRUCTURA DE CARPETAS DEL REPO

```
legal-atlas/
├── pipeline/
│   ├── construir_gold_standard.py    ✅ Listo
│   ├── embedder.py                   ⏳ Pendiente
│   └── utils/
│       └── abreviaturas.py
│
├── leyes/
│   ├── raw/                          ← XLSX crudos
│   ├── gold/                         ← CSV Gold Standard
│   └── procesados/                   ← Respaldo post-embedding
│
├── frontend/
│   ├── index.html                    ← Pantalla selección de puerta
│   ├── ciudadano.html                ← Puerta B2C
│   ├── abogado.html                  ← Puerta B2B
│   └── assets/
│       ├── css/
│       ├── js/
│       └── i18n/                     ← Archivos de traducción
│
├── config/
│   └── metadatos.json
│
├── CONTEXTO_LEGAL_ATLAS.md           ← ESTE ARCHIVO
└── README.md
```

---

## 12. IDENTIDAD VISUAL

```css
/* Paleta oficial */
--negro:        #1a1a16;    /* Sidebar y headers */
--negro-soft:   #242420;    /* Elementos secundarios */
--dorado:       #c49a3c;    /* Acento principal */
--dorado-light: #f5edd6;    /* Fondos dorados suaves */
--pergamino:    #f5f3ee;    /* Fondo principal del chat */
--muted:        #7a7568;    /* Texto secundario */

/* Tipografía */
--serif-display: 'Cinzel', serif;      /* Logo y títulos */
--body:          'Lora', serif;        /* Cuerpo de texto */
```

**Tono:** premium, autoritario pero accesible. No intimidante.
**No usar:** Inter, Roboto, gradientes púrpura, estética genérica de IA.

---

## 13. ARCHIVOS GENERADOS HOY

| Archivo | Estado | Descripción |
|---|---|---|
| `construir_gold_standard.py` | ✅ Listo | Builder del CSV Gold Standard |
| `CCSANLP_GOLD_STANDARD.csv` | ✅ Listo | San Luis Potosí — 2,250 artículos |
| `CCSANLP_GOLD_STANDARD_LEGIBLE.xlsx` | ✅ Listo | Versión visual con resumen |
| `legal-atlas-v2.html` | ✅ Listo | Diseño evolucionado con onboarding |
| `embedder.py` | ⏳ Pendiente | Google embeddings → Supabase |
| `llamada.py` (Gemini) | ⏳ Pendiente | Solo para proyecto B2G Brújula |

---

## 14. PRÓXIMOS PASOS

### Inmediato (esta semana)
1. Subir `legal-atlas-v2.html` al repo y deployar
2. Habilitar `pgvector` en Supabase
3. Construir `embedder.py` con Google text-embedding-004
4. Primera carga: San Luis Potosí (2,250 artículos)
5. Conectar chat con RAG real end-to-end

### Corto plazo
1. Mostrar demo funcionando al amigo abogado
2. Conseguir primer cliente B2B pagando
3. Procesar Oaxaca (CSV crudo ya existe)
4. Construir puerta B2B (búsqueda avanzada)

### Medio plazo
1. Registrar marca "Legal Atlas" en IMPI
2. Escalar a 5 estados
3. Lanzar B2C con freemium

---

## 15. INSTRUCCIONES PARA CLAUDE CODE

Cuando abras Claude Code, di esto:

> "Lee el archivo CONTEXTO_LEGAL_ATLAS.md que está en la raíz del proyecto. Es el contexto maestro de todo lo que hemos construido. Léelo completo antes de hacer cualquier cosa y confírmame que lo entendiste con un resumen de 5 puntos clave."

Eso garantiza que arranque con todo el contexto sin que tengas que explicar nada.

---

## 16. DECISIONES ARQUITECTURALES ADICIONALES (19 marzo 2026)

### RAG por puerta — decisión oficial

**Puerta ciudadano → Embedding semántico primero (siempre)**
El ciudadano habla lenguaje natural ("me quieren quitar a mis hijos").
El embedding traduce lenguaje humano → lenguaje legal automáticamente.
Sin embedding, el ciudadano nunca encontraría "patria potestad".

**Puerta abogado → Texto exacto primero, embedding como fallback**
El abogado busca "Artículo 267 Código Civil Oaxaca" — sabe exactamente qué quiere.
Búsqueda exacta por ID/Numero_Articulo primero.
Si no encuentra → fallback a embedding semántico.

```javascript
// Ciudadano — siempre embedding
supabase.rpc('buscar_por_embedding', { query_embedding, estado_filtro, limit: 5 })

// Abogado — texto exacto primero, embedding si falla
const exacto = await supabase.from('articulos')
  .eq('Numero_Articulo', 'ART. 267.-').eq('estado', 'oaxaca')
if (!exacto.data.length) { fallback a embedding }
```

---

### Territorios dinámicos — sin hardcodeo

**Problema resuelto:** antes los estados estaban hardcodeados en GitHub.
**Solución:** tabla `territorios` en Supabase. El dropdown se llena dinámico.

```sql
tabla: territorios
  codigo        → 'SLP'
  nombre        → 'San Luis Potosí'
  pais          → 'México'
  activo        → true
  leyes_count   → 3
```

El frontend hace:
```javascript
const { data } = await supabase.from('territorios')
  .select('codigo, nombre').eq('activo', true).order('nombre')
```

Agregar nuevo territorio = INSERT en Supabase. Sin deploy. Sin GitHub.

---

### Registro y autenticación — decisión oficial

- **Magic link** via Supabase Auth (sin password)
- Solo correo al registrarse
- Tres preguntas en onboarding: tipo (ciudadano/abogado) · estado · default app
- Abogados pueden configurar Legal Atlas Pro como app default

```sql
tabla: usuarios
  id
  correo
  nombre
  tipo              → 'ciudadano' | 'abogado'
  estado_default    → 'jalisco'
  materia_default   → 'civil'
  app_default       → 'ciudadano' | 'abogado' | null
  created_at
  ultima_visita
```

---

### Flujo de detección de territorio

1. Al registrarse: "¿En qué estado vives?" → dropdown dinámico desde `territorios`
2. En cada conversación: pastilla visible con territorio activo (toca para cambiar)
3. Detección automática: si la pregunta menciona otro estado, Apolo pregunta si cambiar

---

### Identidad visual — dirección oficial

**Concepto:** Expedición científica del siglo XIX · Cartografía de campo · Humboldt
**No es una app de tecnología — es un instrumento de navegación legal**

- Fondo: oscuro con contornos topográficos en sepia/dorado tenue
- Sello: rosa de los vientos con A de Apolo · "EXPEDICIÓN LEGAL ATLAS · MÉXICO · MMXXVI"
- Tres versiones del logo:
  - Sello completo → splash screen, presentaciones B2B
  - Rosa + A → ícono de app, favicon, navbar
  - "A" sola → mensajes de Apolo en el chat

**Copy de expedición:**
- "Comenzar consulta" → "Iniciar expedición"
- "Buscar artículo" → "Trazar ruta normativa"
- "Resultados" → "Hallazgos"
- "Jurisdicción" → "Territorio"

---

### Mercado objetivo — mapa de expansión

Civil law = ~4 billion personas. Common law no es compatible (precedentes, no artículos).

```
Fase 1 — México completo         (en curso)
Fase 2 — LATAM hispanohablante   (mismo pipeline, mismo idioma)
Fase 3 — Brasil                  (pipeline adaptado, portugués)
Fase 4 — España + Europa civil   (multiidioma)
Fase 5 — Norte de África         (árabe + francés jurídico)
```

Common law (EE.UU., UK, India) requeriría producto completamente diferente — no es el camino.

---

### PWA — decisión oficial

Legal Atlas se convierte en PWA (Progressive Web App).
Sin App Store. Sin costo adicional. Se instala desde el navegador.
El abogado en sala de audiencias abre su iPad → Legal Atlas en pantalla completa.

Implementación: manifest.json + service-worker.js + 2 líneas en cada HTML.

---

### Esquema completo de Supabase

```
tabla: articulos        → Gold Standard embeddeado (pgvector)
tabla: territorios      → estados/países activos (dinámico)
tabla: usuarios         → registro, tipo, defaults
tabla: abogados         → directorio (tabla existente del usuario)
tabla: sesiones         → territorio activo, materia activa por sesión
```


---

## 17. CONEXIÓN RAG — SUPABASE + GEMINI + AZURE (Listo para ejecutar)

### Archivos involucrados
```
api/
├── buscar.js       ← NUEVO — vectoriza pregunta y busca en Supabase
└── asesoria.js     ← EXISTENTE — recibe contextoLegal y llama a Azure GPT-4o mini
```

### Paso 1 — Función SQL en Supabase (correr una sola vez)
```sql
CREATE OR REPLACE FUNCTION buscar_articulos(
  query_embedding VECTOR(1536),
  filtro_estado   TEXT,
  filtro_ley      TEXT DEFAULT 'Código Civil',
  match_count     INT  DEFAULT 5
)
RETURNS TABLE (
  id_unico        TEXT,
  numero_articulo TEXT,
  texto_original  TEXT,
  libro           TEXT,
  titulo          TEXT,
  capitulo        TEXT,
  similitud       FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id_unico,
    numero_articulo,
    texto_original,
    libro, titulo, capitulo,
    1 - (embedding <=> query_embedding) AS similitud
  FROM articulos
  WHERE estado = filtro_estado
    AND ley     = filtro_ley
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### Paso 2 — Crear api/buscar.js (archivo nuevo)
```javascript
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)
const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

export async function buscarArticulos(pregunta, estado, ley = 'Código Civil', limite = 5) {
  // 1. Vectorizar la pregunta
  const model = genai.getGenerativeModel({ model: "text-embedding-004" })
  const result = await model.embedContent({
    content: { parts: [{ text: pregunta }] },
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: 1536
  })
  const queryVector = result.embedding.values

  // 2. Buscar en Supabase por similitud semántica
  const { data, error } = await supabase.rpc('buscar_articulos', {
    query_embedding: queryVector,
    filtro_estado:   estado,
    filtro_ley:      ley,
    match_count:     limite
  })
  if (error) throw new Error(`Supabase error: ${error.message}`)

  // 3. Formatear para asesoria.js
  return data.map(art => ({
    numero:    art.numero_articulo,
    texto:     art.texto_original,
    jerarquia: [art.libro, art.titulo, art.capitulo].filter(Boolean).join(' > '),
    id_unico:  art.id_unico
  }))
}
```

### Paso 3 — Modificar asesoria.js (3 cambios)

**Cambio 1 — Agregar import al inicio:**
```javascript
import { buscarArticulos } from './buscar.js'
```

**Cambio 2 — Reemplazar la línea que lee contextoLegal del body:**
```javascript
// ANTES:
const { pais, estado, tema, pregunta, contextoLegal, fuente, modo } = req.body;

// DESPUÉS:
const { pais, estado, tema, pregunta, fuente, modo } = req.body;
const contextoLegal = await buscarArticulos(pregunta, estado)
```

**Cambio 3 — El resto de asesoria.js NO cambia.**
La verificación cruzada de artículos, el prompt, la llamada a Azure — todo se mantiene igual.

### Paso 4 — Variables de entorno (.env y Vercel)
```
GOOGLE_API_KEY=tu_key_google_ai_studio
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_KEY=tu_anon_key
AZURE_OPENAI_ENDPOINT=https://legalatlas-openai-sweden.openai.azure.com/
AZURE_OPENAI_API_KEY=tu_key_azure
```

### Paso 5 — Instalar dependencia nueva
```bash
npm install @google/generative-ai
```

---

## 18. PROMPT PARA CLAUDE CODE — CONECTAR RAG

Cuando abras Claude Code, dale este prompt exacto:

```
Lee CONTEXTO_LEGAL_ATLAS.md completo antes de empezar.

Tarea: Conectar el RAG de Supabase con el chat de Legal Atlas.

Pasos en orden:
1. Revisa el archivo api/asesoria.js actual
2. Crea el archivo api/buscar.js con el código de la sección 17
3. Modifica api/asesoria.js con los 3 cambios de la sección 17
4. Verifica que el .env tenga GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_KEY
5. Instala @google/generative-ai si no está en package.json
6. Prueba haciendo una pregunta sobre el Código Civil de Puebla

NO toques ningún otro archivo. Solo buscar.js y asesoria.js.
Confirma cada paso antes de continuar al siguiente.
```

---

## 19. ESTADO ACTUAL DEL PROYECTO (20 marzo 2026)

### Completado ✅
- Pipeline PDF → CSV crudo → Gold Standard funcionando
- `preparador_embeddings.py` con panel Tkinter (True/False, normalización, zero-padding)
- `embedder.py` con panel Tkinter (.env automático, carpeta fija, Gemini 1536 dims)
- Supabase: tabla `articulos` con pgvector 1536 dims + función `buscar_articulos`
- Puebla embeddeada: ~3,445 artículos con vectores reales
- Búsqueda semántica verificada — devuelve artículos temáticamente correctos
- `asesoria.js` funcionando con Azure GPT-4o mini y verificación cruzada

### Pendiente ⏳
- Conectar RAG: crear `buscar.js` + modificar `asesoria.js` (Sección 17)
- Embeddear los otros 26 Códigos Civiles
- Tabla `territorios` dinámica en Supabase
- Tabla `usuarios` con magic link (Supabase Auth)
- Rediseño frontend con identidad Expedición Legal Atlas
- PWA (manifest.json + service worker)
- Stripe para suscripciones

### Archivos Python generados hoy
| Archivo | Estado | Descripción |
|---|---|---|
| `preparador_embeddings.py` | ✅ v2 | Panel Tkinter Gold Standard |
| `embedder.py` | ✅ v2 | Panel Tkinter embeddings → Supabase |
| `construir_gold_standard.py` | ✅ | Versión CLI del preparador |
| `CONTEXTO_LEGAL_ATLAS.md` | ✅ | Este archivo |

### Datos en Supabase
| Estado | Artículos | Dims | Status |
|---|---|---|---|
| Puebla | ~3,445 | 1536 | ✅ Listo |
| Oaxaca | 0 | — | ⏳ Pendiente |
| San Luis Potosí | 0 | — | ⏳ Pendiente |
| +24 estados | 0 | — | ⏳ Pendiente |