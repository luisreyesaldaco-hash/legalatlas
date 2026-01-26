// motor.js - LÓGICA DE BÚSQUEDA LEGAL
export async function cargarJSON(rutaRelativa) {
  try {
    const respuesta = await fetch(`/${rutaRelativa}`);
    if (!respuesta.ok) throw new Error(`No se encontró el archivo: ${rutaRelativa}`);
    return await respuesta.json();
  } catch (error) {
    console.error(`[Error Motor] No se pudo cargar el archivo legal:`, error.message);
    return null;
  }
}

export function normalizarTexto(texto) {
  return (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ\s]/gi, " ").replace(/\s+/g, " ").trim();
}

export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  const p = (pais || "").toLowerCase().trim();
  const e = (estado || "").toLowerCase().trim();
  const t = (tema || "").toLowerCase().trim();

  const ruta = `jurisdicciones/${p}/${e}/${t}.json`; // Asegúrate de que esta carpeta exista
  const rawData = await cargarJSON(ruta);

  if (!rawData) return { reglas_relevantes: [] };

  const reglas = Array.isArray(rawData) ? rawData : (rawData.reglas || []);
  const palabrasClave = normalizarTexto(preguntaUsuario).split(" ").filter(palabra => palabra.length > 2);

  const relevantes = reglas.map(r => {
    let score = 0;
    const contenidoParaBuscar = normalizarTexto(`${r.articulo} ${r.regla}`);
    palabrasClave.forEach(palabra => {
      if (contenidoParaBuscar.includes(palabra)) score += 10;
    });
    return { articulo: r.articulo, regla: r.regla, score };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

  return { reglas_relevantes: relevantes.slice(0, 5) };
}