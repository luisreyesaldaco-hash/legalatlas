import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export async function buscarArticulos(pregunta, estado, ley = 'Código Civil', limite = 5) {
  const { data, error } = await supabase.rpc('buscar_texto', {
    filtro_estado: estado,
    pregunta,
    limite
  })

  if (error) throw new Error(`Supabase error: ${error.message}`)

  return (data || []).map(art => ({
    numero:    art.numero_articulo,
    texto:     art.texto_original,
    jerarquia: [art.libro, art.titulo, art.capitulo].filter(Boolean).join(' > '),
    id_unico:  art.id_unico
  }))
}
