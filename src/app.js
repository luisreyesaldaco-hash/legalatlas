// app.js - Versión Final Blindada para APOLO
import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const displayFuente = document.getElementById("fuente-oficial-display");

    async function enviarConsulta() {
        const pregunta = (inputPregunta.value || "").trim();
        const estado = selectEstado.value;
        const tema = selectTema.value;

        // VALIDACIÓN: Evita enviar si falta información crítica
        if (!pregunta) return;
        if (!estado || !tema) {
            agregarMensaje("Por favor, selecciona un **Estado** y un **Tema** antes de consultar.", "asistente");
            return;
        }

        // UI: Mostrar pregunta del usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // UI: Efecto de carga
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando leyes locales y procesando respuesta...", "asistente", idCarga);

        try {
            // PASO 1: Búsqueda Local (Sin costo de API)
            // Esto buscará en: /jurisdicciones/mexico/[estado]/[tema].json
            const dataLocal = await ejecutarMotorEstructurado("mexico", estado, tema, pregunta);
            
            if (dataLocal.fuente) {
                displayFuente.innerText = dataLocal.fuente;
            } else {
                displayFuente.innerText = "Consultando base general";
            }

            // PASO 2: Llamada a la API de Inteligencia en Vercel
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta: pregunta,
                    contextoLegal: dataLocal.reglas_relevantes || [], // Enviamos los artículos encontrados
                    fuente: dataLocal.fuente || "Legislación Local",
                    estado: estado
                })
            });

            // Manejo de error si la API no responde bien
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Error en el servidor de IA");
            }

            const dataIA = await res.json();
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // PASO 3: Renderizar la respuesta inteligente
            if (dataIA.error) {
                agregarMensaje("Error en el sistema central: " + dataIA.error, "asistente");
            } else {
                // Usamos innerHTML para procesar negritas o listas que envíe GPT
                agregarMensaje(dataIA.respuesta, "asistente");
            }

        } catch (err) {
            console.error("Error en flujo APOLO:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) {
                loadingElement.innerHTML = "<strong>Error de conexión:</strong> La unidad lógica no responde. Revisa tu conexión u OpenAI Key.";
            }
        }
    }

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        
        // Convertimos posibles saltos de línea de la IA en etiquetas <br>
        const textoProcesado = texto.replace(/\n/g, '<br>');
        div.innerHTML = textoProcesado;
        
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // Listeners
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { 
        if (e.key === "Enter") enviarConsulta(); 
    });
});