import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    let modoActual = "consulta"; // Por defecto

    // Manejo de los botones de modo (Consulta/Redactar)
    document.querySelectorAll(".modo-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".modo-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo;
        });
    });

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const config = {
            pais: selectPais.value,
            estado: selectEstado.value,
            tema: selectTema.value
        };

        // VALIDACIÓN: No hace nada si faltan campos
        if (!config.pais || !config.estado || !config.tema) {
            alert("⚠️ Selecciona Jurisdicción, Estado y Tema.");
            return;
        }
        if (!pregunta) return;

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";
        const idCarga = "loading-" + Date.now();
        agregarMensaje('<i class="fas fa-spinner fa-spin"></i> APOLO procesando...', "asistente", idCarga);

        try {
            // 1. LLAMADA AL MOTOR (Búsqueda de leyes)
            const datosLegales = await ejecutarMotorEstructurado(config.pais, config.estado, config.tema, pregunta);
            
            // Si el motor falla, usamos un array vacío para no romper la IA
            const contextoIA = (datosLegales && datosLegales.reglas_relevantes) ? datosLegales.reglas_relevantes : [];

            // 2. LLAMADA A LA IA (Aquí es donde estaba el error del F12)
            const resIA = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta: pregunta,
                    modo: modoActual,
                    contexto: contextoIA, // Mandamos las leyes encontradas
                    tema: config.tema,
                    estado: config.estado
                })
            });

            if (!resIA.ok) throw new Error("Servidor de IA no responde");

            const dataIA = await resIA.json();
            document.getElementById(idCarga)?.remove();

            // 3. RENDERIZADO DE RESPUESTA
            const respuestaTexto = dataIA.respuesta || dataIA.resultado || "No se obtuvo respuesta.";
            
            let htmlFinal = "";
            if (modoActual === "redactar") {
                htmlFinal = `
                    <div style="border-left: 3px solid #b8973d; padding: 15px; background: white; border-radius: 8px;">
                        <p style="font-family: serif; white-space: pre-wrap; font-size: 14px;">${respuestaTexto}</p>
                    </div>`;
            } else {
                htmlFinal = `
                    <div style="color: #b8973d; font-size: 10px; font-weight: bold; margin-bottom: 5px;">ANÁLISIS LEGAL</div>
                    <div style="font-size: 14px;">${respuestaTexto}</div>`;
                
                // Triage automático al Directorio
                if (pregunta.toLowerCase().includes("pago") || pregunta.toLowerCase().includes("renta")) {
                    htmlFinal += `
                        <div style="margin-top:15px; background:#1a1a1a; color:white; padding:15px; border-radius:12px;">
                            <p style="font-size:11px; color:#b8973d; font-weight:800; margin-bottom:10px;">CONFLICTO DETECTADO</p>
                            <a href="directorio.html?materia=${config.tema}" style="color:white; font-weight:bold; text-decoration:underline; font-size:12px;">VER ABOGADOS EN ${config.estado.toUpperCase()} →</a>
                        </div>`;
                }
            }

            agregarMensaje(htmlFinal, "asistente");

        } catch (err) {
            console.error("Error Crítico:", err);
            const loader = document.getElementById(idCarga);
            if (loader) loader.innerHTML = "<strong>Error:</strong> No se pudo conectar con la IA. Revisa la consola (F12).";
        }
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if(e.key === 'Enter') enviarConsulta(); });
});

function agregarMensaje(texto, remitente, id = null) {
    const div = document.createElement("div");
    div.classList.add("mensaje", remitente);
    if (id) div.id = id;
    div.innerHTML = texto;
    document.getElementById("mensajes").appendChild(div);
    document.getElementById("mensajes").scrollTop = document.getElementById("mensajes").scrollHeight;
}