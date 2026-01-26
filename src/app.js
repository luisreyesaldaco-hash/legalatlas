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
        // 3. Ejecución del Motor (Intelectual y Triage)
        const resultado = await ejecutarMotorEstructurado(pregunta, config);
        
        // Quitar burbuja de carga
        const loadingElement = document.getElementById(idCarga);
        if (loadingElement) loadingElement.remove();

        let respuestaLimpia = "";
        let leyCitada = "Legislación aplicable";

        try {
            // Intentamos parsear por si el LLM devolvió el JSON que pedimos en el prompt
            const datos = JSON.parse(resultado.respuesta);
            respuestaLimpia = datos.explicacion || datos.respuesta;
            leyCitada = datos.ley || "Legislación Mexicana";
        } catch (e) {
            // Si el LLM devolvió texto plano, lo usamos directamente
            respuestaLimpia = resultado.respuesta;
        }

        // 4. Construcción del HTML con estilo intelectual
        let html = `
            <div class="fuente-oficial" style="color: #b8973d; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px;">
                <i class="fas fa-gavel"></i> ${leyCitada}
            </div>
            <div class="explicacion-legal" style="line-height: 1.6;">
                ${respuestaLimpia}
            </div>
        `;

        // 5. Lógica de TRIAGE: Si detecta conflicto, inyectamos el botón al DIRECTORIO
        // Usamos la función detectarConflicto que ya tienes en tu app.js
        if (detectarConflicto(pregunta) || respuestaLimpia.toLowerCase().includes("abogado") || respuestaLimpia.toLowerCase().includes("especialista")) {
            html += `
                <div class="apolo-triage" style="margin-top: 20px; border-top: 1px solid #e5e5e0; padding-top: 15px;">
                    <p style="font-size: 10px; color: #b8973d; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                        <i class="fas fa-exclamation-triangle"></i> Triage Legal Atlas
                    </p>
                    <p style="font-size: 13px; margin-bottom: 15px; color: #666;">He determinado que su situación requiere intervención profesional inmediata para asegurar su defensa.</p>
                    <a href="directorio.html" class="directory-btn" style="display: inline-block; background: #1a1a1a; color: white; padding: 12px 20px; border-radius: 12px; text-decoration: none; font-size: 11px; font-weight: bold; transition: background 0.3s;">
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
            loadingElement.innerHTML = "<strong>Error:</strong> El Motor APOLO no pudo procesar la consulta legal. Intente de nuevo.";
        }
    }
}