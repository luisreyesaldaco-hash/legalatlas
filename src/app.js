import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    // Asumimos que tienes un id="pais" en tu HTML, si no, lo definimos como constante
    const selectPais = document.getElementById("pais"); 
    const displayFuente = document.getElementById("fuente-oficial-display");

    async function enviarConsulta() {
        // 1. Captura de valores dinámicos
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais ? selectPais.value : "mexico"; // Default si no hay selector
        const estado = selectEstado.value;
        const tema = selectTema.value;

        // 2. Validación estricta
        if (!pregunta) return;
        if (!estado || !tema || !pais) {
            alert("Por favor selecciona País, Estado y Tema.");
            return;
        }

        // UI: Mostrar pregunta y limpiar input
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // UI: Crear indicador de carga
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando leyes locales...", "asistente", idCarga);

        try {
            // 3. Ejecución del Motor (Construye ruta dinámica)
            console.log(`[APOLO] Buscando en: jurisdicciones/${pais}/${estado}/${tema}.json`);
            const dataLocal = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            console.log("[APOLO] Artículos encontrados:", dataLocal.reglas_relevantes);

            if (dataLocal.fuente) displayFuente.innerText = dataLocal.fuente;

            // 4. Llamada a la API de Inteligencia
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta: pregunta,
                    contextoLegal: dataLocal.reglas_relevantes || [],
                    fuente: dataLocal.fuente || "Legislación Local",
                    estado: estado
                })
            });

            if (!res.ok) throw new Error("Error en la respuesta de la API");

            const dataIA = await res.json();
            
            // Quitar mensaje de carga
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // 5. Mostrar respuesta final
            if (dataIA.error) {
                agregarMensaje("Error: " + dataIA.error, "asistente");
            } else {
                agregarMensaje(dataIA.respuesta, "asistente");
            }

        } catch (err) {
            console.error("ERROR CRÍTICO:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) {
                loadingElement.innerHTML = "<strong>Error:</strong> No se pudo procesar la consulta.";
            }
        }
    } // <-- Aquí terminaba el bloque try-catch que faltaba

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        // Reemplaza saltos de línea por <br> para que se vea bien el texto de la IA
        div.innerHTML = texto.replace(/\n/g, '<br>');
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // Event Listeners
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { 
        if (e.key === "Enter") enviarConsulta(); 
    });
});