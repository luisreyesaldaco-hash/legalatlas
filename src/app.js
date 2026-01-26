import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    let modoActual = "consulta";

    // Manejo de botones de modo
    document.querySelectorAll(".modo-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".modo-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo;
        });
    });

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const config = { pais: selectPais.value, estado: selectEstado.value, tema: selectTema.value };

        if (!config.pais || !config.estado || !config.tema || !pregunta) {
            alert("⚠️ Completa todos los campos.");
            return;
        }

        agregarMensaje(pregunta, "usuario");
        const idCarga = "loading-" + Date.now();
        agregarMensaje("Consultando base legal...", "asistente", idCarga);

        try {
            // 1. Motor Local
            const datosLegales = await ejecutarMotorEstructurado(config.pais, config.estado, config.tema, pregunta);
            const contextoIA = datosLegales.reglas_relevantes || [];

            // 2. IA - Fetch corregido
            const resIA = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta: pregunta,
                    modo: modoActual,
                    contexto: contextoIA,
                    tema: config.tema,
                    estado: config.estado
                })
            });

            if (!resIA.ok) throw new Error("La IA no responde");
            const dataIA = await resIA.json();
            
            document.getElementById(idCarga)?.remove();
            const respuestaTexto = dataIA.respuesta || dataIA.resultado || "Error al obtener respuesta.";

            // 3. Mostrar respuesta y Triage
            let html = `<div>${respuestaTexto}</div>`;
            if (pregunta.toLowerCase().includes("pago") || pregunta.toLowerCase().includes("renta")) {
                html += `<div style="margin-top:10px; padding:10px; background:#f0f0f0; border-radius:8px;">
                            <strong>Conflicto detectado:</strong> 
                            <a href="directorio.html?materia=${config.tema}">Ver abogados en ${config.estado}</a>
                         </div>`;
            }
            agregarMensaje(html, "asistente");

        } catch (err) {
            console.error(err);
            document.getElementById(idCarga).innerText = "Error de conexión.";
        }
    }

    btnEnviar.addEventListener("click", enviarConsulta);
});

function agregarMensaje(texto, remitente, id = null) {
    const div = document.createElement("div");
    div.classList.add("mensaje", remitente);
    if (id) div.id = id;
    div.innerHTML = texto;
    document.getElementById("mensajes").appendChild(div);
}