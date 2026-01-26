import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");

    // 1. Lógica de Modos (Captura el click en los botones del Index)
    let modoActual = "consulta"; 
    const modoBtns = document.querySelectorAll(".modo-btn");

    modoBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modoBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo; // Aquí guardamos si es 'consulta' o 'redactar'
            console.log("Modo activo:", modoActual);
        });
    });

    async function enviarConsulta() {
        const pregunta = inputPregunta.value.trim();
        if (!pregunta) return;

        // 2. Preparar la configuración incluyendo el MODO
        const pais = selectPais.value;
        const estado = selectEstado.value;
        const tema = selectTema.value;

        agregarMensaje(pregunta, "usuario");
        inputPregunta.value = "";

        const idCarga = "loading-" + Date.now();
        agregarMensaje('<i class="fas fa-spinner fa-spin"></i> APOLO procesando en modo ' + modoActual.toUpperCase() + '...', "asistente", idCarga);

        try {
            // 3. LLAMADA AL MOTOR 
            // Pasamos el modoActual para que la lógica sepa qué tipo de prompt generar
            const resultado = await ejecutarMotorEstructurado(pais, estado, tema, pregunta);
            
            const loadingElement = document.getElementById(idCarga);
            if (loadingElement) loadingElement.remove();

            // 4. Lógica de Respuesta según el Modo
            let htmlFinal = "";
            
            if (modoActual === "redactar") {
                // Prompt de Redacción: Enfocado en el borrador del documento
                htmlFinal = `
                    <div style="border-left: 3px solid #b8973d; padding-left: 15px;">
                        <span style="font-size: 10px; font-weight: bold; color: #b8973d;">MODO REDACCIÓN ACTIVO</span>
                        <p style="margin-top: 10px;">He generado un borrador basado en el tema <strong>${tema}</strong>:</p>
                        <div style="background: #f9f9f9; padding: 15px; font-family: monospace; font-size: 12px; margin-top: 10px; border: 1px solid #ddd;">
                            [Aquí el LLM generará el texto del documento legal basado en las reglas encontradas]
                        </div>
                    </div>
                `;
            } else {
                // Prompt de Consulta: Enfocado en explicar y hacer Triage
                let reglas = resultado.reglas_relevantes.map(r => `<li><strong>Art. ${r.articulo}:</strong> ${r.regla}</li>`).join("");
                
                htmlFinal = `
                    <div style="color: #b8973d; font-size: 10px; font-weight: bold; margin-bottom: 5px;">ANÁLISIS DE CONSULTA</div>
                    <p>De acuerdo a la legislación de ${estado}, esto es lo que dice la norma:</p>
                    <ul style="font-size: 13px; margin: 15px 0;">${reglas}</ul>
                `;

                // Trigger automático de Triage (solo en modo consulta)
                if (pregunta.toLowerCase().includes("no paga") || pregunta.toLowerCase().includes("arrendatario")) {
                    htmlFinal += `
                        <div style="background: #1a1a1a; color: white; padding: 15px; border-radius: 10px; margin-top: 15px;">
                            <p style="font-size: 11px;">⚠️ Se detecta un conflicto que requiere un especialista.</p>
                            <a href="directorio.html" style="color: #b8973d; font-weight: bold; font-size: 12px; text-decoration: none;">CONTACTAR ABOGADO AHORA →</a>
                        </div>
                    `;
                }
            }

            agregarMensaje(htmlFinal, "asistente");

        } catch (err) {
            console.error(err);
            if (document.getElementById(idCarga)) document.getElementById(idCarga).innerHTML = "Error de conexión.";
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