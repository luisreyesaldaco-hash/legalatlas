import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

export const config = { api: { bodyParser: true } };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DIAGRAM_VERSION = 2;
const RENDERER_CUTOFF = '2026-04-20T00:00:00Z';

const NOMBRES_IDIOMA = {
  es: 'español', cs: 'checo', fr: 'francés',
  pt: 'portugués', de: 'alemán', en: 'inglés'
};

// ─── Layout: top-down layered DAG ─────────────────────────────────────────────
function layoutGraph(nodes, edges) {
  const NODE_W = 190, NODE_H = 72, H_GAP = 32, V_GAP = 60, PAD = 40;

  const byId = new Map(nodes.map(n => [n.id, n]));
  const inDeg = new Map(nodes.map(n => [n.id, 0]));
  edges.forEach(e => byId.has(e.to) && inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1));

  const level = new Map();
  const queue = nodes.filter(n => inDeg.get(n.id) === 0).map(n => n.id);
  queue.forEach(id => level.set(id, 0));
  const inDegWork = new Map(inDeg);

  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    edges.filter(e => e.from === id).forEach(e => {
      if (!byId.has(e.to)) return;
      inDegWork.set(e.to, inDegWork.get(e.to) - 1);
      level.set(e.to, Math.max(level.get(e.to) || 0, level.get(id) + 1));
      if (inDegWork.get(e.to) === 0) queue.push(e.to);
    });
  }
  nodes.forEach(n => { if (!level.has(n.id)) level.set(n.id, 0); });

  const byLevel = new Map();
  level.forEach((lvl, id) => {
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(id);
  });

  const levelsSorted = [...byLevel.keys()].sort((a, b) => a - b);
  const maxWidth = Math.max(...levelsSorted.map(l => byLevel.get(l).length));
  const width = Math.max(560, maxWidth * NODE_W + (maxWidth - 1) * H_GAP + PAD * 2);
  const height = levelsSorted.length * NODE_H + (levelsSorted.length - 1) * V_GAP + PAD * 2;

  const pos = new Map();
  levelsSorted.forEach((lvl, row) => {
    const ids = byLevel.get(lvl);
    const rowW = ids.length * NODE_W + (ids.length - 1) * H_GAP;
    const startX = (width - rowW) / 2;
    const y = PAD + row * (NODE_H + V_GAP);
    ids.forEach((id, i) => pos.set(id, { x: startX + i * (NODE_W + H_GAP), y }));
  });

  return { pos, width, height, NODE_W, NODE_H };
}

// ─── Renderer: JSON → SVG ─────────────────────────────────────────────────────
function escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function wrapText(text, maxCharsPerLine = 24, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxCharsPerLine) {
      if (cur) lines.push(cur.trim());
      cur = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur += ' ' + w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur.trim());
  if (lines.length === maxLines && words.length > lines.join(' ').split(/\s+/).length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = (last.length > maxCharsPerLine - 1 ? last.slice(0, maxCharsPerLine - 1) : last) + '…';
  }
  return lines;
}

function renderSVG(nodes, edges, layout) {
  const { pos, width, height, NODE_W, NODE_H } = layout;
  const parts = [];
  parts.push(`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="Lora, Georgia, serif">`);
  parts.push(`<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8a6820"/></marker></defs>`);

  for (const e of edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H;
    const x2 = b.x + NODE_W / 2, y2 = b.y;
    const cy = (y1 + y2) / 2;
    parts.push(`<path d="M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}" fill="none" stroke="#8a6820" stroke-width="1.5" marker-end="url(#arr)"/>`);
    if (e.label) {
      const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      const label = String(e.label).slice(0, 28);
      const labelW = Math.min(140, label.length * 6.5 + 14);
      parts.push(`<rect x="${midX - labelW / 2}" y="${midY - 9}" width="${labelW}" height="18" rx="3" fill="#faf2e0" stroke="#8a6820" stroke-width="0.5"/>`);
      parts.push(`<text x="${midX}" y="${midY + 4}" text-anchor="middle" font-size="10" fill="#3d342a">${escapeXml(label)}</text>`);
    }
  }

  for (const n of nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    parts.push(`<rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="#f0e8d0" stroke="#8a6820" stroke-width="1.5"/>`);
    const lines = wrapText(n.label);
    const startY = p.y + NODE_H / 2 - ((lines.length - 1) * 14) / 2 + 4;
    lines.forEach((line, i) => {
      parts.push(`<text x="${p.x + NODE_W / 2}" y="${startY + i * 14}" text-anchor="middle" font-size="12" fill="#1a1508">${escapeXml(line)}</text>`);
    });
  }

  parts.push('</svg>');
  return parts.join('');
}

