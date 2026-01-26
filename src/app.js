import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    let modoActual = "consulta";
    document.querySelectorAll(".modo-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".modo-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo;
        });
    });

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        if (!pais || !estado || !tema) {
            alert("⚠️ Selecciona Jurisdicción, Estado y Tema.");
            return;
        }
        if (!pregunta) return;

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO procesando...", "asistente", idCarga);

        try {
            // 1. MOTOR LOCAL
            const datosLegales = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            // 2. IA (Tu asesoria.js)
            // Asegúrate de que tu backend esté escuchando en /api/asesoria
            const resIA = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta,
                    modo: modoActual,
                    contexto: datosLegales.reglas_relevantes,
                    tema: tema,
                    estado: estado
                })
            });

            const data = await resIA.json();
            document.getElementById(idCarga)?.remove();

            // 3. RENDERIZADO
            let html = "";
            if (modoActual === "redactar") {
                html = `<div style="border-left: 3px solid #b8973d; padding: 15px; background: white;">
                            <p style="font-family: serif; white-space: pre-wrap;">${data.respuesta}</p>
                        </div>`;
            } else {
                html = `<div>${data.respuesta}</div>`;
                
                // TRIAGE INTELIGENTE AL DIRECTORIO
                if (pregunta.toLowerCase().includes("pago") || pregunta.toLowerCase().includes("renta")) {
                    html += `
                        <div style="margin-top:15px; background:#1a1a1a; color:white; padding:15px; border-radius:12px;">
                            <p style="font-size:12px; margin-bottom:10px;">Conflicto detectado. Especialistas disponibles:</p>
                            <a href="directorio.html?materia=${tema}" style="color:#b8973d; font-weight:bold; text-decoration:none;">VER ABOGADOS EN ${estado.toUpperCase()} →</a>
                        </div>`;
                }
            }
            agregarMensaje(html, "asistente");

        } catch (err) {
            console.error(err);
            document.getElementById(idCarga).innerText = "Error de conexión con la IA.";
        }
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => e.key === "Enter" && enviarConsulta());
});

function agregarMensaje(texto, remitente, id = null) {
    const div = document.createElement("div");
    div.classList.add("mensaje", remitente);
    if (id) div.id = id;
    div.innerHTML = texto;
    document.getElementById("mensajes").appendChild(div);
    document.getElementById("mensajes").scrollTop = document.getElementById("mensajes").scrollHeight;
}