import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. REFERENCIAS AL DOM
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    // 2. LÓGICA DE MODOS (Consulta / Redactar)
    let modoActual = "consulta";
    const modoBtns = document.querySelectorAll(".modo-btn");

    modoBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modoBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo;
            console.log("Modo activo:", modoActual);
        });
    });

    // 3. FUNCIÓN DE ENVÍO
    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        // --- EL GUARDIÁN ---
        if (!pais || !estado || !tema) {
            alert("⚠️ Por favor, selecciona Jurisdicción, Estado y Tema antes de iniciar el Motor APOLO.");
            return;
        }

        if (!pregunta) return;

        // Interfaz: Limpiar y agregar mensaje de usuario
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje('<i class="fas fa-spinner fa-spin"></i> Procesando matriz normativa...', "asistente", idCarga);

        try {
            // 4. LLAMADA AL MOTOR (Búsqueda local de leyes)
            console.log("Iniciando Motor para:", { pais, estado, tema, pregunta });
            const datosLegales = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            // 5. LLAMADA A LA IA (Aquí conectamos con asesoria.js)
            // Cambia esta URL si tu servidor usa una distinta
            const respuestaIA = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta,
                    modo: modoActual,
                    contexto: datosLegales.reglas_relevantes || [],
                    estado,
                    tema
                })
            });

            const data = await respuestaIA.json();
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // 6. RENDERIZADO FINAL
            let htmlFinal = "";
            if (modoActual === "redactar") {
                htmlFinal = `
                    <div style="border-left: 3px solid #b8973d; padding-left: 15px;">
                        <span style="font-size: 10px; font-weight: bold; color: #b8973d;">PROYECTO DE REDACCIÓN</span>
                        <div style="background: white; padding: 20px; border: 1px solid #ddd; font-family: serif; margin-top: 10px; white-space: pre-wrap;">
                            ${data.respuesta || "Error al redactar."}
                        </div>
                    </div>
                `;
            } else {
                htmlFinal = `
                    <div style="color: #b8973d; font-size: 10px; font-weight: bold; margin-bottom: 8px;">ANÁLISIS APOLO // ${datosLegales.fuente || 'Ley Local'}</div>
                    <div style="font-size: 14px; line-height: 1.6;">${data.respuesta || "Error en consulta."}</div>
                `;

                // Triage automático hacia el directorio
                if (pregunta.toLowerCase().includes("pago") || pregunta.toLowerCase().includes("no paga")) {
                    htmlFinal += `
                        <div style="margin-top: 20px; background: #1a1a1a; color: white; padding: 15px; border-radius: 12px;">
                            <p style="font-size: 12px; margin-bottom: 10px;">He detectado un conflicto de arrendamiento en ${estado.toUpperCase()}.</p>
                            <a href="directorio.html" style="color: #b8973d; font-weight: bold; text-decoration: none; font-size: 11px;">CONECTAR CON ABOGADO →</a>
                        </div>
                    `;
                }
            }

            agregarMensaje(htmlFinal, "asistente");

        } catch (err) {
            console.error("ERROR EN APP:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.innerHTML = "<strong>Error:</strong> No se pudo conectar con la IA.";
        }
    }

    // 7. LISTENERS
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => {
        if (e.key === "Enter") enviarConsulta();
    });
});

function agregarMensaje(texto, remitente, id = null) {
    const div = document.createElement("div");
    div.classList.add("mensaje", remitente);
    if (id) div.id = id;
    div.innerHTML = texto;
    document.getElementById("mensajes").appendChild(div);
    document.getElementById("mensajes").scrollTop = document.getElementById("mensajes").scrollHeight;
}