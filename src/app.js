import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const displayFuente = document.getElementById("fuente-oficial-display");

    // 1. DETECTORES LOGICOS
    function detectarRedaccion(texto) {
        const t = texto.toLowerCase();
        return (t.includes("redacta") || t.includes("redacción") || t.includes("contrato"));
    }

    function detectarConflicto(texto) {
        const t = texto.toLowerCase();
        const claves = [
            "qué hago si", "que hago si", "demanda", "desalojo", 
            "problema", "incumplio", "reparar", "falla", "cobrando"
        ];
        return claves.some(c => t.includes(c));
    }

    async function enviarConsulta() {
       const pregunta = inputPregunta.value.trim();
       const pais = selectPais?.value;
       const estado = selectEstado?.value;
       const tema = selectTema?.value;

       // 1. Definimos quiénes necesitan estado (puedes añadir más después)
       const paisesFederales = ["mexico", "usa", "argentina", "brasil"];
       const necesitaEstado = paisesFederales.includes(pais?.toLowerCase());

       // 2. Validación Dinámica: 
       // Solo exigimos 'estado' si 'necesitaEstado' es true.
       const camposIncompletos = !pregunta || !pais || !tema || (necesitaEstado && !estado);
       if (camposIncompletos) {
        alert("⚠️ Por favor, completa todos los campos requeridos.");
        return;
        }

        // 3. Interfaz
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO está consultando la base legal...", "asistente", idCarga);

        // 4. Preparar datos para el motor
    // Si no necesita estado, mandamos "nacional" para que la ruta sea /pais/tema.json
    const estadoBusqueda = necesitaEstado ? estado : "nacional";


        try {
            // 1. Llamada al Motor Local
            const dataLocal = await ejecutarMotorEstructurado(pais, estadoBusqueda, tema, pregunta);

            if (dataLocal.fuente && displayFuente) {
                displayFuente.innerText = dataLocal.fuente;
                displayFuente.style.display = "block";
            }

            // 2. Determinar el rol/modo
            let rol = "consulta";
            if (detectarRedaccion(pregunta)) rol = "redactar";
            if (detectarConflicto(pregunta)) rol = "articulador";

            // 3. Petición a la API de Asesoría
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais, 
                    estado: estadoBusqueda, // <-- CAMBIO AQUÍ
                    tema, 
                    pregunta,
                    modo: rol,
                    contextoLegal: dataLocal.reglas_relevantes || [],
                    fuente: dataLocal.fuente || "Legislación Local"
                })
            });

            if (!res.ok) throw new Error("Error en la API");
            const dataIA = await res.json();

            // Quitar el icono de carga
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // 4. PROCESAMIENTO DE RESPUESTA IA
            const r = dataIA.respuesta;
            const idBotonTriage = "btn-" + Date.now();

            // Lógica de Triage: Solo mostrar si hay conflicto o confianza baja
            const necesitaTriage = detectarConflicto(pregunta) || r.confianza === "Baja";

            let html = `
                <div class="apolo-resumen"><strong>Análisis:</strong> ${r.resumen}</div>
                <div class="apolo-draft" style="margin-top:10px; background:white; padding:15px; border-radius:8px; border-left:4px solid #b8973d; font-family:serif; line-height:1.5;">
                    ${r.draftHtml}
                </div>
            `;

            // Si hay artículos fundamentados, mostrarlos estéticamente
            if (r.articulos && r.articulos.length > 0) {
                html += `
                    <div style="margin-top:10px; font-size:11px; color:#b8973d; font-weight:bold;">
                        <i class="fas fa-gavel"></i> Fundamentación: Arts. ${r.articulos.join(", ")}
                    </div>
                `;
            }

            // Botón de abogado (Solo si es necesario)
            if (necesitaTriage) {
            // Definimos un texto amigable: si hay estado, lo ponemos; si no, ponemos el país.
            const ubicacionTexto = necesitaEstado ? estado.toUpperCase() : pais.toUpperCase();

               html += `
               <div class="apolo-triage" style="margin-top:15px; padding:12px; background:#f4f4f0; border-radius:8px; border:1px solid #e5e5e0;">
               <p style="font-size:11px; color:#666; margin-bottom:10px;">Para llevar este caso con un profesional especializado:</p>
               <button class="triage-trigger" id="${idBotonTriage}" 
                    style="background:#1a1a1a; color:white; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; font-weight:bold; width:100%;">
                Ver abogados en ${ubicacionTexto}
            </button>
        </div>
    `;
}

            agregarMensaje(html, "asistente");

            // 5. Listener dinámico para el botón de triage
            if (necesitaTriage) {
                setTimeout(() => {
                    const btn = document.getElementById(idBotonTriage);
                    if (btn) {
                        btn.addEventListener("click", () => {
                            window.location.href = `directorio.html?materia=${tema}&estado=${estado}`;
                        });
                    }
                }, 100);
            }

        } catch (err) {
            console.error("ERROR CRÍTICO:", err);
            const loader = document.getElementById(idCarga);
            if (loader) loader.innerHTML = "<strong>Error:</strong> No se pudo conectar con el motor legal.";
        }
    }

    // FUNCIÓN PARA INSERTAR EN EL DOM
    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerHTML = texto;
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // LISTENERS DE INTERFAZ
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { 
        if (e.key === "Enter") enviarConsulta(); 
    });
});