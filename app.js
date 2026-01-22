// app.js - Versión Blindada y Modular para APOLO
import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const displayFuente = document.getElementById("fuente-oficial-display");

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const estado = selectEstado.value;
        const tema = selectTema.value;

        if (!pregunta || !estado) return;

        // UI: Mostrar pregunta del usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // UI: Efecto de carga
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando leyes locales y procesando respuesta...", "asistente", idCarga);

        try {
            // PASO 1: Búsqueda Local (Sin costo de API)
            const dataLocal = await ejecutarMotorEstructurado("mexico", estado, tema, pregunta);
            
            if (dataLocal.fuente) displayFuente.innerText = dataLocal.fuente;

            // PASO 2: Llamada a tu LLM en Vercel
            // Le pasamos la pregunta Y los artículos que encontramos
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta: pregunta,
                    contextoLegal: dataLocal.reglas_relevantes, // Los artículos del JSON
                    fuente: dataLocal.fuente,
                    estado: estado
                })
            });

            const dataIA = await res.json();
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // PASO 3: Renderizar la respuesta inteligente
            if (dataIA.error) {
                agregarMensaje("Error en el sistema central: " + dataIA.error, "asistente");
            } else {
                agregarMensaje(dataIA.respuesta, "asistente");
            }

        } catch (err) {
            console.error(err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.innerText = "Error: La unidad lógica no responde.";
        }
    }

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerHTML = texto; // Usar innerHTML para que el LLM mande negritas o listas
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });
});