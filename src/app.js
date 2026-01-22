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

        if (!pregunta || !estado || !tema) {
            alert("Completa: Estado, Tema y Pregunta.");
            return;
        }

        console.log("--- INICIANDO CONSULTA ---");
        console.log("Pregunta:", pregunta);
        console.log("Ruta que se buscará:", `mexico / ${estado} / ${tema}`);

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO analizando leyes locales...", "asistente", idCarga);

        try {
            // EJECUCIÓN DEL MOTOR
            const dataLocal = await ejecutarMotorEstructurado("mexico", estado, tema, pregunta);
            
            console.log("Respuesta del Motor:", dataLocal);

            if (dataLocal.fuente) displayFuente.innerText = dataLocal.fuente;

            // LLAMADA A LA API
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

            const dataIA = await res.json();
            document.getElementById(idCarga)?.remove();

            if (dataIA.error) {
                agregarMensaje("Error: " + dataIA.error, "asistente");
            } else {
                agregarMensaje(dataIA.respuesta, "asistente");
            }

        } catch (err) {
            console.error("ERROR CRÍTICO:", err);
            document.getElementById(idCarga).innerText = "Error de comunicación con la unidad lógica.";
        }
    }

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerHTML = texto.replace(/\n/g, '<br>');
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });
});