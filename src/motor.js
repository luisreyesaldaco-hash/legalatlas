import { readFile } from 'fs/promises';
import { join } from 'path';

async function cargarJSON(rutaRelativa) {
  try {
    const caminoAbsoluto = join(process.cwd(), rutaRelativa);
    const contenido = await readFile(caminoAbsoluto, 'utf-8');
    return JSON.parse(contenido);
  } catch (error) {
    console.error(`Error cargando ${rutaRelativa}:`, error.message);
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

// Mapa de sinónimos para poder ayudar al motor a entender la intención
const sinonimosLegales = {
  "paga": ["pago", "renta", "precio", "contraprestacion", "cumplimiento"],
  "renta": ["pago", "precio", "contraprestacion", "alquiler"],
  "no paga": ["incumplimiento", "falta", "pago", "mora"],
  "plazo": ["tiempo", "duracion", "termino", "vigencia"],
  "dueño": ["arrendador", "propietario"],
  "inquilino": ["arrendatario", "usuario"]
};

function puntuarRegla(reglaObj, palabrasClave) {
  let score = 0;
  const textoReglaNorm = normalizarTexto(reglaObj.regla || "");
  const categoriaNorm = normalizarTexto(reglaObj.categoria_juridica || "");

  palabrasClave.forEach(palabra => {
    // Si la palabra está en el texto del artículo (Ej: "pago", "arrendatario")
    if (textoReglaNorm.includes(palabra)) score += 10;
    
    // Si la palabra coincide con la categoría (Ej: "obligaciones")
    if (categoriaNorm.includes(palabra)) score += 5;

    // Buscar sinónimos
    if (sinonimosLegales[palabra]) {
      sinonimosLegales[palabra].forEach(sinonimo => {
        if (textoReglaNorm.includes(sinonimo)) score += 3;
      });
    }
  });

  return score;
}

export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  const contexto = estado ? `${tema} en ${estado}, ${pais}` : `${tema} en ${pais}`;
  const rutaJurisdiccion = estado 
    ? `jurisdicciones/${pais}/${estado}/${tema}.json` 
    : `jurisdicciones/${pais}/${tema}.json`;

  const reglas = await cargarJSON(rutaJurisdiccion);

  if (!reglas || !Array.isArray(reglas)) {
    return { contexto, reglas_relevantes: [], mensaje_sistema: "Archivo no encontrado." };
  }

  // Extraer palabras de la pregunta quitando conectores
  const stopwords = ["que", "la", "el", "de", "un", "es", "mi", "si"];
  const palabrasClave = normalizarTexto(preguntaUsuario)
    .split(" ")
    .filter(p => p.length > 2 && !stopwords.includes(p));

  // Calificar cada artículo del JSON
  const relevantes = reglas
    .map(r => ({ ...r, _score: puntuarRegla(r, palabrasClave) }))
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 5); // Enviamos los 5 mejores artículos a la IA

  return {
    contexto,
    pregunta: preguntaUsuario,
    reglas_relevantes: relevantes.map(r => ({
      articulo: r.articulo,
      regla: r.regla
    }))
  };
}