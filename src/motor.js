// ===============================
//   MOTOR PREMIUM LEGAL ATLAS
// ===============================

let ontologiaGlobal = {};

// Función interna para cargar la ontología sin bloquear
async function cargarOntologia() {
    if (Object.keys(ontologiaGlobal).length > 0) return;
    try {
        const res = await fetch('/src/ontologia.json');
        if (!res.ok) throw new Error("No se pudo cargar ontologia.json");
        ontologiaGlobal = await res.json();
    } catch (err) {
        console.warn("⚠️ Ontología no disponible, usando búsqueda textual.");
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

function calcularScore(articulo, conceptosPregunta, pregunta) {
    let score = 0;
    const textoArt = normalizar(articulo.texto || "");
    const preguntaNorm = normalizar(pregunta);

    // 1. Score por Ontología (Peso fuerte)
    const ontArt = articulo.ontologia_target || [];
    conceptosPregunta.forEach(c => {
        if (ontArt.includes(c)) score += 8;
    });

    // 2. Score por Coincidencia Textual
    if (textoArt.includes(preguntaNorm)) score += 5;
    const tokens = tokenizar(pregunta);
    tokens.forEach(t => {
        if (textoArt.includes(t)) score += 1;
    });

    // 3. Score por Banderas
    if (articulo.banderas?.irrenunciable) score += 3;
    
    return score;
}

export async function ejecutarMotorEstructurado(pais, estado, tema, pregunta) {
    try {
        // Cargar ontología si no está lista
        await cargarOntologia();

        const ruta = `/jurisdicciones/${pais.toLowerCase()}/${estado.toLowerCase()}/${tema.toLowerCase()}.json`;
        const res = await fetch(ruta);

        if (!res.ok) return { reglas_relevantes: [], fuente: "Legislación" };

        const data = await res.json();
        // Manejar si el JSON es una lista [] o tiene objeto .articulos
        const articulosRaw = Array.isArray(data) ? data : (data.articulos || []);

        const conceptos = detectarConceptos(pregunta);

        const filtrados = articulosRaw
            .map(a => ({
                ...a,
                score: calcularScore(a, conceptos, pregunta)
            }))
            .filter(a => a.score > 2) // Umbral mínimo de relevancia
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);

        // PASO CLAVE: Enviamos numero, texto Y ontología para que la IA cite
        const compactos = filtrados.map(a => ({
            numero: a.numero,
            texto: a.texto,
            ontologia: a.ontologia_target || [] // <--- Aquí incluimos la ontología
        }));

        return {
            reglas_relevantes: compactos,
            fuente: data.fuente || "Código Civil"
        };

    } catch (err) {
        console.error("❌ ERROR MOTOR:", err);
        return { reglas_relevantes: [], fuente: null };
    }
}