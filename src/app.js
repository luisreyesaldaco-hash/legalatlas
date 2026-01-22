// app.js - Versión Blindada y Modular para APOLO
import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Captura de elementos con los IDs del nuevo HTML
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectPais = document.getElementById("pais");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema"); 
    const displayFuente = document.getElementById("fuente-oficial-display");

    // Verificación de seguridad
    if (!btnEnviar || !inputPregunta) {
        console.error("Error: No se encontraron los elementos en el HTML. Revisa los IDs.");
        return;
    }

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        if (!pregunta) return;
        if (!estado) {
            agregarMensaje("Por favor, seleccione una jurisdicción (Estado) para continuar.", "asistente");
            return;
        }

        // Agregar mensaje del usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // Placeholder de carga (Efecto APOLO procesando)
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO está analizando la base de datos legal de " + estado.toUpperCase() + "...", "asistente", idCarga);

        try {
            // Ejecución del motor estructurado local
            const data = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            // Quitar mensaje de carga
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            if (data.error) {
                agregarMensaje("SISTEMA: " + data.error, "asistente");
                displayFuente.innerText = "";
            } else {
                // Actualizar la fuente oficial en el sidebar
                displayFuente.innerText = data.fuente || "";
                
                // Formatear y mostrar la respuesta
                if (data.reglas_relevantes && data.reglas_relevantes.length > 0) {
                    const respuestaFormateada = data.reglas_relevantes
                        .map(r => `<strong>Artículo ${r.articulo}:</strong> ${r.regla}`)
                        .join("<br><br>");
                    
                    agregarMensaje(respuestaFormateada, "asistente");
                } else {
                    agregarMensaje("No se encontraron fundamentos legales exactos para esta consulta en " + data.fuente, "asistente");
                }
            }
        } catch (err) {
            console.error(err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.innerText = "Error crítico de conexión con la unidad central lógica.";
        }
    }

    // Función para renderizar mensajes en el chat
    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        
        // Usamos innerHTML para permitir negritas y saltos de línea <br>
        div.innerHTML = texto;
        
        contenedorMensajes.appendChild(div);
        
        // Scroll automático al final
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // Eventos de escucha
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            enviarConsulta();
        }
    });
});