// app.js
import { ejecutarMotor } from "./motor.js";

const selectPais = document.getElementById("pais");
const selectEstado = document.getElementById("estado");
const selectTema = document.getElementById("tema");
const inputPregunta = document.getElementById("inputUsuario");
const btnEnviar = document.getElementById("enviar");
const divMensajes = document.getElementById("mensajes");

// Agregar mensajes al chat
function agregarMensaje(texto, tipo) {
  const div = document.createElement("div");
  div.className = tipo === "usuario" ? "mensaje usuario" : "mensaje bot";
  div.textContent = texto;
  divMensajes.appendChild(div);
  divMensajes.scrollTop = divMensajes.scrollHeight;
}

// Enviar mensaje con Enter
inputPregunta.addEventListener("keypress", async (e) => {
  if (e.key === "Enter") {
    btnEnviar.click();
  }
});

// Evento principal del botón
btnEnviar.addEventListener("click", async () => {
  const pais = selectPais.value;
  const estado = selectEstado.value;
  const tema = selectTema.value;
  const pregunta = inputPregunta.value.trim();

  if (!pregunta) return;

  // Mostrar mensaje del usuario
  agregarMensaje(pregunta, "usuario");

  // Limpiar input
  inputPregunta.value = "";

  // Ejecutar motor computable
  const resp = await fetch("/api/asesoria", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ pais, estado, tema, pregunta })
});

const data = await resp.json();
const respuesta = data.respuesta;


  // Mostrar respuesta del motor
  agregarMensaje(respuesta, "bot");
});