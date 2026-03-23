import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, estado, ley, nivel_primario, nivel_secundario, id, numero } = req.query;

  if (!action) {
    return res.status(400).json({ error: 'Parámetro action requerido' });
  }

  try {
    // ── estados ─────────────────────────────────────────────────────────────
    if (action === 'estados') {
      const { data, error } = await supabase
        .from('articulos')
        .select('estado')
        .not('estado', 'is', null);

      if (error) throw error;

      const unique = [...new Set((data || []).map(r => r.estado).filter(Boolean))].sort();
      return res.status(200).json({ estados: unique });
    }

    // ── leyes ────────────────────────────────────────────────────────────────
    if (action === 'leyes') {
      if (!estado) return res.status(400).json({ error: 'Parámetro estado requerido' });

      const { data, error } = await supabase
        .from('articulos')
        .select('ley')
        .eq('estado', estado)
        .not('ley', 'is', null);

      if (error) throw error;

      const unique = [...new Set((data || []).map(r => r.ley).filter(Boolean))].sort();
      return res.status(200).json({ leyes: unique });
    }

    // ── niveles_primarios ────────────────────────────────────────────────────
    if (action === 'niveles_primarios') {
      if (!estado || !ley) return res.status(400).json({ error: 'Parámetros estado y ley requeridos' });

      const { data, error } = await supabase
        .from('articulos')
        .select('nivel_primario')
        .eq('estado', estado)
        .eq('ley', ley)
        .not('nivel_primario', 'is', null);

      if (error) throw error;

      const unique = [...new Set((data || []).map(r => r.nivel_primario).filter(Boolean))].sort();
      return res.status(200).json({ niveles_primarios: unique });
    }

    // ── niveles_secundarios ──────────────────────────────────────────────────
    if (action === 'niveles_secundarios') {
      if (!estado || !ley || !nivel_primario) {
        return res.status(400).json({ error: 'Parámetros estado, ley y nivel_primario requeridos' });
      }

      const { data, error } = await supabase
        .from('articulos')
        .select('nivel_secundario')
        .eq('estado', estado)
        .eq('ley', ley)
        .eq('nivel_primario', nivel_primario)
        .not('nivel_secundario', 'is', null);

      if (error) throw error;

      const unique = [...new Set((data || []).map(r => r.nivel_secundario).filter(Boolean))].sort();
      return res.status(200).json({ niveles_secundarios: unique });
    }

    // ── articulos_capitulo ───────────────────────────────────────────────────
    if (action === 'articulos_capitulo') {
      if (!estado || !ley || !nivel_secundario) {
        return res.status(400).json({ error: 'Parámetros estado, ley y nivel_secundario requeridos' });
      }

      const { data, error } = await supabase
        .from('articulos')
        .select('id_unico, numero_articulo')
        .eq('estado', estado)
        .eq('ley', ley)
        .eq('nivel_secundario', nivel_secundario)
        .order('numero_articulo', { ascending: true });

      if (error) throw error;

      return res.status(200).json({ articulos: data || [] });
    }

    // ── articulo (single) ────────────────────────────────────────────────────
    if (action === 'articulo') {
      if (!id) return res.status(400).json({ error: 'Parámetro id requerido' });

      const { data, error } = await supabase
        .from('articulos')
        .select('*')
        .eq('id_unico', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return res.status(404).json({ error: 'Artículo no encontrado' });
        throw error;
      }

      return res.status(200).json({ articulo: data });
    }

    // ── buscar ───────────────────────────────────────────────────────────────
    if (action === 'buscar') {
      if (!estado || !ley || !numero) {
        return res.status(400).json({ error: 'Parámetros estado, ley y numero requeridos' });
      }

      const { data, error } = await supabase
        .from('articulos')
        .select('id_unico, numero_articulo, nivel_primario, nivel_secundario')
        .eq('estado', estado)
        .eq('ley', ley)
        .ilike('numero_articulo', `%${numero}%`)
        .limit(10);

      if (error) throw error;

      return res.status(200).json({ resultados: data || [] });
    }

    // ── unknown action ───────────────────────────────────────────────────────
    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error('[abogado.js] Error:', err);
    return res.status(500).json({ error: 'Error en la base de datos', details: err.message });
  }
}
