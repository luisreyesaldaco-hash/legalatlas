import { ejecutarMotorEstructurado } from './motor.js';

let DATA_JURISDICCIONES = null; // Aquí guardaremos lo que lea del JSON

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SELECTORES DE INTERFAZ
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const groupEstado = document.getElementById("group-estado");
    const displayFuente = document.getElementById("fuente-oficial-display");

    // 2. CARGA DEL JSON DE JURISDICCIONES
    async function cargarConfiguracion() {
        try {
            const res = await fetch('./jurisdicciones.json');
            DATA_JURISDICCIONES = await res.json();
        } catch (e) {
            console.error("No se pudo cargar el archivo de jurisdicciones:", e);
        }
    }

    // 3. LÓGICA DE INTERFAZ DINÁMICA
    function actualizarInterfazPorPais() {
        const pais = selectPais.value;
        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;

        if (config && config.esFederal) {
            // Es federal (México/USA): Mostrar estados y cambiar etiqueta
            groupEstado.style.display = "block";
            const label = groupEstado.querySelector('label');
            if (label) label.innerText = config.labelEstado;

            // Llenar estados
            selectEstado.innerHTML = '<option value="">SELECCIONE...</option>';
            config.estados.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.val;
                opt.innerText = est.nom;
                selectEstado.appendChild(opt);
            });
        } else {
            // No es federal (Chequia/Uruguay): Ocultar estados
            groupEstado.style.display = "none";
            selectEstado.innerHTML = ''; 
        }
    }

    // Inicializar
    await cargarConfiguracion();
    selectPais.addEventListener('change', actualizarInterfazPorPais);

    // 4. DETECTORES LÓGICOS (Tu código original)
    function detectarRedaccion(texto) {
        const t = texto.toLowerCase();
        return (t.includes("redacta") || t.includes("redacción") || t.includes("contrato"));
    }

    function detectarConflicto(texto) {
        const t = texto.toLowerCase();
        const claves = ["qué hago si", "demanda", "desalojo", "problema", "incumplio", "reparar"];
        return claves.some(c => t.includes(c));
    }

    // 5. FUNCIÓN PRINCIPAL DE CONSULTA
    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        // Validación dinámica usando el JSON
        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;
        const necesitaEstado = config && config.esFederal;

        if (!pregunta || !pais || !tema || (necesitaEstado && !estado)) {
            alert("⚠️ Por favor, completa todos los campos requeridos.");
            return;
        }

        // Interfaz Usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO está consultando la base legal...", "asistente", idCarga);

        const estadoBusqueda = necesitaEstado ? estado : "nacional";

        try {
            // Llamada al Motor Local
            const dataLocal = await ejecutarMotorEstructurado(pais, estadoBusqueda, tema, pregunta);

            if (dataLocal.fuente && displayFuente) {
                displayFuente.innerText = dataLocal.fuente;
                displayFuente.style.display = "block";
            }

            // Petición a la API (Asumimos que existe tu endpoint)
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais, 
                    estado: estadoBusqueda, 
                    tema, 
                    pregunta,
                    modo: detectarRedaccion(pregunta) ? "redactar" : (detectarConflicto(pregunta) ? "articulador" : "consulta"),
                    contextoLegal: dataLocal.reglas_relevantes || [],
                    fuente: dataLocal.fuente || "Legislación Local"
                })
            });

            if (!res.ok) throw new Error("Error en la API");
            const dataIA = await res.json();

            // Limpiar loader
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // Procesar Respuesta
            const r = dataIA.respuesta;
            const idBotonTriage = "btn-" + Date.now();
            const necesitaTriage = detectarConflicto(pregunta) || r.confianza === "Baja";

            let html = `
                <div class="apolo-resumen"><strong>Análisis:</strong> ${r.resumen}</div>
                <div class="apolo-draft" style="margin-top:10px; background:white; padding:15px; border-radius:8px; border-left:4px solid #b8973d; font-family:serif;">
                    ${r.draftHtml}
                </div>
            `;

            if (necesitaTriage) {
                const ubicacionTexto = necesitaEstado ? estado.toUpperCase() : pais.toUpperCase();
                html += `
                    <div class="apolo-triage" style="margin-top:15px; padding:12px; background:#f4f4f0; border-radius:8px; border:1px solid #e5e5e0;">
                        <button id="${idBotonTriage}" style="background:#1a1a1a; color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; width:100%;">
                            Ver abogados en ${ubicacionTexto}
                        </button>
                    </div>`;
            }

            agregarMensaje(html, "asistente");

            if (necesitaTriage) {
                document.getElementById(idBotonTriage).addEventListener("click", () => {
                    window.location.href = `directorio.html?materia=${tema}&estado=${estadoBusqueda}&pais=${pais}`;
                });
            }

        } catch (err) {
            console.error("ERROR CRÍTICO:", err);
            const loader = document.getElementById(idCarga);
            if (loader) loader.innerHTML = "Error al conectar con el motor legal.";
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
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });
});