import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    // Lógica de Modos (Consulta / Redactar)
    let modoActual = "consulta";
    const modoBtns = document.querySelectorAll(".modo-btn");

    modoBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modoBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo;
            console.log("Modo cambiado a:", modoActual);
        });
    });

    // Detector de Conflicto para Triage
    function detectarConflicto(p) {
        const claves = [
            "qué hago si", "que hago si", "me demandaron", "desalojar", 
            "notificaron", "embargo", "correr", "despido", "problema", 
            "procedo", "arrendatario", "no paga", "renta", "contrato"
        ];
        return claves.some(clave => p.toLowerCase().includes(clave));
    }

    // Función para agregar mensajes al chat
    function agregarMensaje(texto, remitente, id = null) {
        const div = document.createElement("div");
        div.classList.add("mensaje", remitente);
        if (id) div.id = id;
        
        // Estilo básico para las burbujas si no las tienes en CSS
        div.style.marginBottom = "20px";
        div.style.padding = "15px";
        div.style.borderRadius = "12px";
        div.style.maxWidth = "85%";
        
        if (remitente === "usuario") {
            div.style.backgroundColor = "#e5e5e0";
            div.style.alignSelf = "flex-end";
            div.style.marginLeft = "auto";
        } else {
            div.style.backgroundColor = "white";
            div.style.border = "1px solid #e5e5e0";
            div.style.alignSelf = "flex-start";
        }

        div.innerHTML = texto;
        contenedorMensajes.appendChild(div);
        contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
    }

    // FUNCIÓN PRINCIPAL DE CONSULTA
    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        if (!pregunta) return;

        const config = {
            pais: selectPais.value,
            estado: selectEstado.value,
            tema: selectTema.value,
            modo: modoActual
        };

        // 1. Interfaz: Usuario pregunta
        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        // 2. Burbuja de carga
        const idCarga = "loading-" + Date.now();
        agregarMensaje('<i class="fas fa-spinner fa-spin"></i> APOLO analizando situación...', "asistente", idCarga);

        try {
            // 3. Llamada al motor legal
            const resultado = await ejecutarMotorEstructurado(pregunta, config);
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            let respuestaLimpia = "";
            let leyCitada = "Legislación Mexicana";

            // 4. Intento de procesar JSON o Texto Plano
            try {
                const datos = (typeof resultado.respuesta === 'string') 
                    ? JSON.parse(resultado.respuesta) 
                    : resultado.respuesta;
                
                respuestaLimpia = datos.explicacion || datos.respuesta || resultado.respuesta;
                leyCitada = datos.ley || "Legislación Aplicable";
            } catch (e) {
                respuestaLimpia = resultado.respuesta || resultado;
            }

            // 5. Construcción del HTML Final
            let html = `
                <div style="color: #b8973d; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;">
                    <i class="fas fa-gavel"></i> ${leyCitada}
                </div>
                <div style="font-size: 14px; line-height: 1.6; color: #1a1a1a;">
                    ${respuestaLimpia}
                </div>
            `;

            // 6. Lógica de TRIAGE (Botón al Directorio)
            if (detectarConflicto(pregunta) || respuestaLimpia.toLowerCase().includes("abogado")) {
                html += `
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
                        <p style="font-size: 10px; color: #b8973d; font-weight: 800; text-transform: uppercase; margin-bottom: 5px;">
                            <i class="fas fa-user-tie"></i> Acción Recomendada
                        </p>
                        <p style="font-size: 12px; color: #666; margin-bottom: 12px;">
                            Dada la naturaleza del conflicto, se sugiere asesoría con un especialista verificado.
                        </p>
                        <a href="directorio.html" style="display: inline-block; background: #1a1a1a; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                            Ver Abogados en ${config.estado.toUpperCase()}
                        </a>
                    </div>
                `;
            }

            agregarMensaje(html, "asistente");

        } catch (err) {
            console.error("Error en App:", err);
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) {
                loadingElement.innerHTML = "<strong>Error:</strong> El Motor APOLO no pudo procesar la consulta legal.";
            }
        }
    }

    // Listeners de eventos
    btnEnviar.addEventListener("click", enviarConsulta);
    inputPregunta.addEventListener("keypress", (e) => {
        if (e.key === "Enter") enviarConsulta();
    });
});