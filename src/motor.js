import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

async function cargarJSON(rutaRelativa) {
  try {
    const caminoAbsoluto = join(process.cwd(), rutaRelativa);
    
    // DEBUG: Útil para entornos como Vercel
    const carpetaBase = join(process.cwd(), 'jurisdicciones');
    try {
        await readdir(carpetaBase);
    } catch (e) {
        console.error("La carpeta 'jurisdicciones' no se detecta en la raíz.");
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
  // 1. Normalización de parámetros
  const p = pais.toLowerCase().trim();
  const e = estado ? estado.toLowerCase().trim() : "";
  const t = tema.toLowerCase().trim();

  const contexto = e ? `${t} en ${e}, ${p}` : `${t} en ${p}`;
  
  // 2. Construcción de ruta (Soporta Nacional y Estatal)
  // Si hay estado: jurisdicciones/mexico/guanajuato/matrimonio.json
  // Si no hay estado: jurisdicciones/colombia/matrimonio.json
  const rutaJurisdiccion = e 
    ? `jurisdicciones/${p}/${e}/${t}.json` 
    : `jurisdicciones/${p}/${t}.json`;

  const rawData = await cargarJSON(rutaJurisdiccion);

  // 3. Validación de la nueva estructura (Encabezado + Reglas)
  if (!rawData) {
    return { 
        contexto, 
        reglas_relevantes: [], 
        error_tecnico: `Archivo no encontrado en: ${rutaJurisdiccion}` 
    };
  }

  // Soporte para ambos formatos (el nuevo objeto o el array viejo para compatibilidad)
  const fuente = rawData.fuente_oficial || "Legislación Aplicable";
  const reglas = Array.isArray(rawData) ? rawData : (rawData.reglas || []);

  if (reglas.length === 0) {
    return { contexto, reglas_relevantes: [], fuente };
  }

  const palabrasClave = normalizarTexto(preguntaUsuario).split(" ");

  // 4. Búsqueda por relevancia (Scoring)
  const relevantes = reglas
    .map(r => {
      let score = 0;
      // Buscamos en la regla y en la ontología para mayor precisión
      const textoBusqueda = normalizarTexto(r.regla + " " + (r.ontologia_target?.join(" ") || ""));
      
      palabrasClave.forEach(palabra => {
        if (palabra.length > 2 && textoBusqueda.includes(palabra)) score += 1;
      });
      return { ...r, _score: score };
    })
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);

  // 5. Retorno para app.js
  return {
    fuente,
    contexto,
    pregunta: preguntaUsuario,
    reglas_relevantes: relevantes.map(r => ({
      articulo: r.articulo,
      regla: r.regla
    }))
  };
}