import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Helper: apply optional estado filter to a query
function conEstado(query, estado) {
  return estado ? query.eq('estado', estado) : query;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, pais, estado, ley, nivel_primario, nivel_secundario, id, numero } = req.query;

  if (!action) return res.status(400).json({ error: 'Parámetro action requerido' });

  try {

    // ── paises ───────────────────────────────────────────────────────────────
    if (action === 'paises') {
      const { data, error } = await supabase
        .from('articulos')
        .select('pais')
        .not('pais', 'is', null)
        .neq('pais', '');
      if (error) throw error;
      const unique = [...new Set((data || []).map(r => r.pais).filter(Boolean))].sort();
      return res.status(200).json({ paises: unique });
    }

    // ── leyes (por pais) — clasifica federal vs estatal ─────────────────────
    if (action === 'leyes') {
      if (!pais) return res.status(400).json({ error: 'Parámetro pais requerido' });
      const { data, error } = await supabase
        .from('articulos')
        .select('ley, estado')
        .eq('pais', pais)
        .not('ley', 'is', null);
      if (error) throw error;
      // Una ley es 'estatal' si al menos un artículo tiene estado no vacío
      const mapa = {};
      (data || []).forEach(r => {
        if (!r.ley) return;
        if (!mapa[r.ley]) mapa[r.ley] = { ley: r.ley, tipo: 'federal' };
        if (r.estado && r.estado.trim()) mapa[r.ley].tipo = 'estatal';
      });
      const leyes = Object.values(mapa).sort((a, b) => a.ley.localeCompare(b.ley));
      return res.status(200).json({ leyes });
    }

    // ── estados_por_ley ──────────────────────────────────────────────────────
    if (action === 'estados_por_ley') {
      if (!pais || !ley) return res.status(400).json({ error: 'Parámetros pais y ley requeridos' });
      const { data, error } = await supabase
        .from('articulos')
        .select('estado')
        .eq('pais', pais)
        .eq('ley', ley)
        .not('estado', 'is', null)
        .neq('estado', '');
      if (error) throw error;
      const unique = [...new Set((data || []).map(r => r.estado).filter(Boolean))].sort();
      return res.status(200).json({ estados: unique });
    }

    // ── niveles_primarios ────────────────────────────────────────────────────
    if (action === 'niveles_primarios') {
      if (!pais || !ley) return res.status(400).json({ error: 'Parámetros pais y ley requeridos' });
      let q = supabase.from('articulos').select('nivel_primario')
        .eq('pais', pais).eq('ley', ley).not('nivel_primario', 'is', null);
      q = conEstado(q, estado);
      const { data, error } = await q;
      if (error) throw error;
      const unique = [...new Set((data || []).map(r => r.nivel_primario).filter(Boolean))];
      return res.status(200).json({ niveles_primarios: unique });
    }

    // ── niveles_secundarios ──────────────────────────────────────────────────
    if (action === 'niveles_secundarios') {
      if (!pais || !ley || !nivel_primario) return res.status(400).json({ error: 'Parámetros pais, ley y nivel_primario requeridos' });
      let q = supabase.from('articulos').select('nivel_secundario')
        .eq('pais', pais).eq('ley', ley)
        .eq('nivel_primario', nivel_primario)
        .not('nivel_secundario', 'is', null);
      q = conEstado(q, estado);
      const { data, error } = await q;
      if (error) throw error;
      const unique = [...new Set((data || []).map(r => r.nivel_secundario).filter(Boolean))];
      return res.status(200).json({ niveles_secundarios: unique });
    }

    // ── articulos_capitulo ───────────────────────────────────────────────────
    if (action === 'articulos_capitulo') {
      if (!pais || !ley || !nivel_secundario) return res.status(400).json({ error: 'Parámetros pais, ley y nivel_secundario requeridos' });
      let q = supabase.from('articulos').select('id_unico, numero_articulo')
        .eq('pais', pais).eq('ley', ley)
        .eq('nivel_secundario', nivel_secundario)
        .order('numero_articulo', { ascending: true });
      q = conEstado(q, estado);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ articulos: data || [] });
    }

    // ── articulo (single) ────────────────────────────────────────────────────
    if (action === 'articulo') {
      if (!id) return res.status(400).json({ error: 'Parámetro id requerido' });
      const { data, error } = await supabase
        .from('articulos').select('*').eq('id_unico', id).single();
      if (error) {
        if (error.code === 'PGRST116') return res.status(404).json({ error: 'Artículo no encontrado' });
        throw error;
      }
      return res.status(200).json({ articulo: data });
    }

    // ── buscar ───────────────────────────────────────────────────────────────
    if (action === 'buscar') {
      if (!pais || !ley || !numero) return res.status(400).json({ error: 'Parámetros pais, ley y numero requeridos' });
      let q = supabase.from('articulos')
        .select('id_unico, numero_articulo, nivel_primario, nivel_secundario')
        .eq('pais', pais).eq('ley', ley)
        .ilike('numero_articulo', `%${numero}%`)
        .limit(10);
      q = conEstado(q, estado);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ resultados: data || [] });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error('[abogado.js] Error:', err);
    return res.status(500).json({ error: 'Error en la base de datos', details: err.message });
  }
}
