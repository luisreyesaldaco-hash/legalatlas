// ---------------------------------------------------------
//  MOTOR ESTRUCTURADO LEGAL ATLAS
//  Carga JSON según país / estado / tema
//  Filtra reglas relevantes
//  Devuelve { reglas_relevantes, fuente }
// ---------------------------------------------------------

export async function ejecutarMotorEstructurado(pais, estado, tema, pregunta) {
    try {
        // 1. Construir ruta del archivo JSON
        const ruta = `/jurisdicciones/${pais}/${estado.toLowerCase()}/${tema}.json`;

        // 2. Cargar archivo
        const res = await fetch(ruta);
        if (!res.ok) {
            console.error("No se pudo cargar el archivo:", ruta);
            return {
                reglas_relevantes: [],
                fuente: "Sin fuente disponible"
            };
        }

        const data = await res.json();

        // 3. Extraer artículos
        const articulos = data.articulos || [];

        // 4. Filtrar reglas relevantes según la pregunta
        const preguntaLower = pregunta.toLowerCase();

        const reglas = articulos.filter(a => {
            const texto = a.texto.toLowerCase();

            // Coincidencia textual básica
            const matchTexto =
                texto.includes(preguntaLower) ||
                preguntaLower.includes(a.id?.toLowerCase() || "");

            // Coincidencia por flags ontológicas
            const matchFlags =
                (a.aplicable_en_consulta && preguntaLower.includes("consulta")) ||
                (a.aplicable_en_conflictos && contieneConflicto(preguntaLower)) ||
                (a.aplicable_en_contratos && preguntaLower.includes("contrato"));

            return matchTexto || matchFlags;
        });

        return {
            reglas_relevantes: reglas,
            fuente: data.fuente || "Legislación Local"
        };

    } catch (err) {
        console.error("ERROR EN MOTOR ESTRUCTURADO:", err);
        return {
            reglas_relevantes: [],
            fuente: "Error al procesar la norma"
        };
    }
}

// ---------------------------------------------------------
//  Funciones auxiliares
// ---------------------------------------------------------

function capitalizar(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function contieneConflicto(texto) {
    const claves = [
        "problema",
        "demanda",
        "desalojo",
        "incumpl",
        "me quieren",
        "me estan",
        "me están",
        "qué hago",
        "que hago",
        "qué pasa",
        "que pasa"
    ];
    return claves.some(c => texto.includes(c));
}