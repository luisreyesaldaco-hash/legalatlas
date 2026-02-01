import { ejecutarMotorEstructurado } from './motor.js';

let DATA_JURISDICCIONES = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SELECTORES (Verifica que estos IDs existan en tu HTML)
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const groupEstado = document.getElementById("group-estado");
    const displayFuente = document.getElementById("fuente-oficial-display");

    // 2. MEMORIA Y PERSISTENCIA
    function guardarFiltrosEnMemoria() {
        const filtros = {
            pais: selectPais.value,
            estado: selectEstado.value || '',
            tema: selectTema.value
        };
        localStorage.setItem('filtroUsuario', JSON.stringify(filtros));
    }

    // 3. CARGA DE CONFIGURACIÓN
    async function cargarConfiguracion() {
        try {
            const res = await fetch('./jurisdicciones.json');
            DATA_JURISDICCIONES = await res.json();
            console.log("✅ Jurisdicciones cargadas:", DATA_JURISDICCIONES);
        } catch (e) {
            console.error("❌ Error cargando JSON:", e);
        }
    }

    // 4. INTERFAZ DINÁMICA
    function actualizarInterfazPorPais() {
        const pais = selectPais.value;
        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;

        if (config && config.esFederal) {
            groupEstado.style.display = "block";
            selectEstado.innerHTML = '<option value="">SELECCIONE...</option>';
            config.estados.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.val;
                opt.innerText = est.nom;
                selectEstado.appendChild(opt);
            });
        } else {
            groupEstado.style.display = "none";
            selectEstado.innerHTML = ''; 
        }
        guardarFiltrosEnMemoria();
    }

    // 5. FUNCIÓN DE ENVÍO (CORREGIDA)
    async function enviarConsulta() {
        console.log("🚀 Intento de envío detectado...");
        
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        // Validaciones
        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;
        const necesitaEstado = config && config.esFederal;

        if (!pregunta || !pais || !tema || (necesitaEstado && !estado)) {
            alert("⚠️ Por favor, completa todos los campos.");
            return;
        }

        // Interfaz: Mensaje usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando...", "asistente", idCarga);

        // Lógica de carpetas (Ruta Federal México)
        const estadoBusqueda = necesitaEstado ? estado : "nacional";
        let rutaFinalEstado = estadoBusqueda;
        if (pais === "mexico" && tema === "despido") {
            rutaFinalEstado = "federal";
        }

        try {
            console.log(`Buscando en: ${pais}/${rutaFinalEstado}/${tema}`);
            
            // 1. Motor Local
            const dataLocal = await ejecutarMotorEstructurado(pais, rutaFinalEstado, tema, pregunta);

            // 2. Llamada a API
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais, 
                    estado: rutaFinalEstado, 
                    tema, 
                    pregunta,
                    contextoLegal: dataLocal.reglas_relevantes || [],
                    fuente: dataLocal.fuente || "Legislación Local"
                })
            });

            if (!res.ok) throw new Error("Error en servidor API");
            const dataIA = await res.json();
            
            // Limpiar cargador
            document.getElementById(idCarga)?.remove();

            const r = dataIA.respuesta;
            const idBtn = "btn-" + Date.now();
            const necesitaTriage = (tema === "despido") || r.confianza === "Baja";

            // HTML de respuesta
            let html = `
                <div class="apolo-resumen"><strong>Análisis:</strong> ${r.resumen}</div>
                <div class="apolo-draft" style="margin-top:10px; border-left:4px solid #b8973d; padding-left:10px;">
                    ${r.draftHtml}
                </div>
            `;

            if (necesitaTriage) {
                const txtUbicacion = (rutaFinalEstado === "federal") ? pais.toUpperCase() : estado.toUpperCase();
                html += `
                    <button id="${idBtn}" style="margin-top:15px; width:100%; background:#2d2d2d; color:white; padding:10px; border-radius:5px; cursor:pointer;">
                        VER ESPECIALISTAS EN ${txtUbicacion}
                    </button>
                `;
            }

            agregarMensaje(html, "asistente");

            if (necesitaTriage) {
                document.getElementById(idBtn).onclick = () => {
                    window.location.href = `directorio.html?materia=${tema}&estado=${rutaFinalEstado}&pais=${pais}`;
                };
            }

        } catch (err) {
            console.error("❌ ERROR EN CONSULTA:", err);
            document.getElementById(idCarga).innerHTML = "Error al conectar con el motor legal.";
        }
    }

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.className = `mensaje ${remitente}`;
        if (id) div.id = id;
        div.innerHTML = texto;
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // --- INICIO ---
    await cargarConfiguracion();
    
    // Escuchadores
    selectPais.addEventListener('change', actualizarInterfazPorPais);
    selectEstado.addEventListener('change', guardarFiltrosEnMemoria);
    selectTema.addEventListener('change', guardarFiltrosEnMemoria);
    
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });
});