// ─── LLM: JSON graph from articles ────────────────────────────────────────────
function buildPrompt(articulosTexto, nivel, ley, estado, idiomaNombre) {
  return `Analiza estos artículos del capítulo "${nivel}" del ${ley}${estado ? ` de ${estado}` : ''} y devuelve un diagrama de flujo del proceso legal como JSON.

ARTÍCULOS:
${articulosTexto}

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto extra, sin \`\`\`):
{
  "nodes": [{"id": "n1", "label": "paso corto"}],
  "edges": [{"from": "n1", "to": "n2", "label": "opcional: plazo o condición"}]
}

REGLAS:
- Entre 3 y 7 nodos (nunca más de 7).
- "label" del nodo ≤ 60 caracteres, en ${idiomaNombre}, describe QUIÉN hace QUÉ.
- "edges.label" opcional (máx 24 caracteres), úsalo para plazos ("15 días") o condiciones ("si hay acuerdo").
- Es un DAG — ramificaciones OK, ciclos no.
- Primer nodo = inicio del proceso. Último(s) = resultado(s).
- NO expliques nada fuera del JSON.`;
}

function stripFences(text) {
  return String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

function validateGraph(g) {
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return 'formato inválido';
  if (g.nodes.length < 2) return 'muy pocos nodos';
  if (g.nodes.length > 10) return 'demasiados nodos';
  const ids = new Set();
  for (const n of g.nodes) {
    if (!n.id || !n.label) return 'nodo sin id/label';
    if (ids.has(n.id)) return 'id duplicado';
    ids.add(n.id);
  }
  for (const e of g.edges) {
    if (!e.from || !e.to) return 'arista sin from/to';
    if (!ids.has(e.from) || !ids.has(e.to)) return 'arista apunta a nodo inexistente';
  }
  return null;
}

async function generateGraph(prompt) {
  try {
    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 }, temperature: 0.1, maxOutputTokens: 1500 }
    });
    const text = stripFences(r.text);
    const parsed = JSON.parse(text);
    const err = validateGraph(parsed);
    if (err) throw new Error('Gemini JSON inválido: ' + err);
    return parsed;
  } catch (geminiErr) {
    console.warn('[diagrama] Gemini falló, fallback a Claude:', geminiErr.message);
    const c = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = stripFences(c.content[0].text);
    const parsed = JSON.parse(text);
    const err = validateGraph(parsed);
    if (err) throw new Error('Claude JSON inválido: ' + err);
    return parsed;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { nivel_secundario, estado, ley, idioma = 'es' } = body;
    const idiomaNombre = NOMBRES_IDIOMA[idioma] || 'español';

    if (!nivel_secundario || !ley) {
      return res.status(400).json({ error: 'Parámetros requeridos: nivel_secundario, ley' });
    }

    // Cache lookup — only hit entries from the v2 renderer onwards
    try {
      const { data: cached } = await supabase
        .from('diagramas')
        .select('svg_content, created_at')
        .eq('estado', estado || '')
        .eq('ley', ley)
        .eq('nivel_secundario', nivel_secundario)
        .eq('idioma', idioma)
        .gte('created_at', RENDERER_CUTOFF)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached?.svg_content) return res.status(200).json({ svg: cached.svg_content, cached: true });
    } catch (_) { /* tabla ausente — seguir */ }

    let artQ = supabase
      .from('articulos')
      .select('numero_articulo, texto_original')
      .eq('ley', ley)
      .eq('capitulo', nivel_secundario)
      .order('id', { ascending: true })
      .limit(20);
    if (estado) artQ = artQ.eq('estado', estado);
    const { data: articulos, error: artErr } = await artQ;
    if (artErr) throw artErr;
    if (!articulos || articulos.length === 0) {
      return res.status(404).json({ error: 'No se encontraron artículos para este capítulo' });
    }

    const articulosTexto = articulos
      .map(a => `${a.numero_articulo}: ${(a.texto_original || '').slice(0, 400)}`)
      .join('\n\n');

    const prompt = buildPrompt(articulosTexto, nivel_secundario, ley, estado, idiomaNombre);
    const graph = await generateGraph(prompt);
    const layout = layoutGraph(graph.nodes, graph.edges);
    const svg = renderSVG(graph.nodes, graph.edges, layout);

    try {
      await supabase.from('diagramas').insert({
        estado, ley, nivel_secundario, svg_content: svg, idioma,
        created_at: new Date().toISOString()
      });
    } catch (cacheErr) {
      console.error('[diagrama] cache insert falló:', cacheErr?.message);
    }

    return res.status(200).json({ svg, cached: false, version: DIAGRAM_VERSION });

  } catch (err) {
    console.error('[diagrama] error:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
}
