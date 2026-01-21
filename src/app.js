// app.js - Versión compatible con APOLO
document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectPais = document.getElementById("pais");
    const selectEstado = document.getElementById("estado");
    const inputTema = document.getElementById("tema"); // El campo oculto que pusimos

    // Verificar que todos los elementos existen antes de seguir
    if (!btnEnviar || !inputPregunta) {
        console.error("No se encontraron los elementos del DOM. Revisa los IDs en index.html");
        return;
    }

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        if (!pregunta) return;

        // 1. Agregar mensaje del usuario a la interfaz
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // 2. Mostrar estado de "Procesando..."
        const placeholderId = "msg-" + Date.now();
        agregarMensaje("Consultando base de datos legal...", "asistente", placeholderId);

        try {
            const res = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pais: selectPais.value,
                    estado: selectEstado.value,
                    tema: inputTema.value, // Enviará "arrendamiento"
                    pregunta: pregunta
                })
            });

            const data = await res.json();
            
            // Eliminar el placeholder de carga
            document.getElementById(placeholderId).remove();

            if (data.error) {
                agregarMensaje("Error: " + data.error, "asistente");
            } else {
                agregarMensaje(data.respuesta, "asistente");
            }
        } catch (err) {
            console.error(err);
            document.getElementById(placeholderId).innerText = "Error de conexión con APOLO.";
        }
    }

    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        div.innerText = texto;
        contenedorMensajes.appendChild(div);
        
        // Auto-scroll al final
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // Eventos
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => {
        if (e.key === "Enter") enviarConsulta();
    });
});