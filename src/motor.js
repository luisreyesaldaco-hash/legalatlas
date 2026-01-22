// motor.js - Versión Final Optimizada para APOLO

async function cargarJSON(rutaRelativa) {
  try {
    // IMPORTANTE: Asegúrate de que tenga el '/' inicial
    // para que busque desde legalatlas.io/jurisdicciones...
    const respuesta = await fetch(`/${rutaRelativa}`); 
    if (!respuesta.ok) throw new Error(`Error: ${respuesta.status}`);
    return await respuesta.json();
  } catch (error) {
    console.error("El motor no pudo leer el archivo:", error);
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
  // Blindaje contra valores nulos o indefinidos
  const p = (pais || "").toLowerCase().trim();
  const e = (estado || "").toLowerCase().trim();
  const t = (tema || "").toLowerCase().trim();

  // Validación de seguridad para el tema
  if (!t) {
    return { 
      error: "No se especificó un tema jurídico.", 
      reglas_relevantes: [] 
    };
  }

  // Construcción de ruta (buscando en la carpeta jurisdicciones del root)
  const rutaJurisdiccion = e 
    ? `jurisdicciones/${p}/${e}/${t}.json` 
    : `jurisdicciones/${p}/${t}.json`;

  const rawData = await cargarJSON(rutaJurisdiccion);

  if (!rawData) {
    return { 
      error: `No se pudo cargar la base de datos legal en: ${rutaJurisdiccion}`,
      reglas_relevantes: []
    };
  }

  // Soporte para ambos formatos (objeto con .reglas o array directo)
  const fuente = rawData.fuente_oficial || "Legislación Aplicable";
  const reglas = Array.isArray(rawData) ? rawData : (rawData.reglas || []);

  // Extraer palabras clave de la pregunta (solo palabras significativas)
  const palabrasClave = normalizarTexto(preguntaUsuario)
    .split(" ")
    .filter(palabra => palabra.length > 2);

  const relevantes = reglas
    .map(r => {
      let score = 0;
      // Buscamos en el texto de la regla, el número de artículo y los targets
      const textoBusqueda = normalizarTexto(
        `${r.regla} ${r.articulo} ${r.ontologia_target?.join(" ") || ""}`
      );
      
      palabrasClave.forEach(palabra => {
        if (textoBusqueda.includes(palabra)) score += 1;
      });
      return { ...r, _score: score };
    })
    .filter(r => r._score > 0) // Solo lo que coincida
    .sort((a, b) => b._score - a._score) // De mayor a menor relevancia
    .slice(0, 8); // Tomamos los 8 mejores para enviar al LLM

  return {
    fuente,
    reglas_relevantes: relevantes
  };
}