export async function ejecutarMotorEstructurado(pais, estado, tema, pregunta) {
    try {
        const ruta = `/jurisdicciones/${pais}/${estado.toLowerCase()}/${tema}.json`;

        console.log("📁 Cargando archivo de norma:", ruta);

        const res = await fetch(ruta);
        if (!res.ok) {
            console.error("❌ No se pudo cargar el archivo:", ruta);
            return {
                reglas_relevantes: [],
                fuente: "Sin fuente disponible"
            };
        }

        const data = await res.json();
        console.log("📘 Fuente legal:", data.fuente);
        console.log("📄 Artículos cargados:", data.articulos?.length || 0);

        const articulos = data.articulos || [];
        const preguntaLower = pregunta.toLowerCase();

        const reglas = articulos.filter(a => {
            const texto = a.texto.toLowerCase();

            const matchTexto =
                texto.includes(preguntaLower) ||
                preguntaLower.includes(a.id?.toLowerCase() || "");

            const matchFlags =
                (a.aplicable_en_consulta && preguntaLower.includes("consulta")) ||
                (a.aplicable_en_contratos && preguntaLower.includes("contrato")) ||
                (a.aplicable_en_conflictos && contieneConflicto(preguntaLower));

            return matchTexto || matchFlags;
        });

        console.log("📌 Reglas relevantes encontradas:", reglas.length);
        console.log("📌 Reglas:", reglas);

        return {
            reglas_relevantes: reglas,
            fuente: data.fuente || "Legislación Local"
        };

    } catch (err) {
        console.error("🔥 ERROR EN MOTOR ESTRUCTURADO:", err);
        return {
            reglas_relevantes: [],
            fuente: "Error al procesar la norma"
        };
    }
}