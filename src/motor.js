export async function ejecutarMotorEstructurado(pais, estado, tema, preguntaUsuario) {
  const p = (pais || "").toLowerCase().trim();
  const e = (estado || "").toLowerCase().trim();
  const t = (tema || "").toLowerCase().trim();

  if (!t) {
    return { error: "No se especificó un tema jurídico.", reglas_relevantes: [] };
  }

  const rutaJurisdiccion = e 
    ? `jurisdicciones/${p}/${e}/${t}.json` 
    : `jurisdicciones/${p}/${t}.json`;

  const rawData = await cargarJSON(rutaJurisdiccion);
  if (!rawData) {
    return { 
      error: `La base de datos legal no está disponible en la ruta: ${rutaJurisdiccion}`,
      reglas_relevantes: [] 
    };
  }

  const fuente = rawData.fuente_oficial || "Legislación Aplicable";
  const reglas = Array.isArray(rawData) ? rawData : (rawData.reglas || []);

  const palabrasClave = normalizarTexto(preguntaUsuario)
    .split(" ")
    .filter(palabra => palabra.length > 2);

  const relevantes = reglas
    .map(r => {
      let score = 0;
      const contenidoParaBuscar = normalizarTexto(
        `${r.articulo} ${r.regla} ${r.ontologia_target?.join(" ") || ""}`
      );

      palabrasClave.forEach(palabra => {
        if (contenidoParaBuscar.includes(palabra)) {
          score += 10;
        } else if (palabra.length > 4 && contenidoParaBuscar.includes(palabra.substring(0, 4))) {
          score += 5;
        }
      });

      const exact_match =
        preguntaUsuario.includes(String(r.articulo)) ||
        preguntaUsuario.toLowerCase().includes(`artículo ${r.articulo}`);

      const match_score = Math.min(score / (palabrasClave.length * 10), 1);

      return {
        articulo: r.articulo,
        regla: r.regla,
        match_score,
        exact_match,
        snippet: r.regla.slice(0, 120) + "...",
        source_id: `mx_${p}_${t}_${r.articulo}`,
        _score: score
      };
    })
    .filter(r => r._score > 0)
    .sort((a, b) => {
      if (a.exact_match && !b.exact_match) return -1;
      if (!a.exact_match && b.exact_match) return 1;
      return b._score - a._score;
    })
    .slice(0, 10);

  return {
    fuente,
    reglas_relevantes: relevantes
  };
}