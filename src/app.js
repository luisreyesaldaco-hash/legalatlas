import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    
    // Selectores del Index
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
        const pregunta = inputPregunta.value.trim();
        if (!pregunta) return;

        // CAPTURA CRÍTICA: Aseguramos que los valores no sean nulos
        const estadoNombre = selectEstado.options[selectEstado.selectedIndex]?.text || "Estado no seleccionado";
        const temaNombre = selectTema.value || "General";

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje('APOLO está procesando...', "asistente", idCarga);

        try {
            // Llamamos al motor con los valores actuales
            const resultado = await ejecutarMotorEstructurado(
                selectPais.value, 
                selectEstado.value, 
                selectTema.value, 
                pregunta
            );
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            let htmlFinal = "";

            if (modoActual === "redactar") {
                // MODO REDACCIÓN
                const borradorSimulado = redactarDocumento(temaNombre, resultado.reglas_relevantes, pregunta);
                htmlFinal = `
                    <div style="border-left: 3px solid #b8973d; padding-left: 15px;">
                        <span style="font-size: 10px; font-weight: bold; color: #b8973d;">PROYECTO DE REDACCIÓN</span>
                        <p style="margin: 10px 0; font-size: 13px;">Borrador técnico para <strong>${temaNombre}</strong>:</p>
                        <div style="background: #fff; padding: 20px; border: 1px solid #ddd; font-family: serif; white-space: pre-line; font-size: 13px;">
                            ${borradorSimulado}
                        </div>
                    </div>
                `;
            } else {
                // MODO CONSULTA
                let reglasHtml = resultado.reglas_relevantes.length > 0 
                    ? resultado.reglas_relevantes.map(r => `<li><strong>Art. ${r.articulo}:</strong> ${r.regla}</li>`).join("")
                    : "<li>No se encontraron artículos específicos para esta consulta.</li>";

                htmlFinal = `
                    <div style="color: #b8973d; font-size: 10px; font-weight: bold; margin-bottom: 5px;">ANÁLISIS LEGAL EN ${estadoNombre.toUpperCase()}</div>
                    <p style="font-size: 14px;">Basado en la normativa de ${temaNombre}:</p>
                    <ul style="font-size: 13px; margin: 15px 0; list-style-type: square; padding-left: 20px;">${reglasHtml}</ul>
                `;

                if (pregunta.toLowerCase().includes("pago") || pregunta.toLowerCase().includes("renta")) {
                    htmlFinal += `
                        <div style="background: #1a1a1a; color: white; padding: 15px; border-radius: 10px; margin-top: 15px;">
                            <p style="font-size: 11px; margin-bottom: 10px;">⚠️ Se detecta un posible incumplimiento de contrato.</p>
                            <a href="directorio.html" style="color: #b8973d; font-weight: bold; font-size: 12px; text-decoration: none;">VER ABOGADOS DISPONIBLES EN ${estadoNombre.toUpperCase()} →</a>
                        </div>
                    `;
                }
            }

            agregarMensaje(htmlFinal, "asistente");

        } catch (err) {
            console.error(err);
            if (document.getElementById(idCarga)) document.getElementById(idCarga).innerHTML = "Error al conectar con el motor.";
        }
    }

    // SIMULADOR DE IA (Esto luego será reemplazado por la API de Gemini/GPT)
    function redactarDocumento(tema, reglas, duda) {
        const art = reglas[0]?.articulo || "---";
        return `CONTRATO DE ${tema.toUpperCase()}
        
        En la ciudad de León, Guanajuato...
        CONSIDERANDO QUE: El solicitante manifiesta lo siguiente: "${duda}".
        FUNDAMENTO LEGAL: De acuerdo al Artículo ${art} de la legislación vigente...
        
        [EL CLAUSULADO COMPLETO SE GENERARÁ AL CONECTAR LA API]`;
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