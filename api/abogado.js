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

    // ── leyes (por pais) — usa RPC server-side para clasificar federal/estatal ─
    if (action === 'leyes') {
      if (!pais) return res.status(400).json({ error: 'Parámetro pais requerido' });
      const { data, error } = await supabase.rpc('obtener_leyes_por_pais', { p_pais: pais });
      if (error) throw error;
      return res.status(200).json({ leyes: data || [] });
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

    // ── niveles_primarios (libro) ─────────────────────────────────────────────
    if (action === 'niveles_primarios') {
      if (!pais || !ley) return res.status(400).json({ error: 'Parámetros pais y ley requeridos' });
      let q = supabase.from('articulos').select('libro')
        .eq('pais', pais).eq('ley', ley).not('libro', 'is', null).neq('libro', '');
      q = conEstado(q, estado);
      const { data, error } = await q;
      if (error) throw error;
      const unique = [...new Set((data || []).map(r => r.libro).filter(Boolean))];
      return res.status(200).json({ niveles_primarios: unique });
    }

    // ── niveles_secundarios (titulo) ──────────────────────────────────────────
    if (action === 'niveles_secundarios') {
      if (!pais || !ley || !nivel_primario) return res.status(400).json({ error: 'Parámetros pais, ley y nivel_primario requeridos' });
      let q = supabase.from('articulos').select('titulo')
        .eq('pais', pais).eq('ley', ley)
        .eq('libro', nivel_primario)
        .not('titulo', 'is', null).neq('titulo', '');
      q = conEstado(q, estado);
      const { data, error } = await q;
      if (error) throw error;
      const unique = [...new Set((data || []).map(r => r.titulo).filter(Boolean))];
      return res.status(200).json({ niveles_secundarios: unique });
    }

    // ── articulos_capitulo ───────────────────────────────────────────────────
    if (action === 'articulos_capitulo') {
      if (!pais || !ley || !nivel_secundario) return res.status(400).json({ error: 'Parámetros pais, ley y nivel_secundario requeridos' });
      let q = supabase.from('articulos').select('id_unico, numero_articulo')
        .eq('pais', pais).eq('ley', ley)
        .eq('titulo', nivel_secundario)
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
        .select('id_unico, numero_articulo, libro, titulo')
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
