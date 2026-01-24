import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const displayFuente = document.getElementById("fuente-oficial-display");

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais ? selectPais.value : "mexico";
        const estado = selectEstado.value;
        const tema = selectTema.value;

        if (!pregunta) return;
        if (!estado || !tema || !pais) {
            alert("Por favor selecciona País, Estado y Tema.");
            return;
        }

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando leyes locales...", "asistente", idCarga);

        try {
            console.log(`[APOLO] Buscando en: jurisdicciones/${pais}/${estado}/${tema}.json`);
            const dataLocal = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);

            console.log("[APOLO] Artículos encontrados:", dataLocal.reglas_relevantes);

            if (dataLocal.fuente) displayFuente.innerText = dataLocal.fuente;

            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais,
                    estado,
                    tema,
                    pregunta,
                    contextoLegal: dataLocal.reglas_relevantes || [],
                    fuente: dataLocal.fuente || "Legislación Local"
                })
            });

            if (!res.ok) throw new Error("Error en la respuesta de la API");

            const dataIA = await res.json();

            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            if (dataIA.error) {
                agregarMensaje("Error: " + dataIA.error, "asistente");
                return;
            }

            // NUEVO: Render estructurado
            const r = dataIA.respuesta;

            let html = `
                <div class="apolo-resumen">${r.resumen}</div>
                <div class="apolo-draft">${r.draftHtml}</div>
                <div class="apolo-meta">
                    <strong>Artículos citados:</strong> ${r.articulos.join(", ") || "Ninguno"}<br>
                    <strong>Confianza:</strong> ${r.confianza}
                </div>
            `;

            // Si confianza es media o baja → activar triage
            if (r.confianza !== "Alta") {
                html += `
                    <div class="apolo-triage">
                        <button id="btn-triage">Conectar con abogado colaborador</button>
                    </div>
                `;
            }

            agregarMensaje(html, "asistente");

            // Listener para triage
            setTimeout(() => {
                const btnTriage = document.getElementById("btn-triage");
                if (btnTriage) {
                    btnTriage.addEventListener("click", () => {
                        alert("Aquí conectamos al usuario con un abogado colaborador.");
                    });
                }
            }, 200);

        } catch (err) {
            console.error("ERROR CRÍTICO EN APP:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) {
                loadingElement.innerHTML = "<strong>Error:</strong> No se pudo procesar la consulta legal.";
            }
        }
    }

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerHTML = texto;
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => {
        if (e.key === "Enter") enviarConsulta();
    });
});