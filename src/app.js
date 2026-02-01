import { ejecutarMotorEstructurado } from './motor.js';

let DATA_JURISDICCIONES = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. SELECTORES (Verifica que estos IDs existan en tu HTML)
  const btnEnviar = document.getElementById("enviar");
  const inputPregunta = document.getElementById("pregunta");
  const contenedorMensajes = document.getElementById("mensajes");
  const selectEstado = document.getElementById("estado");
  const selectTema = document.getElementById("tema");
  const selectPais = document.getElementById("pais");
  const groupEstado = document.getElementById("group-estado");
  const displayFuente = document.getElementById("fuente-oficial-display");

  // 2. MEMORIA Y PERSISTENCIA
  function guardarFiltrosEnMemoria() {
    const filtros = {
      pais: selectPais ? selectPais.value : '',
      estado: selectEstado ? selectEstado.value || '' : '',
      tema: selectTema ? selectTema.value : ''
    };
    localStorage.setItem('filtroUsuario', JSON.stringify(filtros));
  }

  // 3. CARGA DE CONFIGURACIÓN
  async function cargarConfiguracion() {
    try {
      const res = await fetch('./jurisdicciones.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA_JURISDICCIONES = await res.json();
      console.log("✅ Jurisdicciones cargadas:", DATA_JURISDICCIONES);
    } catch (e) {
      console.error("❌ Error cargando JSON:", e);
      DATA_JURISDICCIONES = {};
    }
  }

  // 4. INTERFAZ DINÁMICA
  function actualizarInterfazPorPais() {
    const pais = selectPais ? selectPais.value : '';
    const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;

    if (config && config.esFederal && selectEstado && groupEstado) {
      groupEstado.style.display = "block";
      selectEstado.innerHTML = '<option value="">SELECCIONE...</option>';
      (config.estados || []).forEach(est => {
        const opt = document.createElement('option');
        opt.value = est.val;
        opt.innerText = est.nom;
        selectEstado.appendChild(opt);
      });
    } else if (groupEstado && selectEstado) {
      groupEstado.style.display = "none";
      selectEstado.innerHTML = '';
    }
    guardarFiltrosEnMemoria();
  }

  // 5. FUNCIÓN DE ENVÍO
  async function enviarConsulta() {
    try {
      console.log("🚀 Intento de envío detectado...");
      if (!inputPregunta || !selectPais || !selectTema) {
        console.error('Elementos críticos faltantes');
        return;
      }

      const pregunta = inputPregunta.value.trim();
      const pais = selectPais.value;
      const estado = selectEstado ? selectEstado.value : '';
      const tema = selectTema.value;

      const config = DATA_JURISDICCIONES ? DATA_JURISDICCIONES[pais] : null;
      const necesitaEstado = config && config.esFederal;

      if (!pregunta || !pais || !tema || (necesitaEstado && !estado)) {
        alert("⚠️ Por favor, completa todos los campos.");
        return;
      }

      agregarMensaje(escapeHtml(pregunta), "usuario");
      inputPregunta.value = "";

      const idCarga = "loading-" + Date.now();
      agregarMensaje("APOLO analizando...", "asistente", idCarga);

      const estadoBusqueda = necesitaEstado ? estado : "nacional";
      let rutaFinalEstado = estadoBusqueda;
      if (pais === "mexico" && tema === "despido") {
        rutaFinalEstado = "federal";
      }

      console.log(`Buscando en: ${pais}/${rutaFinalEstado}/${tema}`);

      // 1. Motor Local
      let dataLocal = {};
      try {
        dataLocal = await ejecutarMotorEstructurado(pais, rutaFinalEstado, tema, pregunta);
        console.log('dataLocal:', dataLocal);
      } catch (errMotor) {
        console.error('Error en ejecutarMotorEstructurado:', errMotor);
        dataLocal = {};
      }

      // 2. Llamada a API
      const res = await fetch("/api/asesoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pais,
          estado: rutaFinalEstado,
          tema,
          pregunta,
          contextoLegal: dataLocal.reglas_relevantes || [],
          fuente: dataLocal.fuente || "Legislación Local"
        })
      });

      if (!res.ok) {
        const body = await res.text().catch(()=>'<no body>');
        throw new Error(`Error en servidor API ${res.status}: ${body}`);
      }
      const dataIA = await res.json();

      // Limpiar cargador
      document.getElementById(idCarga)?.remove();

      const r = dataIA.respuesta || {};
      const idBtn = "btn-" + Date.now();
      const necesitaTriage = (tema === "despido") || r.confianza === "Baja";

      let html = `
        <div class="apolo-resumen"><strong>Análisis:</strong> ${escapeHtml(r.resumen || '')}</div>
        <div class="apolo-draft" style="margin-top:10px; border-left:4px solid #b8973d; padding-left:10px;">
          ${r.draftHtml || ''}
        </div>
      `;

      if (necesitaTriage) {
        const txtUbicacion = (rutaFinalEstado === "federal") ? pais.toUpperCase() : (estado || pais).toUpperCase();
        html += `
          <button id="${idBtn}" style="margin-top:15px; width:100%; background:#2d2d2d; color:white; padding:10px; border-radius:5px; cursor:pointer;">
            VER ESPECIALISTAS EN ${escapeHtml(txtUbicacion)}
          </button>
        `;
      }

      agregarMensaje(html, "asistente");

      if (necesitaTriage) {
        const boton = document.getElementById(idBtn);
        if (boton) {
          boton.onclick = () => {
            window.location.href = `directorio.html?materia=${encodeURIComponent(tema)}&estado=${encodeURIComponent(rutaFinalEstado)}&pais=${encodeURIComponent(pais)}`;
          };
        } else {
          console.warn('Botón triage no encontrado en DOM');
        }
      }

    } catch (err) {
      console.error("❌ ERROR EN CONSULTA:", err);
      const loader = document.getElementById('loading-' + Date.now());
      if (loader) loader.innerHTML = "Error al conectar con el motor legal.";
      else agregarMensaje("Error al conectar con el motor legal.", "asistente");
    }
  }

  // Utilidades
  function agregarMensaje(texto, remitente, id = null) {
    if (!contenedorMensajes) {
      console.error('contenedorMensajes no inicializado');
      return;
    }
    const div = document.createElement("div");
    div.className = `mensaje ${remitente}`;
    if (id) div.id = id;
    div.innerHTML = texto;
    contenedorMensajes.appendChild(div);
    contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- INICIALIZACIÓN ---
  await cargarConfiguracion();

  // Asignar listeners de UI (una sola vez)
  if (selectPais) selectPais.addEventListener('change', actualizarInterfazPorPais);
  if (selectEstado) selectEstado.addEventListener('change', guardarFiltrosEnMemoria);
  if (selectTema) selectTema.addEventListener('change', guardarFiltrosEnMemoria);

  if (btnEnviar) {
    // eliminar listeners previos si sospechas duplicados (opcional)
    // const nuevoBtn = btnEnviar.cloneNode(true);
    // btnEnviar.parentNode.replaceChild(nuevoBtn, btnEnviar);
    // nuevoBtn.addEventListener('click', enviarConsulta);
    btnEnviar.addEventListener("click", enviarConsulta);
  }
  if (inputPregunta) inputPregunta.addEventListener("keypress", (e) => { if (e.key === "Enter") enviarConsulta(); });

  // Exponer para debugging (ahora que todo está definido)
  window._APOLO = window._APOLO || {};
  window._APOLO.enviarConsulta = enviarConsulta;
  window._APOLO.cargarConfiguracion = cargarConfiguracion;
  window._APOLO.getJurisdicciones = () => DATA_JURISDICCIONES;

}); // Cierre DOMContentLoaded