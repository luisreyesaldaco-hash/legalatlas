// motor.js - Versión Definitiva 2.0 para APOLO

/**
 * Carga el archivo JSON desde el servidor usando la ruta construida.
 */
async function cargarJSON(rutaRelativa) {
  try {
    // El / inicial asegura que busque desde la raíz del dominio (legalatlas.io/)
    const respuesta = await fetch(`/${rutaRelativa}`);
    if (!respuesta.ok) throw new Error(`No se encontró el archivo: ${rutaRelativa}`);
    return await respuesta.json();
  } catch (error) {
    console.error(`[Error Motor] No se pudo cargar el archivo legal:`, error.message);
    return null;
  }
}

/**
 * Limpia el texto de acentos, caracteres especiales y lo pasa a minúsculas
 * para que la búsqueda sea efectiva.
 */
function normalizarTexto(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos
    .replace(/[^a-z0-9ñ\s]/gi, " ")  // Mantiene solo letras y números
    .replace(/\s+/g, " ")             // Quita espacios dobles
    .trim();
}

/**
 * Función principal que busca artículos relevantes en el JSON local.
 */
export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  // 1. Blindaje de variables de entrada
  const p = (pais || "").toLowerCase().trim();
  const e = (estado || "").toLowerCase().trim();
  const t = (tema || "").toLowerCase().trim();

  if (!t) {
    return { error: "No se especificó un tema jurídico.", reglas_relevantes: [] };
  }

  // 2. Construcción de la ruta hacia el JSON
  // Ejemplo: jurisdicciones/mexico/guanajuato/arrendamiento.json
  const rutaJurisdiccion = e 
    ? `jurisdicciones/${p}/${e}/${t}.json` 
    : `jurisdicciones/${p}/${t}.json`;

  // 3. Intento de carga de datos
  const rawData = await cargarJSON(rutaJurisdiccion);
  if (!rawData) {
    return { 
      error: `La base de datos legal no está disponible en la ruta: ${rutaJurisdiccion}`,
      reglas_relevantes: [] 
    };
  }

  // 4. Identificación de la fuente y las reglas
  const fuente = rawData.fuente_oficial || "Legislación Aplicable";
  const reglas = Array.isArray(rawData) ? rawData : (rawData.reglas || []);

  // 5. Procesamiento de la búsqueda (Algoritmo de Scoring)
  const palabrasClave = normalizarTexto(preguntaUsuario)
    .split(" ")
    .filter(palabra => palabra.length > 2); // Ignoramos palabras cortas (de, la, el)

  const relevantes = reglas
    .map(r => {
      let score = 0;
      // Creamos un bloque de texto con el artículo, la regla y los targets para buscar
      const contenidoParaBuscar = normalizarTexto(
        `${r.articulo} ${r.regla} ${r.ontologia_target?.join(" ") || ""}`
      );
      
      palabrasClave.forEach(palabra => {
        // Coincidencia exacta (10 puntos)
        if (contenidoParaBuscar.includes(palabra)) {
          score += 10;
        } 
        // Coincidencia por raíz de palabra (ej: 'pago' en 'pagos') (5 puntos)
        else if (palabra.length > 4 && contenidoParaBuscar.includes(palabra.substring(0, 4))) {
          score += 5;
        }
      });
      return { ...r, _score: score };
    })
    .filter(r => r._score > 0)          // Solo conservamos lo que tiene coincidencia
    .sort((a, b) => b._score - a._score) // Ordenamos de más relevante a menos
    .slice(0, 10);                       // Enviamos el Top 10 a la IA

  // 6. Retorno de resultados para app.js
  return {
    fuente,
    reglas_relevantes: relevantes
  };
}