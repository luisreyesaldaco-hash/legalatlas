import { ejecutarMotorEstructurado } from './motor.js';

let DATA_JURISDICCIONES = null;
let contenedorMensajes = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SELECTORES DE INTERFAZ
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const groupEstado = document.getElementById("group-estado");
    const displayFuente = document.getElementById("fuente-oficial-display");

    // --- ESCUCHADORES PARA GUARDAR FILTROS ---
    function guardarFiltrosEnMemoria() {
        const filtros = {
            pais: selectPais.value,
            estado: selectEstado.value || '',
            tema: selectTema.value
        };
        localStorage.setItem('filtroUsuario', JSON.stringify(filtros));
    }

    selectPais.addEventListener('change', () => {
        actualizarInterfazPorPais();
        guardarFiltrosEnMemoria();
    });
    selectEstado.addEventListener('change', guardarFiltrosEnMemoria);
    selectTema.addEventListener('change', guardarFiltrosEnMemoria);

    // 2. CARGA DE CONFIGURACIÓN
    async function cargarConfiguracion() {
        try {
            const res = await fetch('./jurisdicciones.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            DATA_JURISDICCIONES = await res.json();
        } catch (e) {
            console.error("No se pudo cargar el archivo de jurisdicciones:", e);
            DATA_JURISDICCIONES = {}; // fallback seguro
        }
    }

    // 3. LÓGICA DE INTERFAZ DINÁMICA (Muestra/Oculta estados)
    function actualizarInterfazPorPais() {
        const pais = selectPais.value;
        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;

        if (config && config.esFederal) {
            groupEstado.style.display = "block";
            const label = groupEstado.querySelector('label');
            if (label) label.innerText = config.labelEstado || 'Estado';

            selectEstado.innerHTML = '<option value="">SELECCIONE...</option>';
            (config.estados || []).forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.val;
                opt.innerText = est.nom;
                selectEstado.appendChild(opt);
            });
        } else {
            groupEstado.style.display = "none";
            selectEstado.innerHTML = '';
        }
    }

    // Inicialización
    await cargarConfiguracion();
    actualizarInterfazPorPais();

    // 4. DETECTORES LÓGICOS
    function detectarRedaccion(texto) {
        const t = (texto || '').toLowerCase();
        return (t.includes("redacta") || t.includes("redacción") || t.includes("contrato"));
    }

    function detectarConflicto(texto) {
        const t = (texto || '').toLowerCase();
        const claves = ["qué hago si", "demanda", "desalojo", "problema", "incumplio", "reparar", "incumplimiento"];
        return claves.some(c => t.includes(c));
    }

    // 5. FUNCIÓN PRINCIPAL DE CONSULTA
    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;
        const necesitaEstado = config && config.esFederal;

        if (!pregunta || !pais || !tema || (necesitaEstado && !estado)) {
            alert("⚠️ Por favor, completa todos los campos requeridos.");
            return;
        }

        agregarMensaje(escapeHtml(pregunta), "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO está consultando la base legal...", "asistente", idCarga);

        const estadoBusqueda = necesitaEstado ? estado : "nacional";

        // --- CAMBIO QUIRÚRGICO PARA MÉXICO LABORAL ---
        let rutaFinalEstado = estadoBusqueda;
        if (pais === "mexico" && tema === "despido") {
            rutaFinalEstado = "federal";
        }
        // ----------------------------------------------

        try {
            // Llamada al motor local
            const dataLocal = await ejecutarMotorEstructurado(pais, rutaFinalEstado, tema, pregunta);

            if (dataLocal && dataLocal.fuente && displayFuente) {
                displayFuente.innerHTML = `<i class="fas fa-shield-halved"></i> JURISPRUDENCIA APLICADA: ${escapeHtml(dataLocal.fuente)}`;
                displayFuente.style.display = "block";
            } else if (displayFuente) {
                displayFuente.style.display = "none";
            }

            // Llamada a la API de asesoría
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais,
                    estado: rutaFinalEstado,
                    tema,
                    pregunta,
                    modo: detectarRedaccion(pregunta) ? "redactar" : (detectarConflicto(pregunta) ? "articulador" : "consulta"),
                    contextoLegal: (dataLocal && dataLocal.reglas_relevantes) ? dataLocal.reglas_relevantes : [],
                    fuente: (dataLocal && dataLocal.fuente) ? dataLocal.fuente : "Legislación Local"
                })
            });

            if (!res.ok) throw new Error("Error en la API: " + res.status);
            const dataIA = await res.json();

            // limpiar loader
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            const r = dataIA.respuesta || {};
            const idBotonTriage = "btn-" + Date.now();
            const necesitaTriage = detectarConflicto(pregunta) || r.confianza === "Baja";

            // CONSTRUCCIÓN DEL HTML DE RESPUESTA (una sola vez)
            let html = `
                <div class="apolo-resumen"><strong>Análisis:</strong> ${escapeHtml(r.resumen || '')}</div>
                <div class="apolo-draft" style="margin-top:10px; background:white; padding:15px; border-radius:8px; border-left:4px solid #b8973d; font-family:serif; color:#333;">
                    ${r.draftHtml || ''}
                </div>
            `;

            // FUNDAMENTACIÓN
            if (r.articulos && Array.isArray(r.articulos) && r.articulos.length > 0) {
                html += `
                    <div style="margin-top:15px; font-size:11px; color:var(--accent-gold); font-weight:bold; display:flex; align-items:center; gap:8px; letter-spacing:0.05em;">
                        <i class="fas fa-gavel"></i> 
                        <span>FUNDAMENTACIÓN TÉCNICA: Arts. ${r.articulos.map(a => escapeHtml(String(a))).join(", ")}</span>
                    </div>
                `;
            }

            // BLOQUE TRIAGE (si aplica)
            if (necesitaTriage) {
                const ubicacionTexto = (rutaFinalEstado === "federal" || !necesitaEstado) ? pais.toUpperCase() : estado.toUpperCase();
                html += `
                    <div class="apolo-triage" style="margin-top:15px; padding:12px; background:#f4f4f0; border-radius:8px; border:1px solid #e5e5e0;">
                        <button id="${idBotonTriage}" style="background:var(--stone-dark); color:white; border:none; padding:10px; border-radius:4px; cursor:pointer; width:100%; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em;">
                            Ver especialistas en ${escapeHtml(ubicacionTexto)}
                        </button>
                    </div>`;
            }

            // Inyectar HTML una sola vez
            agregarMensaje(html, "asistente");

            // Asignar listener al botón triage (si existe)
            if (necesitaTriage) {
                const botonRegistrado = document.getElementById(idBotonTriage);
                if (botonRegistrado) {
                    botonRegistrado.addEventListener("click", () => {
                        window.location.href = `directorio.html?materia=${encodeURIComponent(tema)}&estado=${encodeURIComponent(rutaFinalEstado)}&pais=${encodeURIComponent(pais)}`;
                    });
                }
            }

        } catch (err) {
            console.error("ERROR CRÍTICO:", err);
            const loader = document.getElementById(idCarga);
            if (loader) loader.innerHTML = "Error al conectar con el motor legal.";
            else agregarMensaje("Error al conectar con el motor legal.", "asistente");
        }
    }

    // Asignar listeners (solo una vez)
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });

    // Utilidad: escape básico para evitar inyección en partes no HTML (dejamos draftHtml sin escapar por diseño)
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // agregarMensaje usa la variable global contenedorMensajes
    function agregarMensaje(texto, remitente, id = null) {
        if (!contenedorMensajes) {
            console.error("contenedorMensajes no inicializado");
            return;
        }
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerHTML = texto;
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }
}); // Cierre del DOMContentLoaded