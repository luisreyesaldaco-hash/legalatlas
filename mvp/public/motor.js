// motor.js – versión computable v1.1 (añade salida estructurada)

async function cargarJSON(ruta) {
  try {
    const resp = await fetch(ruta);
    if (!resp.ok) {
      console.warn(`No se pudo cargar: ${ruta} (status ${resp.status})`);
      return null;
    }
    return await resp.json();
  } catch (e) {
    console.error(`Error al cargar ${ruta}:`, e);
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
  const stopwords = [
    "que","qué","dice","la","el","los","las","de","del","sobre","un","una",
    "en","y","o","para","por","segun","según","como","cuál","cual","cuáles",
    "cuales","es","son","al","lo","se","mi","su","tu","si"
  ];
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

const prioridadCategorias = [
  "definicion",
  "limites_legales",
  "prohibiciones",
  "obligaciones_arrendador",
  "obligaciones_usuario",
  "derechos_usuario",
  "riesgos",
  "reglas_supletorias"
];

function puntuarRegla(reglaObj, palabrasClave, ontosBuscadas) {
  let score = 0;

  const textoReglaNorm = normalizarTexto(reglaObj.regla || "");
  const plantillaNorm = normalizarTexto(reglaObj.plantilla_clausula || "");

  for (const palabra of palabrasClave) {
    if (textoReglaNorm.includes(palabra)) score += 2;
    if (plantillaNorm.includes(palabra)) score += 1;
  }

  const targets = reglaObj.ontologia_target || [];
  for (const o of targets) {
    if (ontosBuscadas.includes(o)) score += 3;
  }

  const idx = prioridadCategorias.indexOf(reglaObj.categoria_juridica);
  if (idx !== -1) {
    score += (prioridadCategorias.length - idx);
  }

  return score;
}

// 👉 NUEVO: salida estructurada para el backend
export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  const contexto = estado
    ? `${tema} en ${estado}, ${pais}`
    : `${tema} en ${pais}`;

  let rutaJurisdiccion;
  if (estado) {
    rutaJurisdiccion = `jurisdicciones/${pais}/${estado}/${tema}.json`;
  } else {
    rutaJurisdiccion = `jurisdicciones/${pais}/${tema}.json`;
  }

  const reglas = await cargarJSON(rutaJurisdiccion);

  if (!reglas || !Array.isArray(reglas) || reglas.length === 0) {
    return {
      contexto,
      pregunta: preguntaUsuario,
      reglas_relevantes: [],
      palabras_clave: [],
      ontologia_detectada: [],
      mensaje_sistema: "No encontré normas cargadas para este contexto."
    };
  }

  const palabrasClave = extraerPalabrasClave(preguntaUsuario);

  const ontosBuscadas = [];
  for (const palabra of palabrasClave) {
    const mapped = mapaOntologia[palabra];
    if (mapped) {
      mapped.forEach(o => {
        if (!ontosBuscadas.includes(o)) ontosBuscadas.push(o);
      });
    }
  }

  const reglasConScore = reglas.map(r => ({
    ...r,
    _score: puntuarRegla(r, palabrasClave, ontosBuscadas)
  }));

  const relevantes = reglasConScore
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
      plantilla_clausula: r.plantilla_clausula || "",
      banderas: r.banderas || {},
      validacion_logica: r.validacion_logica || "",
      ontologia_target: r.ontologia_target || []
    }))
  };
}

// 👉 Mantengo la versión string para tu frontend actual
function formatearRespuestaTexto(payload) {
  const { contexto, reglas_relevantes } = payload;

  if (!reglas_relevantes.length) {
    return `No encontré una norma específica para tu pregunta con la información actual.\n\n` +
           `Este es un MVP computable y aún estamos ampliando las jurisdicciones y temas.`;
  }

  let texto = `Con base en la información cargada para ${contexto}, encontré estas reglas relevantes:\n\n`;

  reglas_relevantes.slice(0, 5).forEach((r, i) => {
    texto += `${i + 1}. Artículo ${r.articulo} · ${r.categoria_juridica}\n`;
    texto += `   Regla: ${r.regla}\n`;
    if (r.plantilla_clausula) {
      texto += `   Posible cláusula: ${r.plantilla_clausula}\n`;
    }
    texto += `\n`;
  });

  texto += `Si quieres, puedo enfocarme solo en obligaciones, derechos, límites legales o riesgos según lo que preguntes.`;

  return texto;
}

export async function ejecutarMotor(pais, estado, tema, preguntaUsuario) {
  const payload = await ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario);
  return formatearRespuestaTexto(payload);
}