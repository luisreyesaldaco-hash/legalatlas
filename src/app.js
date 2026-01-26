import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    let modoActual = "consulta"; 
    const modoBtns = document.querySelectorAll(".modo-btn");

    modoBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modoBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo;
        });
    });

     async function enviarConsulta() {
    // 1. CAPTURA DE VALORES
      const pregunta = inputPregunta.value.trim();
      const pais = selectPais.value;
      const estado = selectEstado.value;
      const tema = selectTema.value;

    // 2. EL GUARDIÁN: Validar que todo esté lleno
    if (!pais || !estado || !tema) {
        // Crear un pequeño popup o alerta visual
        alert("⚠️ Por favor, selecciona País, Estado y Tema antes de consultar al Motor APOLO.");
        
        // Efecto visual: Resaltar los campos vacíos en rojo temporalmente
        [selectPais, selectEstado, selectTema].forEach(el => {
            if (!el.value) {
                el.style.border = "1px solid #b8973d";
                setTimeout(() => el.style.border = "1px solid transparent", 2000);
            }
        });
        return; // Detiene la ejecución
    }

    if (!pregunta) return;

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje('<i class="fas fa-spinner fa-spin"></i> APOLO consultando leyes y procesando...', "asistente", idCarga);

        try {
            // 1. OBTENEMOS LAS LEYES LOCALES (MOTOR)
            const datosLegales = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            // 2. LLAMADA A TU ASESORIA.JS (Donde está tu IA y tu LLAVE)
            // IMPORTANTE: Asegúrate de que esta ruta sea la que usa tu servidor
            const respuestaServidor = await fetch("/api/asesoria", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pregunta: pregunta,
                    modo: modoActual, // "consulta" o "redactar"
                    contextoLegal: datosLegales.reglas_relevantes || [], // Las leyes que encontró el motor
                    estado: estado,
                    tema: tema,
                    fuente: datosLegales.fuente || "Legislación Local"
                })
            });

            if (!respuestaServidor.ok) throw new Error("Error en el servidor de IA");

            const dataIA = await respuestaServidor.json();
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // 3. RENDERIZADO FINAL
            let htmlFinal = "";

            if (modoActual === "redactar") {
                // Estilo para Modo Redacción (Escribano)
                htmlFinal = `
                    <div style="border-left: 3px solid #b8973d; padding-left: 15px;">
                        <span style="font-size: 10px; font-weight: bold; color: #b8973d; text-transform: uppercase;">Proyecto de Redacción Legal</span>
                        <div style="background: white; padding: 20px; border: 1px solid #e5e5e0; font-family: serif; margin-top: 10px; white-space: pre-wrap; color: #1a1a1a; line-height: 1.5;">
                            ${dataIA.respuesta || dataIA.resultado}
                        </div>
                    </div>
                `;
            } else {
                // Estilo para Modo Consulta (Intelectual + Triage)
                htmlFinal = `
                    <div style="color: #b8973d; font-size: 10px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">
                        <i class="fas fa-gavel"></i> Análisis de Situación Jurídica
                    </div>
                    <div style="font-size: 14px; line-height: 1.6; color: #1a1a1a;">
                        ${dataIA.respuesta || dataIA.resultado}
                    </div>
                `;

                // Triage: Si la IA dice que se necesita abogado o es un conflicto conocido
                if (pregunta.toLowerCase().includes("pago") || pregunta.toLowerCase().includes("renta") || dataIA.triage) {
                    htmlFinal += `
                        <div style="margin-top: 20px; background: #1a1a1a; color: white; padding: 18px; border-radius: 10px;">
                            <p style="font-size: 11px; color: #b8973d; font-weight: bold; margin-bottom: 5px;">TRIAGE LEGAL ATLAS</p>
                            <p style="font-size: 13px; margin-bottom: 15px; opacity: 0.9;">Esta situación requiere formalidad legal inmediata. Consulte a un especialista verificado en ${estado.toUpperCase()}.</p>
                            <a href="directorio.html" style="background: #b8973d; color: white; padding: 8px 15px; border-radius: 5px; text-decoration: none; font-size: 11px; font-weight: bold;">CONECTAR CON ABOGADO →</a>
                        </div>
                    `;
                }
            }

            agregarMensaje(htmlFinal, "asistente");

        } catch (err) {
            console.error("ERROR AL CONECTAR CON ASESORIA.JS:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) {
                loadingElement.innerHTML = "<strong>Error:</strong> No se pudo obtener respuesta de la IA. Revisa que tu servidor esté encendido.";
            }
        }
    }

    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });
});

function agregarMensaje(texto, remitente, id = null) {
    const contenedor = document.getElementById("mensajes");
    const div = document.createElement("div");
    div.classList.add("mensaje", remitente);
    if (id) div.id = id;
    div.innerHTML = texto;
    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;
}