// app.js
import { ejecutarMotorEstructurado } from './motor.js';

let DATA_JURISDICCIONES = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. SELECTORES DE ELEMENTOS DEL HTML
    const selectPais = document.getElementById('pais');
    const selectEstado = document.getElementById('estado');
    const groupEstado = document.getElementById('group-estado');
    const btnEnviar = document.getElementById('enviar');
    const inputPregunta = document.getElementById('pregunta');
    const contenedorMensajes = document.getElementById('mensajes');
    const selectTema = document.getElementById('tema');
    const displayFuente = document.getElementById('fuente-oficial-display');

    // 2. CARGA DE CONFIGURACIÓN (Los países y estados del JSON)
    async function cargarConfiguracion() {
        try {
            const res = await fetch('./jurisdicciones.json');
            DATA_JURISDICCIONES = await res.json();
            console.log("✅ Configuración legal cargada");
        } catch (e) {
            console.error("❌ Error al cargar jurisdicciones.json:", e);
        }
    }

    // 3. LÓGICA DE LA INTERFAZ (Dropdowns)
    function actualizarInterfazPorPais() {
        const pais = selectPais.value;
        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;

        if (config && config.esFederal) {
            groupEstado.style.display = 'block';
            selectEstado.innerHTML = '<option value="">SELECCIONE...</option>';
            config.estados.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.val;
                opt.textContent = e.nom;
                selectEstado.appendChild(opt);
            });
        } else {
            groupEstado.style.display = 'none';
            selectEstado.innerHTML = '';
        }
    }

    // 4. FUNCIÓN DE ENVÍO AL MOTOR APOLO
    async function enviarConsulta() {
        if (displayFuente) displayFuente.style.display = "none"; // Limpia la fuente anterior
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        // Validaciones básicas
        const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;
        const necesitaEstado = config && config.esFederal;

        if (!pregunta || !pais || !tema || (necesitaEstado && !estado)) {
            alert("⚠️ Por favor, completa todos los campos de jurisdicción y materia.");
            return;
        }

        // Interfaz: Mostrar mensaje del usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // Mostrar indicador de carga
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando base normativa...", "asistente", idCarga);

        // --- LÓGICA DE RUTA INTELIGENTE (MÉXICO FEDERAL) ---
        let rutaEstado = necesitaEstado ? estado : "nacional";
        if (pais === "mexico" && tema === "despido") {
            rutaEstado = "federal";
        }

        try {
            // A. Ejecutar Motor Local (Ontos)
            const dataLocal = await ejecutarMotorEstructurado(pais, rutaEstado, tema, pregunta);
          if (dataLocal.fuente && displayFuente) {
          displayFuente.innerHTML = `<i class="fas fa-shield-halved"></i> JURISPRUDENCIA APLICADA: ${dataLocal.fuente}`;
          displayFuente.style.display = "block"; // Esto hace que aparezca sobre el input
        }
            // B. Llamada a la IA (Asesoría)
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais, 
                    estado: rutaEstado, 
                    tema, 
                    pregunta,
                    contextoLegal: dataLocal.reglas_relevantes || [],
                    fuente: dataLocal.fuente || "Legislación Local"
                })
            });

            const dataIA = await res.json();
            document.getElementById(idCarga)?.remove(); // Quitar el "cargando"

            const r = dataIA.respuesta;
            const idBtn = "btn-" + Date.now();
            const necesitaAbogado = (tema === "despido") || r.confianza === "Baja";

            // C. Construir Respuesta en el Chat
            let html = `
    <div><strong>Análisis:</strong> ${r.resumen}</div>
    <div style="margin-top:10px; border-left:4px solid #b8973d; padding-left:15px; font-family:serif; color:#333;">
        ${r.draftHtml}
    </div>
`;

// FUNDAMENTACIÓN (El mazo de juez)
// Aquí cerramos el string de arriba y usamos lógica real de JS
if (r.articulos && r.articulos.length > 0) {
    html += `
        <div style="margin-top:15px; font-size:11px; color:#b8973d; font-weight:bold; display:flex; align-items:center; gap:8px; letter-spacing:0.05em;">
            <i class="fas fa-gavel"></i> 
            <span>FUNDAMENTACIÓN TÉCNICA: Arts. ${r.articulos.join(", ")}</span>
        </div>
    `;
}

// BOTÓN DE DIRECTORIO

            if (necesitaAbogado) {
                // Si hay estado lo usa, si no, usa el nombre del país
                    const nombreLugar = estado ? estado.toUpperCase() : pais.toUpperCase();
                    const destino = (rutaEstado === "federal") ? pais.toUpperCase() : nombreLugar;
                    html += `
                    <button id="${idBtn}" style="margin-top:15px; width:100%; background:#1a1a1a; color:white; padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:10px;">
                        VER ESPECIALISTAS EN ${destino}
                    </button>
                `;
            }

            agregarMensaje(html, "asistente");

            // Evento para el botón dinámico del directorio
            if (necesitaAbogado) {
                document.getElementById(idBtn).onclick = () => {
                    window.location.href = `directorio.html?materia=${tema}&estado=${rutaEstado}&pais=${pais}`;
                };
            }

        } catch (err) {
            console.error("Error en el flujo:", err);
            const loader = document.getElementById(idCarga);
            if (loader) loader.innerHTML = "❌ Error en el procesamiento legal.";
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

    // --- INICIALIZACIÓN ---
    await cargarConfiguracion();
    
    selectPais.addEventListener('change', actualizarInterfazPorPais);
    btnEnviar.addEventListener('click', enviarConsulta);
    inputPregunta.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') enviarConsulta(); 
    });
});