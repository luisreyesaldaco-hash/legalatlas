import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const displayFuente = document.getElementById("fuente-oficial-display");

    // NUEVO: Selector de modo incrustado
    let modoActual = "consulta";
    const modoBtns = document.querySelectorAll(".modo-btn");

    modoBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modoBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo; // "consulta" o "redactar"
        });
    });

    // NUEVO: Detector oculto de conflicto → activa Articulador
    function detectarConflicto(p) {
        const claves = [
            "qué hago si", "que hago si",
            "me demandaron",
            "me quieren desalojar",
            "me quieren correr",
            "tengo un problema",
            "cómo procedo", "como procedo",
            "qué pasa si", "que pasa si",
            "mi arrendador",
            "mi empleador",
            "me están cobrando", "me estan cobrando",
            "quiero reclamar",
            "incumplió", "incumplio"
        ];
        const texto = p.toLowerCase();
        return claves.some(c => texto.includes(c));
    }

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

            // NUEVO: Determinar rol final
            let rol = modoActual; // consulta o redactar

            // Si el usuario describe un conflicto → activar articulador automáticamente
            if (detectarConflicto(pregunta)) {
                rol = "articulador";
            }

            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais,
                    estado,
                    tema,
                    pregunta,
                    modo: rol,
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

            const r = dataIA.respuesta;

            // Render premium
            let html = `
                <div class="apolo-resumen">${r.resumen}</div>
                <div class="apolo-draft">${r.draftHtml}</div>
            `;

            // Triage si confianza es media o baja
            if (r.confianza !== "Alta") {
                html += `
                    <div class="apolo-triage">
                        <button id="btn-triage">Conectar con abogado colaborador</button>
                    </div>
                `;
            }

            agregarMensaje(html, "asistente");

            // Listener triage
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