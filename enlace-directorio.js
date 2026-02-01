/**
 * PUENTE DE DATOS: CHAT -> DIRECTORIO
 * Este script es independiente para no afectar el motor de la IA.
 */

window.navegarAlDirectorio = function() {
    // 1. Capturamos lo que el usuario seleccionó en la interfaz del chat
    const filtros = {
        pais: document.getElementById("pais")?.value || "",
        estado: document.getElementById("estado")?.value || "",
        tema: document.getElementById("tema")?.value || ""
    };

    // 2. Lo guardamos en la maleta (memoria del navegador)
    localStorage.setItem('filtroUsuario', JSON.stringify(filtros));

    // 3. Nos vamos al directorio
    window.location.href = 'directorio.html';
};