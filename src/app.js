import { ejecutarMotorEstructurado } from './motor.js';

document.addEventListener('DOMContentLoaded', () => {
    const btnEnviar = document.getElementById("enviar");
    const inputPregunta = document.getElementById("pregunta");
    const contenedorMensajes = document.getElementById("mensajes");
    const selectEstado = document.getElementById("estado");
    const selectTema = document.getElementById("tema");
    const selectPais = document.getElementById("pais");
    const displayFuente = document.getElementById("fuente-oficial-display");

    // NUEVO: Selector de modo incrustado
    let modoActual = "consulta";
    const modoBtns = document.querySelectorAll(".modo-btn");

    modoBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            modoBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            modoActual = btn.dataset.modo; // "consulta" o "redactar"
        });
    });

    // NUEVO: Detector oculto de conflicto → activa Articulador
    function detectarConflicto(p) {
        const claves = [
            "qué hago si", "que hago si",
            "me demandaron",
            "me quieren desalojar",
            "me quieren correr",
            "tengo un problema",
            "cómo procedo", "como procedo",
            "qué pasa si", "que pasa si",
            "mi arrendador",
            "mi empleador",
            "me están cobrando", "me estan cobrando",
            "quiero reclamar",
            "incumplió", "incumplio"
        ];
        const texto = p.toLowerCase();
        return claves.some(c => texto.includes(c));
    }

async function enviarConsulta() {
    const pregunta = inputPregunta.value.trim();
    if (!pregunta) return;

    const pais = selectPais.value;
    const estado = selectEstado.value;
    const tema = selectTema.value;

    const config = { pais, estado, tema };

    // 1. Interfaz: Agregar mensaje de usuario y limpiar input
    agregarMensaje(pregunta, "usuario");
    inputPregunta.value = "";

    // 2. Mostrar burbuja de carga
    const idCarga = "loading-" + Date.now();
    agregarMensaje('<i class="fas fa-spinner fa-spin"></i> Consultando jurisprudencia...', "asistente", idCarga);

    try {
        // 3. LLAMADA CORRECTA AL MOTOR (Usando tu función existente)
        // Nota: cambiamos ejecutarMotorEstructurado por ejecutarConsultaMotor
        const resultado = await ejecutarConsultaMotor(pregunta, config);
        
        // Quitar burbuja de carga
        const loadingElement = document.getElementById(idCarga);
        if (loadingElement) loadingElement.remove();

        // 4. Procesar la respuesta
        let respuestaLimpia = "";
        let leyCitada = "Legislación aplicable";

        try {
            // Intentamos ver si el resultado ya es un objeto o un JSON
            const datos = (typeof resultado.respuesta === 'string') ? JSON.parse(resultado.respuesta) : resultado.respuesta;
            respuestaLimpia = datos.explicacion || datos.respuesta || resultado.respuesta;
            leyCitada = datos.ley || "Legislación Mexicana";
        } catch (e) {
            // Si falla el parseo, el resultado es puro texto
            respuestaLimpia = resultado.respuesta || resultado;
        }

        // 5. Construcción del HTML
        let html = `
            <div class="fuente-oficial" style="color: #b8973d; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">
                <i class="fas fa-gavel"></i> ${leyCitada}
            </div>
            <div class="explicacion-legal" style="line-height: 1.6;">
                ${respuestaLimpia}
            </div>
        `;

        // 6. Lógica de TRIAGE
        if (detectarConflicto(pregunta) || respuestaLimpia.toLowerCase().includes("abogado")) {
            html += `
                <div class="apolo-triage" style="margin-top: 20px; border-top: 1px solid #e5e5e0; padding-top: 15px;">
                    <p style="font-size: 10px; color: #b8973d; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                        <i class="fas fa-exclamation-triangle"></i> Triage Legal Atlas
                    </p>
                    <p style="font-size: 13px; margin-bottom: 15px; color: #666;">He determinado que su situación requiere intervención profesional inmediata.</p>
                    <a href="directorio.html" class="directory-btn" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 25px; border-radius: 12px; text-decoration: none; font-size: 11px; font-weight: bold;">
                        CONECTAR CON ABOGADO EN ${estado.toUpperCase()}
                    </a>
                </div>
            `;
        }

        agregarMensaje(html, "asistente");

    } catch (err) {
        console.error("ERROR CRÍTICO:", err);
        const loadingElement = document.getElementById(idCarga);
        if (loadingElement) {
            loadingElement.innerHTML = "<strong>Error:</strong> No se pudo conectar con el motor legal.";
        }
    }
}