// motor.js - Versión para Navegador (usa fetch)

async function cargarJSON(rutaRelativa) {
  try {
    // En el navegador, las rutas deben ser relativas a la raíz del servidor
    const respuesta = await fetch(`/${rutaRelativa}`);
    if (!respuesta.ok) throw new Error(`No se encontró el archivo: ${rutaRelativa}`);
    return await respuesta.json();
  } catch (error) {
    console.error(`Error cargando el archivo legal:`, error.message);
    return null;
  }
}

function normalizarTexto(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñáéíóúü\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  const p = pais.toLowerCase().trim();
  const e = estado ? estado.toLowerCase().trim() : "";
  const t = tema.toLowerCase().trim();

  // Construcción de ruta para el servidor web
  const rutaJurisdiccion = e 
    ? `jurisdicciones/${p}/${e}/${t}.json` 
    : `jurisdicciones/${p}/${t}.json`;

  const rawData = await cargarJSON(rutaJurisdiccion);

  if (!rawData) {
    return { 
        error: `No se pudo cargar la base de datos legal en: ${rutaJurisdiccion}` 
    };
  }

  // Soporte para ambos formatos (nuevo objeto o array viejo)
  const fuente = rawData.fuente_oficial || "Legislación Aplicable";
  const reglas = Array.isArray(rawData) ? rawData : (rawData.reglas || []);

  const palabrasClave = normalizarTexto(preguntaUsuario).split(" ");

  const relevantes = reglas
    .map(r => {
      let score = 0;
      const textoBusqueda = normalizarTexto(r.regla + " " + (r.articulo) + " " + (r.ontologia_target?.join(" ") || ""));
      
      palabrasClave.forEach(palabra => {
        if (palabra.length > 2 && textoBusqueda.includes(palabra)) score += 1;
      });
      return { ...r, _score: score };
    })
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);

  return {
    fuente,
    reglas_relevantes: relevantes
  };
}