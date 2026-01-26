import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    let modoActual = "consulta";
    document.querySelectorAll(".modo-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".modo-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo;
        });
    });

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        if (!pais || !estado || !tema) {
            alert("⚠️ Selecciona Jurisdicción, Estado y Tema.");
            return;
        }
        if (!pregunta) return;

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";
        const idCarga = "loading-" + Date.now();
        agregarMensaje("APOLO procesando...", "asistente", idCarga);

        try {
            // 1. MOTOR LOCAL (Construye la ruta y busca leyes)
            const datosLegales = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            // Verificamos si el motor trajo algo para evitar el 'undefined'
            const leyesEncontradas = datosLegales && datosLegales.reglas_relevantes ? datosLegales.reglas_relevantes : [];

            // 2. IA (Aquí es donde estaba el error de cierre)
            const resIA = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta: pregunta,
                    modo: modoActual,
                    contexto: leyesEncontradas, // Enviamos array vacío si no hay leyes
                    tema: tema,
                    estado: estado
                })
            });

            if (!resIA.ok) throw new Error("Error en servidor de IA");
            
            const data = await resIA.json();
            
            // IMPORTANTE: Asegúrate que asesoria.js devuelva un campo llamado 'respuesta'
            const textoIA = data.respuesta || data.resultado || "Sin respuesta de la IA.";

            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // 3. RENDERIZADO
            let html = "";
            if (modoActual === "redactar") {
                html = `
                    <div style="border-left: 3px solid #b8973d; padding: 15px; background: white; border-radius: 8px;">
                        <span style="font-size: 10px; font-weight: bold; color: #b8973d;">PROYECTO DE REDACCIÓN</span>
                        <p style="font-family: serif; white-space: pre-wrap; margin-top: 10px;">${textoIA}</p>
                    </div>`;
            } else {
                html = `
                    <div style="color: #b8973d; font-size: 10px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">
                        Análisis Legal APOLO
                    </div>
                    <div>${textoIA}</div>`;
                
                // Triage hacia el directorio
                if (pregunta.toLowerCase().includes("pago") || pregunta.toLowerCase().includes("renta")) {
                    html += `
                        <div style="margin-top:15px; background:#1a1a1a; color:white; padding:15px; border-radius:12px;">
                            <p style="font-size:11px; color:#b8973d; font-weight:bold; margin-bottom:10px;">CONFLICTO DETECTADO</p>
                            <p style="font-size:12px; margin-bottom:12px; opacity: 0.9;">Esta situación requiere intervención profesional inmediata.</p>
                            <a href="directorio.html?materia=${tema}" style="background:#b8973d; color:white; padding:8px 15px; border-radius:6px; text-decoration:none; font-size:11px; font-weight:bold;">CONSULTAR ABOGADOS →</a>
                        </div>`;
                }
            }
            agregarMensaje(html, "asistente");

        } catch (err) {
            console.error("Error en App:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.innerText = "Error: No se pudo conectar con el cerebro de la IA.";
        }
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if(e.key === 'Enter') enviarConsulta(); });
});

function agregarMensaje(texto, remitente, id = null) {
    const div = document.createElement("div");
    div.classList.add("mensaje", remitente);
    if (id) div.id = id;
    div.innerHTML = texto;
    document.getElementById("mensajes").appendChild(div);
    document.getElementById("mensajes").scrollTop = document.getElementById("mensajes").scrollHeight;
}