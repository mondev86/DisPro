// ============================================================
// src/test/setup.js — configuración global de Vitest (jsdom)
//
// Se ejecuta antes de cada test. Aquí rellenamos lo que jsdom
// no simula de forma nativa (requestAnimationFrame, getContext).
// ============================================================

import '@testing-library/jest-dom';

// jsdom no tiene requestAnimationFrame → lo simulamos con setTimeout
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

// jsdom no implementa getContext (canvas) → devolvemos un stub
// para que cualquier módulo que cree un canvas no reviente.
globalThis.HTMLCanvasElement.prototype.getContext = function () {
  return {
    // Métodos mínimos que algunos libs llaman al crear contexto
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  };
};

// jsdom tampoco tiene ResizeObserver (lo usa Three.js en algunos casos)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};