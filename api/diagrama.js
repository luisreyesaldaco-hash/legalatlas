import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const config = { api: { bodyParser: true } };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

function stripMarkdown(text) {
  return text
    .replace(/^```(?:svg|xml|html)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { nivel_secundario, estado, ley } = body;

    if (!nivel_secundario || !ley) {
      return res.status(400).json({ error: 'Parámetros requeridos: nivel_secundario, ley' });
    }

    // ── 1. Intentar cache en tabla diagramas ─────────────────────────────────
    try {
      const { data: cached, error: cacheErr } = await supabase
        .from('diagramas')
        .select('svg_content')
        .eq('estado', estado || '')
        .eq('ley', ley)
        .eq('nivel_secundario', nivel_secundario)
        .single();

      if (!cacheErr && cached && cached.svg_content) {
        return res.status(200).json({ svg: cached.svg_content, cached: true });
      }
    } catch (_) {
      // tabla diagramas no existe — continuar con generación
    }

    // ── 2. Obtener artículos del capítulo ─────────────────────────────────────
    let artQ = supabase
      .from('articulos')
      .select('numero_articulo, texto_original')
      .eq('ley', ley)
      .eq('titulo', nivel_secundario)
      .order('id', { ascending: true })
      .limit(20);
    if (estado) artQ = artQ.eq('estado', estado);
    const { data: articulos, error: artErr } = await artQ;

    if (artErr) throw artErr;

    if (!articulos || articulos.length === 0) {
      return res.status(404).json({ error: 'No se encontraron artículos para este capítulo' });
    }

    // ── 3. Generar diagrama SVG con Gemini ────────────────────────────────────
    const articulosTexto = articulos
      .map(a => `${a.numero_articulo}: ${a.texto_original || ''}`)
      .join('\n\n');

    const prompt = `Analiza estos artículos del capítulo "${nivel_secundario}" del ${ley} de ${estado} y genera un diagrama de flujo del proceso legal en SVG puro.

ARTÍCULOS:
${articulosTexto}

REGLAS DEL SVG:
- viewBox="0 0 600 400"
- Solo rect, line, text, path — sin imágenes externas
- Máximo 7 nodos
- Fondo transparente
- Fondo SVG: transparente — NO agregues ningún rect de fondo
- Colores nodos: relleno #f0e8d0, stroke #8a6820, texto #1a1508
- Líneas de conexión: stroke #8a6820
- Muestra el flujo del proceso: quién hace qué, en qué orden
- Responde SOLO con el SVG completo, sin texto adicional, sin markdown`;

    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 2000
      }
    });

    const rawSvg = geminiResponse.text;
    if (!rawSvg) throw new Error('Gemini no devolvió contenido para el diagrama');

    const svg = stripMarkdown(rawSvg);

    // ── 4. Guardar en cache (si la tabla existe) ───────────────────────────────
    try {
      await supabase
        .from('diagramas')
        .insert({
          estado,
          ley,
          nivel_secundario,
          svg_content: svg,
          created_at: new Date().toISOString()
        });
    } catch (_) {
      // tabla diagramas no existe — ignorar silenciosamente
    }

    return res.status(200).json({ svg, cached: false });

  } catch (err) {
    console.error('[diagrama.js] Error:', err);
    return res.status(500).json({ error: 'Error generando el diagrama', details: err.message });
  }
}
