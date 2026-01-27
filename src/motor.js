// ===============================
//   MOTOR PREMIUM LEGAL ATLAS
//   Ontología + Texto + Pesos
// ===============================

let ontologiaGlobal = {};

async function cargarOntologia() {
    // Evitar recargar si ya está cargada
    if (Object.keys(ontologiaGlobal).length > 0) return;

    try {
        const res = await fetch('/src/ontologia.json');
        ontologiaGlobal = await res.json();
        console.log("🧠 Ontología cargada:", Object.keys(ontologiaGlobal).length, "conceptos");
    } catch (err) {
        console.error("❌ Error cargando ontologia.json:", err);
    }
}

// -------------------------------
// Utilidades
// -------------------------------
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function tokenizar(texto) {
    return normalizar(texto)
        .split(/[\s,.;:!?()]+/)
        .filter(t => t.length > 2);
}

// -------------------------------
// 1. Detectar conceptos en la pregunta
// -------------------------------
function detectarConceptos(pregunta) {
    const tokens = tokenizar(pregunta);
    const conceptosDetectados = new Set();

    for (const concepto in ontologiaGlobal) {
        const sinonimos = ontologiaGlobal[concepto].map(s => normalizar(s));
        for (const token of tokens) {
            if (sinonimos.includes(token)) {
                conceptosDetectados.add(concepto);
            }
        }
    }

    return Array.from(conceptosDetectados);
}

// -------------------------------
// 2. Score por ontología
// -------------------------------
function scoreOntologia(ontologiaArticulo, conceptosPregunta) {
    let score = 0;

    for (const concepto of conceptosPregunta) {
        if (ontologiaArticulo.includes(concepto)) {
            score += 5; // peso fuerte
        }
    }

    return score;
}

// -------------------------------
// 3. Score por coincidencia textual
// -------------------------------
function scoreTexto(textoArticulo, pregunta) {
    const p = normalizar(pregunta);
    const t = normalizar(textoArticulo);

    let score = 0;

    // coincidencia directa
    if (t.includes(p)) score += 4;

    // coincidencia por tokens
    const tokens = tokenizar(pregunta);
    for (const token of tokens) {
        if (t.includes(token)) score += 1;
    }

    return score;
}

// -------------------------------
// 4. Score por banderas
// -------------------------------
function scoreBanderas(banderas) {
    let score = 0;

    if (banderas.irrenunciable) score += 3;
    if (banderas.validacion) score += 2;
    if (banderas.supletoria) score += 1;

    return score;
}

// -------------------------------
// 5. Score total
// -------------------------------
function calcularScore(articulo, conceptosPregunta, pregunta) {
    const s1 = scoreOntologia(articulo.ontologia_target || [], conceptosPregunta);
    const s2 = scoreTexto(articulo.texto || "", pregunta);
    const s3 = scoreBanderas(articulo.banderas || {});

    return s1 + s2 + s3;
}

// -------------------------------
// 6. Motor principal
// -------------------------------
export async function ejecutarMotorEstructurado(pais, estado, tema, pregunta) {
    try {
        // 1. Cargar ontología global
        await cargarOntologia();

        // 2. Cargar artículos del tema
        const ruta = `/jurisdicciones/${pais.toLowerCase()}/${estado.toLowerCase()}/${tema.toLowerCase()}.json`;
        const res = await fetch(ruta);

        if (!res.ok) {
            console.error("❌ Error cargando JSON:", ruta);
            return { reglas_relevantes: [], fuente: null };
        }

        const data = await res.json();
        const articulos = data.articulos || [];

        console.log("📘 Artículos cargados:", articulos.length);

        // 3. Detectar conceptos
        const conceptos = detectarConceptos(pregunta);
        console.log("🧠 Conceptos detectados:", conceptos);

        // 4. Calcular score por artículo
        const articulosConScore = articulos.map(a => ({
            ...a,
            score: calcularScore(a, conceptos, pregunta)
        }));

        // 5. Filtrar por score mínimo
        const relevantes = articulosConScore
            .filter(a => a.score >= 4) // mínimo razonable
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // top 10

        console.log("📌 Reglas relevantes:", relevantes.map(r => ({ id: r.id, score: r.score })));

        // 6. Compactar payload para la API
        const compactos = relevantes.map(a => ({
            id: a.id,
            numero: a.numero,
            texto: a.texto,
            regla: a.regla || a.texto
        }));

        return {
            reglas_relevantes: compactos,
            fuente: data.fuente || null
        };

    } catch (err) {
        console.error("❌ ERROR MOTOR PREMIUM:", err);
        return { reglas_relevantes: [], fuente: null };
    }
}