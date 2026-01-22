import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const displayFuente = document.getElementById("fuente-oficial-display");

    async function enviarConsulta() {
    // 1. Capturamos los tres niveles de la carpeta
    const pais = document.getElementById("pais").value;   // "mexico" o "uruguay"
    const estado = document.getElementById("estado").value; // "guanajuato" o "montevideo"
    const tema = document.getElementById("tema").value;     // "arrendamiento"
    const pregunta = inputPregunta.value.trim();

    // 2. Validación: Si falta algo, detenemos
    if (!pregunta || !pais || !estado || !tema) {
        alert("Por favor selecciona País, Estado y Tema.");
        return;
    }

    // 3. El Motor ahora recibe el país real seleccionado
    const dataLocal = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);

    // LOG DE DIAGNÓSTICO (Para que veas la ruta en la consola)
    console.log(`Buscando en: jurisdicciones/${pais}/${estado}/${tema}.json`);
    console.log("Artículos encontrados:", dataLocal.reglas_relevantes);

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