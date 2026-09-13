// ============================================================
// src/plantillas.js — PLANTILLAS BASE (paso 8)
//
// Conjuntos prefabricados de piezas que el usuario puede cargar como
// punto de partida. Cada pieza se referencia por el NOMBRE EXACTO del
// catálogo (robusto frente a ids de BD generados); al cargar, el store
// busca la ficha en `catalogo` y, si no la encuentra, se salta.
//
// Coordenadas en metros, misma convención que el canvas:
//   tubo box [w, h, largo] → el largo va en Z.
//   rotación vertical = [π/2, 0, 0] (gira el largo de Z a Y).
// ============================================================

const PI = Math.PI;

// Tabla con los nombres clave usados abajo (evita typos)
const TUBO_60 = 'Tubo cuadrado 60x60x3 (3 m)';
const TUBO_40 = 'Tubo cuadrado 40x40x3 (3 m)';
const CHAPA_10 = 'Chapa acero 10 mm (0.5 x 0.3 m)';
const CHAPA_8 = 'Chapa acero 8 mm (0.6 x 0.4 m)';
const ASA = 'Asiento básico tapizado';
const RESPLADO = 'Respaldo básico tapizado';
const ALMO = 'Almohadilla de espuma para apoyo';
const GUIA = 'Guía de deslizamiento (1 m)';
const CARRO = 'Carro de deslizamiento con ruedas';
const POLEA_80 = 'Polea 80 mm';
const EJE_30 = 'Eje calibrado Ø30 (1 m)';
const ROD_6205 = 'Rodamiento 6205-2RS';

export const PLANTILLAS = [
  {
    slug: 'prensa_clasica',
    nombre: 'Prensa clásica (estructura)',
    descripcion: 'Bancada con 4 patas, travesaños, carro deslizante, asiento y respaldo.',
    piezas: [
      { nombre: TUBO_60, transform: { position: [0.36, 1.4, -0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [-0.36, 1.4, -0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0.36, 1.4, 0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [-0.36, 1.4, 0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [-0.36, 2.1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0.36, 2.1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0, 2.1, 0.53], rotation: [0, PI / 2, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0, 2.1, -0.53], rotation: [0, PI / 2, 0], scale: [1, 1, 1] } },
      { nombre: CHAPA_8, transform: { position: [0, 0.004, 0.55], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: GUIA, transform: { position: [0.24, 0.56, -0.55], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: GUIA, transform: { position: [-0.24, 0.56, -0.55], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: CARRO, transform: { position: [0, 0.56, -0.55], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: ASA, transform: { position: [0, 1.16, 0.28], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: RESPLADO, transform: { position: [0, 1.42, 0.5], rotation: [0.35, 0, 0], scale: [1, 1, 1] } },
    ],
  },
  {
    slug: 'soporte_trabajo',
    nombre: 'Soporte de trabajo (mesa)',
    descripcion: 'Mesa robusta: 4 patas de 60x60, vigas superiores y tablero de 10 mm.',
    piezas: [
      { nombre: TUBO_60, transform: { position: [0.3, 0.55, -0.4], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [-0.3, 0.55, -0.4], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0.3, 0.55, 0.4], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [-0.3, 0.55, 0.4], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [-0.3, 1.02, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0.3, 1.02, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0, 1.02, 0.4], rotation: [0, PI / 2, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_60, transform: { position: [0, 1.02, -0.4], rotation: [0, PI / 2, 0], scale: [1, 1, 1] } },
      { nombre: CHAPA_10, transform: { position: [0, 1.05, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
    ],
  },
  {
    slug: 'banco_musculacion',
    nombre: 'Banco de musculación',
    descripcion: 'Banco con asiento y respaldo inclinables más polea de transmisión.',
    piezas: [
      { nombre: TUBO_40, transform: { position: [0.2, 0.28, -0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_40, transform: { position: [-0.2, 0.28, -0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_40, transform: { position: [0.2, 0.28, 0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_40, transform: { position: [-0.2, 0.28, 0.5], rotation: [PI / 2, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_40, transform: { position: [-0.2, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: TUBO_40, transform: { position: [0.2, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: ASA, transform: { position: [0, 0.45, 0.3], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: RESPLADO, transform: { position: [0, 0.6, 0.62], rotation: [0.3, 0, 0], scale: [1, 1, 1] } },
      { nombre: ALMO, transform: { position: [0, 0.12, 0.62], rotation: [0, 0, 0], scale: [1, 1, 1] } },
      { nombre: POLEA_80, transform: { position: [0.4, 0.9, 0.55], rotation: [0, 0, PI / 2], scale: [1, 1, 1] } },
      { nombre: EJE_30, transform: { position: [0.4, 0.9, 0.55], rotation: [0, 0, PI / 2], scale: [1, 1, 1] } },
      { nombre: ROD_6205, transform: { position: [0.4, 0.9, 0.47], rotation: [0, 0, PI / 2], scale: [1, 1, 1] } },
      { nombre: ROD_6205, transform: { position: [0.4, 0.9, 0.63], rotation: [0, 0, PI / 2], scale: [1, 1, 1] } },
    ],
  },
];