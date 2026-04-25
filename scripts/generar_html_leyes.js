// scripts/generar_html_leyes.js
// Pre-genera el HTML renderizado de cada ley y lo almacena en leyes_html.
// Ejecutar: node scripts/generar_html_leyes.js

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env manually
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')
try {
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
} catch (_) {}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

// Convierte "§ 67" → "par-67", "Art. 123" → "art-123"
function anchorId(numeroArticulo) {
  return numeroArticulo
    .replace(/[§\s\.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

// Escapa HTML
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Convierte el texto crudo del artículo en párrafos estructurados tipo zakonyprolidy:
//  1. Quita el prefijo del número de artículo si aparece al inicio
//     ("§ 1", "Artículo 1032.-", "Art. 5", etc.) — ya se muestra en .ley-art-num
//  2. Parte en subcláusulas "(1)", "(2)", "(3a)" → <p class="ley-subsec">
//  3. Si no hay subcláusulas → un <p class="ley-parrafo"> plano
//  4. Preserva \n como <br> dentro de cada párrafo
//  5. Linkea cross-refs "§ NN" (ya no el primero, porque se strippeó)
function formatTexto(texto, numeroArticulo) {
  let t = String(texto || '').trim()
  if (!t) return ''

  // 1. Strip prefijo del número de artículo
  const numRaw = String(numeroArticulo || '').trim()
  if (numRaw) {
    const numEsc = numRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp('^' + numEsc + '\\s*'), '')
  }

  // 2. Split en marcadores de subcláusula "(N)" o "(Na)" precedidos por espacio o inicio
  const segmentos = t.split(/\s+(?=\(\d+[a-z]?\)\s)/g)

  // 3. Construir párrafos
  const out = []
  for (const seg of segmentos) {
    if (!seg.trim()) continue
    const m = seg.match(/^\((\d+[a-z]?)\)\s+([\s\S]*)$/)
    if (m) {
      out.push(
        `<p class="ley-subsec"><span class="ley-subsec-num">(${esc(m[1])})</span> ${formatInline(m[2])}</p>`
      )
    } else {
      out.push(`<p class="ley-parrafo">${formatInline(seg)}</p>`)
    }
  }

  return out.join('\n  ')
}

// Inline: escape HTML + \n → <br> + cross-refs
function formatInline(str) {
  return esc(str)
    .replace(/\n/g, '<br>')
    .replace(/§\s*(\d+[a-z]*)/g, '<a href="#par-$1" class="ley-ref">§ $1</a>')
}

function esZruseno(art) {
  return art.texto_original &&
    art.texto_original.toLowerCase().includes('zrušeno') &&
    art.texto_original.length < 40
}

async function generarHTMLLey(pais, ley, estado = '') {
  // Supabase max 1000 rows per request — paginate
  let articulos = []
  let from = 0
  const BATCH = 1000

  while (true) {
    let q = supabase
      .from('articulos')
      .select('libro, titulo, capitulo, numero_articulo, texto_original, orden_lectura')
      .eq('pais', pais)
      .eq('ley', ley)
      .eq('estado', estado || '')
      .order('orden_lectura', { ascending: true })
      .range(from, from + BATCH - 1)

    const { data, error } = await q
    if (error) { console.error(`  Error cargando ${ley}: ${error.message}`); return }
    if (!data || data.length === 0) break
    articulos.push(...data)
    if (data.length < BATCH) break
    from += BATCH
  }

  if (articulos.length === 0) return

  let html = `<div class="ley-root" data-pais="${esc(pais)}" data-ley="${esc(ley)}" data-estado="${esc(estado)}">`
  let lastLibro = null, lastTitulo = null, lastCapitulo = null

  for (const art of articulos) {
    // LIBRO (ČÁST / Livre / Título)
    if (art.libro && art.libro !== lastLibro) {
      html += `<div class="ley-libro"><h2>${esc(art.libro)}</h2></div>\n`
      lastLibro = art.libro
      lastTitulo = null
      lastCapitulo = null
    }

    // TÍTULO (HLAVA / Chapitre / Kapitel)
    if (art.titulo && art.titulo !== lastTitulo) {
      html += `<div class="ley-titulo"><h3>${esc(art.titulo)}</h3></div>\n`
      lastTitulo = art.titulo
      lastCapitulo = null
    }

    // CAPÍTULO (Díl / Section / Abschnitt)
    if (art.capitulo && art.capitulo !== lastCapitulo) {
      html += `<div class="ley-capitulo"><h4>${esc(art.capitulo)}</h4></div>\n`
      lastCapitulo = art.capitulo
    }

    // ARTÍCULO
    const anchor = anchorId(art.numero_articulo)
    const dataAttrs = [
      `data-articulo="${esc(art.numero_articulo)}"`,
      art.libro    ? `data-libro="${esc(art.libro)}"` : '',
      art.titulo   ? `data-titulo="${esc(art.titulo)}"` : '',
      art.capitulo ? `data-capitulo="${esc(art.capitulo)}"` : '',
    ].filter(Boolean).join(' ')

    if (esZruseno(art)) {
      html += `<p class="ley-art-zruseno" id="${anchor}" ${dataAttrs}>${esc(art.numero_articulo)}</p>\n`
    } else {
      html += `<div class="ley-articulo" id="${anchor}" ${dataAttrs}>\n`
      html += `  <span class="ley-art-num">${esc(art.numero_articulo)}</span>\n`
      html += `  <div class="ley-art-texto">${formatTexto(art.texto_original, art.numero_articulo)}</div>\n`
      html += `</div>\n`
    }
  }

  html += '</div>'

  // Guardar en Supabase
  const { error: upsertError } = await supabase
    .from('leyes_html')
    .upsert({
      pais,
      ley,
      estado: estado || '',
      html,
      total_articulos: articulos.length,
      generado_at: new Date().toISOString()
    }, { onConflict: 'pais,ley,estado' })

  if (upsertError) {
    console.error(`  ✗ ${pais} · ${ley}${estado ? ' · ' + estado : ''}: ${upsertError.message}`)
  } else {
    console.log(`  ✓ ${pais} · ${ley}${estado ? ' · ' + estado : ''} · ${articulos.length} arts`)
  }
}

async function main() {
  console.log('[generar_html_leyes] Iniciando...\n')

  // ── 1. Todas las leyes NO-MX ──
  console.log('=== Leyes no-MX ===')
  const seen = new Set()
  let from = 0
  const BATCH = 1000
  const leyesNoMX = []

  while (true) {
    const { data, error } = await supabase
      .from('articulos')
      .select('pais, ley, estado')
      .neq('pais', 'MX')
      .order('pais').order('ley')
      .range(from, from + BATCH - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const c of data) {
      const key = `${c.pais}|${c.ley}|${c.estado}`
      if (!seen.has(key)) { seen.add(key); leyesNoMX.push(c) }
    }
    if (data.length < BATCH) break
    from += BATCH
  }

  for (const { pais, ley, estado } of leyesNoMX) {
    await generarHTMLLey(pais, ley, estado)
  }

  // ── 2. Código Civil MX — una por estado ──
  console.log('\n=== MX · Código Civil (por estado) ===')
  const seenEstados = new Set()
  from = 0

  while (true) {
    const { data, error } = await supabase
      .from('articulos')
      .select('estado')
      .eq('pais', 'MX')
      .eq('ley', 'Código Civil')
      .range(from, from + BATCH - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const e of data) {
      if (e.estado && !seenEstados.has(e.estado)) seenEstados.add(e.estado)
    }
    if (data.length < BATCH) break
    from += BATCH
  }

  for (const estado of [...seenEstados].sort()) {
    await generarHTMLLey('MX', 'Código Civil', estado)
  }

  // ── 3. Resto de leyes MX (federales) ──
  console.log('\n=== MX · Leyes federales ===')
  const seenMX = new Set()
  from = 0

  while (true) {
    const { data, error } = await supabase
      .from('articulos')
      .select('ley, estado')
      .eq('pais', 'MX')
      .neq('ley', 'Código Civil')
      .range(from, from + BATCH - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const l of data) {
      const key = `${l.ley}|${l.estado || ''}`
      if (!seenMX.has(key)) { seenMX.add(key); }
    }
    if (data.length < BATCH) break
    from += BATCH
  }

  for (const key of [...seenMX].sort()) {
    const [ley, estado] = key.split('|')
    await generarHTMLLey('MX', ley, estado || '')
  }

  console.log('\n✅ Todas las leyes generadas.')
}

main().catch(e => { console.error(e); process.exit(1) })
