// motor.js – Versión final optimizada para Vercel
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Carga archivos JSON desde el sistema de archivos de Vercel
 */
async function cargarJSON(rutaRelativa) {
  try {
    // process.cwd() apunta a la raíz del proyecto en Vercel
    const caminoAbsoluto = join(process.cwd(), rutaRelativa);
    console.log("Intentando cargar archivo en:", caminoAbsoluto);
    
    const contenido = await readFile(caminoAbsoluto, 'utf-8');
    return JSON.parse(contenido);
  } catch (error) {
    console.error(`Error crítico cargando ${rutaRelativa}:`, error.message);
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

function extraerPalabrasClave(pregunta) {
  const stopwords = ["que","qué","dice","la","el","los","las","de","del","sobre","un","una","en","y","o","para","por","segun","según","como","cuál","cual","cuáles","cuales","es","son","al","lo","se","mi","su","tu","si"];
  const tokens = normalizarTexto(pregunta).split(" ");
  return tokens.filter(t => t && !stopwords.includes(t));
}

const mapaOntologia = {
  "arrendamiento": ["vinculo","bien","tiempo","contraprestacion"],
  "renta": ["contraprestacion"],
  "precio": ["contraprestacion"],
  "duracion": ["tiempo"],
  "plazo": ["tiempo"],
  "uso": ["bien","usuario"],
  "contrato": ["vinculo", "tiempo"],
  "goce": ["bien","usuario"],
  "obligaciones": ["obligaciones_basicas","obligaciones_usuario","obligaciones_arrendador"],
  "derechos": ["derechos_usuario"],
  "riesgos": ["riesgos"],
  "incendio": ["riesgos"],
  "mejoras": ["bien"],
  "reparaciones": ["bien"],
  "terminacion": ["vinculo"],
  "rescisión": ["vinculo","contraprestacion"],
  "rescision": ["vinculo","contraprestacion"],
  "pago": ["contraprestacion"],
  "pagar": ["contraprestacion"],
  "inquilino": ["usuario"],
  "arrendatario": ["usuario"],
  "arrendador": ["titular"]
};

const prioridadCategorias = ["definicion","limites_legales","prohibiciones","obligaciones_arrendador","obligaciones_usuario","derechos_usuario","riesgos","reglas_supletorias"];

function puntuarRegla(reglaObj, palabrasClave, ontosBuscadas) {
  let score = 0;
  const textoReglaNorm = normalizarTexto(reglaObj.regla || "");
  const plantillaNorm = normalizarTexto(reglaObj.plantilla_clausula || "");

  palabrasClave.forEach(palabra => {
    if (textoReglaNorm.includes(palabra)) score += 2;
    if (plantillaNorm.includes(palabra)) score += 1;
  });

  const targets = reglaObj.ontologia_target || [];
  targets.forEach(o => {
    if (ontosBuscadas.includes(o)) score += 3;
  });

  const idx = prioridadCategorias.indexOf(reglaObj.categoria_juridica);
  if (idx !== -1) score += (prioridadCategorias.length - idx);

  return score;
}

export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  const contexto = estado ? `${tema} en ${estado}, ${pais}` : `${tema} en ${pais}`;
  
  // Construcción de ruta bien limpia para evitar errores de slash doble
  let rutaJurisdiccion = "";
  if (estado && estado.trim() !== "") {
    rutaJurisdiccion = `jurisdicciones/${pais}/${estado}/${tema}.json`;
  } else {
    rutaJurisdiccion = `jurisdicciones/${pais}/${tema}.json`;
  }

  const reglas = await cargarJSON(rutaJurisdiccion);

  if (!reglas || !Array.isArray(reglas)) {
    return { 
      contexto, 
      pregunta: preguntaUsuario, 
      reglas_relevantes: [], 
      mensaje_sistema: `Error: No se pudo encontrar el archivo legal en ${rutaJurisdiccion}` 
    };
  }

  const palabrasClave = extraerPalabrasClave(preguntaUsuario);
  const ontosBuscadas = [];
  palabrasClave.forEach(p => {
    if (mapaOntologia[p]) {
      mapaOntologia[p].forEach(o => { 
        if (!ontosBuscadas.includes(o)) ontosBuscadas.push(o); 
      });
    }
  });

  const relevantes = reglas
    .map(r => ({ ...r, _score: puntuarRegla(r, palabrasClave, ontosBuscadas) }))
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 10);

  return {
    contexto,
    pregunta: preguntaUsuario,
    palabras_clave: palabrasClave,
    ontologia_detectada: ontosBuscadas,
    reglas_relevantes: relevantes.map(r => ({
      articulo: r.articulo,
      categoria_juridica: r.categoria_juridica,
      regla: r.regla,
      plantilla_clausula: r.plantilla_clausula || ""
    }))
  };
}
