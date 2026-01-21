// app.js - Lógica del Frontend
const selectPais = document.getElementById("pais");
const selectEstado = document.getElementById("estado");
const selectTema = document.getElementById("tema");
const inputPregunta = document.getElementById("inputUsuario");
const btnEnviar = document.getElementById("enviar");
const divMensajes = document.getElementById("mensajes");

function agregarMensaje(texto, tipo) {
  const div = document.createElement("div");
  div.className = tipo === "usuario" ? "mensaje usuario" : "mensaje bot";
  div.textContent = texto;
  divMensajes.appendChild(div);
  divMensajes.scrollTop = divMensajes.scrollHeight;
}

inputPregunta.addEventListener("keypress", (e) => {
  if (e.key === "Enter") btnEnviar.click();
});

btnEnviar.addEventListener("click", async () => {
  const pais = selectPais.value;
  const estado = selectEstado.value;
  const tema = selectTema.value;
  const pregunta = inputPregunta.value.trim();

  if (!pregunta) return;

  agregarMensaje(pregunta, "usuario");
  inputPregunta.value = "";

  try {
    const resp = await fetch("/api/asesoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pais, estado, tema, pregunta })
    });

    const data = await resp.json();
    agregarMensaje(data.respuesta || "No recibí respuesta.", "bot");
  } catch (error) {
    console.error("Error en el fetch:", error);
    agregarMensaje("Hubo un error al conectar con el servidor.", "bot");
  }
});