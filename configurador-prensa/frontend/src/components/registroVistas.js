// ============================================================
// src/components/registroVistas.js — registro de "aplicadores de vista"
//
// Canvas3D es dueño de la cámara/OrbitControls y registra aquí una
// función que sabe moverlos. La barra de vistas (VistasCamara) solo
// importa la parte de PUBLICAR (`aplicarVista`), así no hay acoplamiento
// circular entre componentes.
// ============================================================

// Funciones registradas por cada instancia del canvas (habitualmente 1)
const aplicadoresVista = new Set();

// Se llama al montar Canvas3D; devuelve la función de baja.
export function registrarAplicadorVista(aplicar) {
  aplicadoresVista.add(aplicar);
  return () => aplicadoresVista.delete(aplicar);
}

// Publica un código de vista ("iso", "frente", ...) a todos los canvas.
export function aplicarVista(codigo) {
  aplicadoresVista.forEach((fn) => fn(codigo));
}