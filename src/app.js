// app.js - Versión Blindada para APOLO
document.addEventListener('DOMContentLoaded', () => {
    // 1. Captura de elementos con los IDs del nuevo HTML
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectPais = document.getElementById("pais");
    const selectEstado = document.getElementById("estado");
    const inputTema = document.getElementById("tema"); // El campo oculto 'arrendamiento'

    // Verificación de seguridad
    if (!btnEnviar || !inputPregunta) {
        console.error("Error: No se encontraron los elementos en el HTML. Revisa los IDs.");
        return;
    }

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        if (!pregunta) return;

        // Agregar mensaje del usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // Placeholder de carga (Efecto APOLO procesando)
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO está analizando la base de datos legal...", "asistente", idCarga);

        try {
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais: selectPais.value,
                    estado: selectEstado.value,
                    tema: inputTema.value, // Siempre enviará "arrendamiento"
                    pregunta: pregunta
                })
            });

            const data = await res.json();
            
            // Quitar mensaje de carga
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            if (data.error) {
                agregarMensaje("ERROR DE SISTEMA: " + data.error, "asistente");
            } else {
                agregarMensaje(data.respuesta, "asistente");
            }
        } catch (err) {
            console.error(err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.innerText = "Error crítico de conexión con la unidad central.";
        }
    }

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerText = texto;
        contenedorMensajes.appendChild(div);
        
        // Scroll automático al final
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // Eventos de escucha
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // Evita saltos de línea innecesarios
            enviarConsulta();
        }
    });
});