import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const displayFuente = document.getElementById("fuente-oficial-display");

    // DETECTORES (Se mantienen igual, son excelentes)
    function detectarRedaccion(texto) {
        const t = texto.toLowerCase();
        return (t.includes("redacta") || t.includes("redacción") || t.includes("contrato"));
    }

    function detectarConflicto(texto) {
        const t = texto.toLowerCase();
        const claves = ["qué hago si", "demanda", "desalojo", "problema", "incumplio"];
        return claves.some(c => t.includes(c));
    }

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais ? selectPais.value : "mexico";
        const estado = selectEstado.value;
        const tema = selectTema.value;

        if (!pregunta || !estado || !tema) {
            alert("Selecciona País, Estado y Tema.");
            return;
        }

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando leyes locales...", "asistente", idCarga);

        try {
            // 1. Motor estructurado (Ojo: que devuelva .numero y .texto)
            const dataLocal = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);

            if (dataLocal.fuente && displayFuente) {
                displayFuente.innerText = dataLocal.fuente;
                displayFuente.style.display = "block";
            }

            // 2. Determinar rol
            let rol = "consulta";
            if (detectarRedaccion(pregunta)) rol = "redactar";
            if (detectarConflicto(pregunta)) rol = "articulador";

            // 3. Llamada a la API
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais, estado, tema, pregunta,
                    modo: rol,
                    contextoLegal: dataLocal.reglas_relevantes || [],
                    fuente: dataLocal.fuente || "Código Civil Local"
                })
            });

            if (!res.ok) throw new Error("Error en la API");
            const dataIA = await res.json();

            // Quitar loader
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // 4. RENDER PREMIUM (Ajustado al objeto 'respuesta' de asesoria.js)
            const r = dataIA.respuesta; // El objeto JSON que devuelve la IA

            // Usamos una clase única para el botón de esta respuesta específica
            const idBotonTriage = "btn-" + Date.now();

            let html = `
                <div class="apolo-resumen"><strong>Resumen:</strong> ${r.resumen}</div>
                <div class="apolo-draft" style="margin-top:10px; background:white; padding:15px; border-radius:8px; border-left:4px solid #b8973d; font-family:serif;">
                    ${r.draftHtml}
                </div>
            `;

            if (r.confianza !== "Alta" || rol === "articulador") {
                html += `
                    <div class="apolo-triage" style="margin-top:15px; padding:12px; background:#1a1a1a; border-radius:8px; color:white;">
                        <p style="font-size:12px; margin-bottom:8px;">⚠️ Confianza ${r.confianza}: Se recomienda validación profesional.</p>
                        <button class="triage-trigger" id="${idBotonTriage}" 
                                style="background:#b8973d; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">
                            Conectar con abogado en ${estado}
                        </button>
                    </div>
                `;
            }

            agregarMensaje(html, "asistente");

            // 5. Listener de Triage (Corregido para múltiples mensajes)
            setTimeout(() => {
                const btn = document.getElementById(idBotonTriage);
                if (btn) {
                    btn.addEventListener("click", () => {
                        window.location.href = `directorio.html?materia=${tema}&estado=${estado}`;
                    });
                }
            }, 100);

        } catch (err) {
            console.error("ERROR:", err);
            const loader = document.getElementById(idCarga);
            if (loader) loader.innerHTML = "Error al procesar consulta legal.";
        }
    }

    // AGREGAR MENSAJE
    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerHTML = texto;
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });
});