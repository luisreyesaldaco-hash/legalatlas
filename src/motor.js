// ===============================
//   MOTOR PREMIUM LEGAL ATLAS
// ===============================

let ontologiaGlobal = {};

// Cargar ontología
async function cargarOntologia(tema) {
    try {
        const res = await fetch(`/ontologias/${tema}.json`);
        if (!res.ok) throw new Error("No se pudo cargar la ontología del tema");
        ontologiaGlobal = await res.json();
    } catch (err) {
        console.warn("⚠️ Ontología no disponible, usando búsqueda textual.");
        ontologiaGlobal = {};
    }
}


function normalizar(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function tokenizar(texto) {
    return normalizar(texto)
        .split(/[\s,.;:!?()]+/)
        .filter(t => t.length > 2);
}

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

// ===============================
//   SCORE UNIVERSAL
// ===============================

function calcularScore(articulo, conceptosPregunta, pregunta) {
    let score = 0;

    const textoArt = normalizar(articulo.regla || articulo.texto || "");
    const preguntaNorm = normalizar(pregunta);

    // 1. Ontología (peso fuerte)
    const ontArt = articulo.ontologia_target || [];
    conceptosPregunta.forEach(c => {
        if (ontArt.includes(c)) score += 8;
    });

    // 2. Coincidencia textual
    if (textoArt.includes(preguntaNorm)) score += 5;

    const tokens = tokenizar(pregunta);
    tokens.forEach(t => {
        if (textoArt.includes(t)) score += 1;
    });

    // 3. Banderas
    if (articulo.banderas?.irrenunciable) score += 3;

    // 4. Conflicto (solo si el artículo regula conflicto)
    if (articulo.banderas?.conflicto) score += 3;

    // 5. Jerarquía (más alta = número más bajo)
    if (articulo.jerarquia) {
        score += (10 - articulo.jerarquia);
    }

    return score;
}

// ===============================
//   MOTOR UNIVERSAL
// ===============================

export async function ejecutarMotorEstructurado(pais, estado, tema, pregunta) {
    try {
        await cargarOntologia();

        // 1. Países federales vs unitarios
        const paisesFederales = ["mexico", "usa", "argentina", "brasil"];
        const esFederal = paisesFederales.includes(pais.toLowerCase());

        const ruta = esFederal
            ? `/jurisdicciones/${pais.toLowerCase()}/${estado.toLowerCase()}/${tema.toLowerCase()}.json`
            : `/jurisdicciones/${pais.toLowerCase()}/${tema.toLowerCase()}.json`;

        const res = await fetch(ruta);
        if (!res.ok) {
            return { reglas_relevantes: [], fuente: "Legislación" };
        }

        const data = await res.json();

        // 2. Extraer artículos
        const articulosRaw = data.articulos || [];

        // 3. Detectar conceptos
        const conceptos = detectarConceptos(pregunta);

        // 4. Calcular score universal
        const filtrados = articulosRaw
            .map(a => ({
                ...a,
                score: calcularScore(a, conceptos, pregunta)
            }))
            .filter(a => a.score > 2)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // ahora 10 artículos

        // 5. Compactar para asesoria.js
        const compactos = filtrados.map(a => ({
            numero: a.numero,
            texto: a.regla || a.texto,
            ontologia: a.ontologia_target || [],
            nombre_ley: a.nombre_ley || "Ley"
        }));

        return {
            reglas_relevantes: compactos,
            fuente: data.fuentes ? data.fuentes.join(", ") : "Legislación"
        };

    } catch (err) {
        console.error("❌ ERROR MOTOR:", err);
        return { reglas_relevantes: [], fuente: null };
    }
}