import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

async function cargarJSON(rutaRelativa) {
  try {
    const caminoAbsoluto = join(process.cwd(), rutaRelativa);
    // DEBUG: Vamos a ver qué archivos hay en la carpeta para saber si existe
    const carpetaPadre = join(process.cwd(), 'jurisdicciones');
    try {
        const contenidoCarpeta = await readdir(carpetaPadre);
        console.log("Archivos encontrados en jurisdicciones:", contenidoCarpeta);
    } catch (e) {
        console.error("La carpeta 'jurisdicciones' no existe en la raíz");
    }

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

export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  // 1. Forzamos minúsculas para evitar errores de Windows vs Linux (Vercel)
  const p = pais.toLowerCase().trim();
  const e = estado ? estado.toLowerCase().trim() : "";
  const t = tema.toLowerCase().trim();

  const contexto = e ? `${t} en ${e}, ${p}` : `${t} en ${p}`;
  
  // 2. Construcción de ruta ultra-precisa
  const rutaJurisdiccion = e 
    ? `jurisdicciones/${p}/${e}/${t}.json` 
    : `jurisdicciones/${p}/${t}.json`;

  const reglas = await cargarJSON(rutaJurisdiccion);

  // 3. Si no hay reglas, mandamos un mensaje de error técnico a la IA para que te avise
  if (!reglas || !Array.isArray(reglas)) {
    return { 
        contexto, 
        reglas_relevantes: [], 
        error_tecnico: `No se encontro el archivo en: ${rutaJurisdiccion}. Revisa que la carpeta se llame 'jurisdicciones' en minusculas.` 
    };
  }

  const palabrasClave = normalizarTexto(preguntaUsuario).split(" ");

  // 4. Búsqueda simple pero infalible por palabra
  const relevantes = reglas
    .map(r => {
      let score = 0;
      const textoRegla = normalizarTexto(r.regla);
      palabrasClave.forEach(palabra => {
        if (palabra.length > 2 && textoRegla.includes(palabra)) score += 1;
      });
      return { ...r, _score: score };
    })
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);

  return {
    contexto,
    pregunta: preguntaUsuario,
    reglas_relevantes: relevantes.map(r => ({
      articulo: r.articulo,
      regla: r.regla
    }))
  };
}