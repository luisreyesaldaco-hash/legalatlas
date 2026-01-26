import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Referencias al DOM (Asegúrate que estos IDs existan en tu index)
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    // 2. Lógica de Modos (Consulta vs Redacción)
    let modoActual = "consulta"; 
    const modoBtns = document.querySelectorAll(".modo-btn");

    modoBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modoBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo; 
            console.log("Modo activo en APOLO:", modoActual);
        });
    });

    // 3. Detector de Conflicto (Triage Jurídico)
    function detectarConflicto(p) {
        const claves = ["no paga", "renta", "arrendatario", "demanda", "despido", "embargo", "correr", "problema"];
        return claves.some(clave => p.toLowerCase().includes(clave));
    }

    // 4. Función de Envío Principal
    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        if (!pregunta) return;

        // Capturamos valores actuales de los selectores
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje('<i class="fas fa-spinner fa-spin"></i> APOLO procesando en modo ' + modoActual.toUpperCase() + '...', "asistente", idCarga);

        try {
            // LLAMADA CORREGIDA AL MOTOR: Pasamos los 4 argumentos que espera motor.js
            const resultado = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // Procesamos la respuesta según el modo elegido
            let htmlFinal = "";
            
            if (modoActual === "redactar") {
                // Lógica de Redacción: Enfocada en estructura de documento
                htmlFinal = `
                    <div style="border-left: 3px solid #b8973d; padding-left: 15px;">
                        <span style="font-size: 10px; font-weight: bold; color: #b8973d; letter-spacing: 1px;">MODO REDACCIÓN ACTIVO</span>
                        <p style="margin-top: 10px; font-size: 14px;">Preparando borrador técnico para <strong>${tema.toUpperCase()}</strong> en ${estado}:</p>
                        <div style="background: #fdfdfd; padding: 20px; font-family: 'Courier New', monospace; font-size: 12px; margin-top: 15px; border: 1px solid #e5e5e0; line-height: 1.5; color: #333;">
                            [Simulación de Borrador: Basado en Art. ${resultado.reglas_relevantes[0]?.articulo || 'N/A'}]<br><br>
                            ${pregunta.toUpperCase()}<br>---<br>
                            Próximo paso: Conectar con IA para completar el clausulado.
                        </div>
                    </div>
                `;
            } else {
                // Lógica de Consulta: Análisis y Triage
                let reglasHtml = resultado.reglas_relevantes.map(r => 
                    `<li style="margin-bottom: 10px;"><strong>Art. ${r.articulo}:</strong> ${r.regla}</li>`
                ).join("");

                htmlFinal = `
                    <div style="color: #b8973d; font-size: 10px; font-weight: bold; margin-bottom: 8px; letter-spacing: 1px;">ANÁLISIS DE CONSULTA // ${resultado.fuente}</div>
                    <p style="font-size: 14px; margin-bottom: 15px;">De acuerdo a la normativa vigente, he localizado los siguientes fundamentos:</p>
                    <ul style="font-size: 13px; list-style: none; padding: 0;">${reglasHtml}</ul>
                `;

                // Botón de Triage dinámico (Solo en modo consulta si hay conflicto)
                if (detectarConflicto(pregunta)) {
                    htmlFinal += `
                        <div style="background: #1a1a1a; color: white; padding: 20px; border-radius: 12px; margin-top: 20px;">
                            <p style="font-size: 11px; font-weight: bold; color: #b8973d; margin-bottom: 5px;">TRIAGE LEGAL ATLAS</p>
                            <p style="font-size: 13px; margin-bottom: 15px; opacity: 0.9;">Su caso sugiere un conflicto de intereses. Se recomienda intervención de un experto.</p>
                            <a href="directorio.html" style="background: #b8973d; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase;">Consultar Especialista</a>
                        </div>
                    `;
                }
            }

            agregarMensaje(htmlFinal, "asistente");

        } catch (err) {
            console.error("Error crítico en la comunicación:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.innerHTML = "<strong>Error:</strong> No se pudo conectar con el motor legal.";
        }
    }

    // 5. Event Listeners
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });
});

// Función auxiliar para renderizar burbujas
function agregarMensaje(texto, remitente, id = null) {
    const contenedor = document.getElementById("mensajes");
    const div = document.createElement("div");
    div.classList.add("mensaje", remitente);
    if (id) div.id = id;
    div.innerHTML = texto;
    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;
}