// ============================================================
// prisma/seed.js — datos iniciales (seed)
//
// POBLA la base de datos con:
//   1. El catálogo completo de materiales (upsert = inserta o actualiza)
//   2. Un usuario de prueba para probar la autenticación JWT
//
// CÓMO EJECUTARLO:
//   desde backend/:
//     npx prisma db seed
//     npm run seed
//
// (También puedes configurar el seed automático en package.json
//  dentro del bloque "prisma": { "seed": "node prisma/seed.js" })
// ============================================================

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ------------------------------------------------------------
// Catálogo inicial: STOCK COMPLETO de materiales para configurar
// cualquier máquina de gimnasio. Cubre estructura, uniones, ejes,
// transmisión (poleas/cables), asientos y ferretería.
// Cada pieza incluye:
//   - dimensions: medidas reales en metros (para futuros cálculos)
//   - geometry:   forma 3D básica que renderizará Three.js
//                 { tipo: 'box' | 'cylinder', size: [...], color }
// ============================================================
const PIEZAS = [
  // ----------------------------------------------------------
  // ESTRUCTURA — tubos de acero estructural (barras de 3 m)
  // ----------------------------------------------------------
  {
    slug: 'tubo_30x30x2',
    name: 'Tubo cuadrado 30x30x2 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 7.0,
    priceEur: 9.5,
    dimensions: { seccion: [0.03, 0.03], pared: 0.002, largo: 3 },
    geometry: { tipo: 'box', color: '#4c6ef5', size: [0.03, 0.03, 3] },
  },
  {
    slug: 'tubo_40x40x3',
    name: 'Tubo cuadrado 40x40x3 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 11.0,
    priceEur: 12.5,
    dimensions: { seccion: [0.04, 0.04], pared: 0.003, largo: 3 },
    geometry: { tipo: 'box', color: '#4c6ef5', size: [0.04, 0.04, 3] },
  },
  {
    slug: 'tubo_50x50x3',
    name: 'Tubo cuadrado 50x50x3 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 13.9,
    priceEur: 14.5,
    dimensions: { seccion: [0.05, 0.05], pared: 0.003, largo: 3 },
    geometry: { tipo: 'box', color: '#4c6ef5', size: [0.05, 0.05, 3] },
  },
  {
    slug: 'tubo_60x60x3',
    name: 'Tubo cuadrado 60x60x3 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 16.9,
    priceEur: 18.5,
    dimensions: { seccion: [0.06, 0.06], pared: 0.003, largo: 3 },
    // 3 metros de tubo → prisma alargado (x=ancho, y=alto, z=largo)
    geometry: { tipo: 'box', color: '#4c6ef5', size: [0.06, 0.06, 3] },
  },
  {
    slug: 'tubo_80x40x3',
    name: 'Tubo rectangular 80x40x3 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 17.4,
    priceEur: 20.0,
    dimensions: { seccion: [0.08, 0.04], pared: 0.003, largo: 3 },
    geometry: { tipo: 'box', color: '#4c6ef5', size: [0.08, 0.04, 3] },
  },
  {
    slug: 'tubo_100x50x4',
    name: 'Tubo rectangular 100x50x4 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 26.0,
    priceEur: 26.0,
    dimensions: { seccion: [0.1, 0.05], pared: 0.004, largo: 3 },
    geometry: { tipo: 'box', color: '#4c6ef5', size: [0.1, 0.05, 3] },
  },
  {
    slug: 'tubo_redondo_32x3',
    name: 'Tubo redondo Ø32x3 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 6.4,
    priceEur: 8.5,
    dimensions: { diametro: 0.032, pared: 0.003, largo: 3 },
    geometry: { tipo: 'cylinder', color: '#4c6ef5', size: [0.016, 3, 16] },
  },
  {
    slug: 'tubo_redondo_48x4',
    name: 'Tubo redondo Ø48x4 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 13.0,
    priceEur: 14.0,
    dimensions: { diametro: 0.048, pared: 0.004, largo: 3 },
    geometry: { tipo: 'cylinder', color: '#4c6ef5', size: [0.024, 3, 18] },
  },

  // ----------------------------------------------------------
  // CHAPA — placas y refuerzos de acero S355
  // ----------------------------------------------------------
  {
    slug: 'placa_4mm',
    name: 'Placa acero 4 mm (0.3 x 0.4 m)',
    category: 'chapa',
    material: 'Acero S355',
    weightKg: 3.8,
    priceEur: 8.25,
    dimensions: { espesor: 0.004, ancho: 0.3, alto: 0.4 },
    // Chapa plana: muy fina en su espesor (eje Y)
    geometry: { tipo: 'box', color: '#868e96', size: [0.4, 0.004, 0.3] },
  },
  {
    slug: 'chapa_3mm_0.5x0.5',
    name: 'Chapa acero 3 mm (0.5 x 0.5 m)',
    category: 'chapa',
    material: 'Acero S355',
    weightKg: 5.9,
    priceEur: 9.5,
    dimensions: { espesor: 0.003, ancho: 0.5, alto: 0.5 },
    geometry: { tipo: 'box', color: '#868e96', size: [0.5, 0.003, 0.5] },
  },
  {
    slug: 'chapa_6mm_0.5x0.5',
    name: 'Chapa acero 6 mm (0.5 x 0.5 m)',
    category: 'chapa',
    material: 'Acero S355',
    weightKg: 11.8,
    priceEur: 15.0,
    dimensions: { espesor: 0.006, ancho: 0.5, alto: 0.5 },
    geometry: { tipo: 'box', color: '#868e96', size: [0.5, 0.006, 0.5] },
  },
  {
    slug: 'chapa_8mm_0.6x0.4',
    name: 'Chapa acero 8 mm (0.6 x 0.4 m)',
    category: 'chapa',
    material: 'Acero S355',
    weightKg: 15.0,
    priceEur: 18.0,
    dimensions: { espesor: 0.008, ancho: 0.6, alto: 0.4 },
    geometry: { tipo: 'box', color: '#868e96', size: [0.6, 0.008, 0.4] },
  },
  {
    slug: 'chapa_10mm_0.5x0.3',
    name: 'Chapa acero 10 mm (0.5 x 0.3 m)',
    category: 'chapa',
    material: 'Acero S355',
    weightKg: 11.8,
    priceEur: 14.5,
    dimensions: { espesor: 0.01, ancho: 0.5, alto: 0.3 },
    geometry: { tipo: 'box', color: '#868e96', size: [0.5, 0.01, 0.3] },
  },
  {
    slug: 'refuerzo_triangular',
    name: 'Refuerzo triangular soldado',
    category: 'chapa',
    material: 'Acero S355',
    weightKg: 1.9,
    priceEur: 4.0,
    dimensions: { base: 0.2, altura: 0.15, espesor: 0.008 },
    geometry: { tipo: 'box', color: '#adb5bd', size: [0.2, 0.008, 0.15] },
  },

  // ----------------------------------------------------------
  // EJES — acero calibrado C45
  // ----------------------------------------------------------
  {
    slug: 'eje_calibrado_d25_1m',
    name: 'Eje calibrado Ø25 (1 m)',
    category: 'eje',
    material: 'Acero calibrado C45',
    weightKg: 3.9,
    priceEur: 8.0,
    dimensions: { diametro: 0.025, largo: 1 },
    geometry: { tipo: 'cylinder', color: '#ced4da', size: [0.0125, 1, 14] },
  },
  {
    slug: 'eje_calibrado_d30_1m',
    name: 'Eje calibrado Ø30 (1 m)',
    category: 'eje',
    material: 'Acero calibrado C45',
    weightKg: 5.5,
    priceEur: 9.5,
    dimensions: { diametro: 0.03, largo: 1 },
    geometry: { tipo: 'cylinder', color: '#ced4da', size: [0.015, 1, 14] },
  },

  // ----------------------------------------------------------
  // RODAMIENTOS
  // ----------------------------------------------------------
  {
    slug: 'rodamiento_6004',
    name: 'Rodamiento 6004-2RS',
    category: 'rodamiento',
    material: 'Acero + goma',
    weightKg: 0.06,
    priceEur: 2.5,
    dimensions: { d: 0.02, D: 0.042, ancho: 0.012 },
    geometry: { tipo: 'cylinder', color: '#adb5bd', size: [0.021, 0.012, 18] },
  },
  {
    slug: 'rodamiento_6202',
    name: 'Rodamiento 6202-2RS',
    category: 'rodamiento',
    material: 'Acero + goma',
    weightKg: 0.045,
    priceEur: 2.1,
    dimensions: { d: 0.015, D: 0.035, ancho: 0.011 },
    geometry: { tipo: 'cylinder', color: '#adb5bd', size: [0.0175, 0.011, 20] },
  },
  {
    slug: 'rodamiento_6204',
    name: 'Rodamiento 6204-2RS',
    category: 'rodamiento',
    material: 'Acero + goma',
    weightKg: 0.1,
    priceEur: 3.2,
    dimensions: { d: 0.02, D: 0.047, ancho: 0.014 },
    geometry: { tipo: 'cylinder', color: '#adb5bd', size: [0.0235, 0.014, 18] },
  },
  {
    slug: 'rodamiento_6205',
    name: 'Rodamiento 6205-2RS',
    category: 'rodamiento',
    material: 'Acero + goma',
    weightKg: 0.13,
    priceEur: 3.8,
    dimensions: { d: 0.025, D: 0.052, ancho: 0.015 },
    geometry: { tipo: 'cylinder', color: '#adb5bd', size: [0.026, 0.015, 18] },
  },

  // ----------------------------------------------------------
  // POLEAS Y CABLES (transmisión de carga)
  // ----------------------------------------------------------
  {
    slug: 'polea_60',
    name: 'Polea 60 mm',
    category: 'polea',
    material: 'NYLON-PA6',
    weightKg: 0.1,
    priceEur: 1.8,
    dimensions: { diametro: 0.06, ancho: 0.02 },
    geometry: { tipo: 'cylinder', color: '#fab005', size: [0.03, 0.02, 20] },
  },
  {
    slug: 'polea_80',
    name: 'Polea 80 mm',
    category: 'polea',
    material: 'NYLON-PA6',
    weightKg: 0.25,
    priceEur: 2.5,
    dimensions: { diametro: 0.08, ancho: 0.025 },
    geometry: { tipo: 'cylinder', color: '#fab005', size: [0.04, 0.025, 22] },
  },
  {
    slug: 'polea_120',
    name: 'Polea 120 mm',
    category: 'polea',
    material: 'NYLON-PA6',
    weightKg: 0.45,
    priceEur: 3.4,
    dimensions: { diametro: 0.12, ancho: 0.03 },
    // Forma 'cylinder': radio, alto, segmentos
    geometry: { tipo: 'cylinder', color: '#fab005', size: [0.06, 0.03, 24] },
  },
  {
    slug: 'cable_acero_4mm_1m',
    name: 'Cable de acero 4 mm (trozo 1 m)',
    category: 'cable',
    material: 'Acero trenzado',
    weightKg: 0.1,
    priceEur: 0.9,
    dimensions: { diametro: 0.004, largo: 1 },
    geometry: { tipo: 'cylinder', color: '#dee2e6', size: [0.002, 1, 8] },
  },
  {
    slug: 'cable_acero_6mm_1m',
    name: 'Cable de acero 6 mm (trozo 1 m)',
    category: 'cable',
    material: 'Acero trenzado',
    weightKg: 0.22,
    priceEur: 1.3,
    dimensions: { diametro: 0.006, largo: 1 },
    geometry: { tipo: 'cylinder', color: '#dee2e6', size: [0.003, 1, 8] },
  },

  // ----------------------------------------------------------
  // ASIENTOS Y REPOSOS
  // ----------------------------------------------------------
  {
    slug: 'asiento_basico',
    name: 'Asiento básico tapizado',
    category: 'asiento',
    material: 'Madera + espuma + polipiel',
    weightKg: 5.2,
    priceEur: 32.0,
    dimensions: { ancho: 0.35, fondo: 0.35, alto: 0.08 },
    geometry: { tipo: 'box', color: '#e64980', size: [0.35, 0.08, 0.35] },
  },
  {
    slug: 'respaldo_basico',
    name: 'Respaldo básico tapizado',
    category: 'asiento',
    material: 'Madera + espuma + polipiel',
    weightKg: 3.1,
    priceEur: 18.0,
    dimensions: { ancho: 0.35, fondo: 0.25, alto: 0.05 },
    geometry: { tipo: 'box', color: '#e64980', size: [0.35, 0.05, 0.25] },
  },
  {
    slug: 'almohadilla_espuma',
    name: 'Almohadilla de espuma para apoyo',
    category: 'asiento',
    material: 'Espuma + polipiel',
    weightKg: 0.15,
    priceEur: 6.0,
    dimensions: { ancho: 0.25, fondo: 0.12, alto: 0.06 },
    geometry: { tipo: 'box', color: '#faa2c1', size: [0.25, 0.06, 0.12] },
  },

  // ----------------------------------------------------------
  // GUÍAS Y CARROS (deslizamiento del plataforma)
  // ----------------------------------------------------------
  {
    slug: 'guia_deslizamiento_1m',
    name: 'Guía de deslizamiento (1 m)',
    category: 'guia',
    material: 'Aluminio anodizado',
    weightKg: 8.5,
    priceEur: 10.0,
    dimensions: { seccion: [0.05, 0.05], largo: 1 },
    geometry: { tipo: 'box', color: '#3b5bdb', size: [0.05, 0.05, 1] },
  },
  {
    slug: 'carro_deslizamiento',
    name: 'Carro de deslizamiento con ruedas',
    category: 'guia',
    material: 'Acero + rodamientos',
    weightKg: 6.0,
    priceEur: 12.0,
    dimensions: { ancho: 0.3, largo: 0.2, alto: 0.08 },
    geometry: { tipo: 'box', color: '#3b5bdb', size: [0.3, 0.08, 0.2] },
  },

  // ----------------------------------------------------------
  // FERRETERÍA (soldaduras unibles y ajustes)
  // ----------------------------------------------------------
  {
    slug: 'tornillo_m10x30',
    name: 'Tornillo hexagonal M10x30 (zincado)',
    category: 'herraje',
    material: 'Acero zincado',
    weightKg: 0.02,
    priceEur: 0.1,
    dimensions: { diametro: 0.01, largo: 0.03 },
    geometry: { tipo: 'box', color: '#f08c00', size: [0.015, 0.03, 0.015] },
  },
  {
    slug: 'tuerca_m10',
    name: 'Tuerca hexagonal M10',
    category: 'herraje',
    material: 'Acero zincado',
    weightKg: 0.01,
    priceEur: 0.05,
    dimensions: { ancho: 0.017, espesor: 0.008 },
    geometry: { tipo: 'box', color: '#f08c00', size: [0.017, 0.008, 0.017] },
  },
  {
    slug: 'arandela_m10',
    name: 'Arandela plana M10',
    category: 'herraje',
    material: 'Acero zincado',
    weightKg: 0.005,
    priceEur: 0.05,
    dimensions: { diametro: 0.017, espesor: 0.002 },
    geometry: { tipo: 'cylinder', color: '#f08c00', size: [0.0085, 0.002, 12] },
  },
  {
    slug: 'pasador_rapido',
    name: 'Pasador rápido con muelle',
    category: 'herraje',
    material: 'Acero inoxidable',
    weightKg: 0.15,
    priceEur: 1.2,
    dimensions: { diametro: 0.01, largo: 0.12 },
    geometry: { tipo: 'cylinder', color: '#f08c00', size: [0.01, 0.12, 12] },
  },
  {
    slug: 'manivela_ajuste',
    name: 'Manivela de ajuste de asiento',
    category: 'herraje',
    material: 'Acero con puño de plástico',
    weightKg: 0.5,
    priceEur: 4.0,
    dimensions: { largo: 0.25, diametro: 0.02 },
    geometry: { tipo: 'box', color: '#f08c00', size: [0.25, 0.02, 0.02] },
  },
  {
    slug: 'tope_goma',
    name: 'Tope de goma para cilindro',
    category: 'herraje',
    material: 'Caucho EPDM',
    weightKg: 0.05,
    priceEur: 0.5,
    dimensions: { diametro: 0.04, alto: 0.02 },
    geometry: { tipo: 'cylinder', color: '#212529', size: [0.02, 0.02, 14] },
  },
];

// Usuario de prueba:
//   email:    test@configurador.local
//   contraseña: test1234
const USUARIO_PRUEBA = { email: 'test@configurador.local', password: 'test1234' };

async function main() {
  console.log('🌱 Sembrando catálogo de piezas...');

  // Recorremos el catálogo y hacemos upsert:
  //  - Si el slug NO existe → se crea
  //  - Si el slug YA existe → se actualizan sus datos
  for (const pieza of PIEZAS) {
    await prisma.piece.upsert({
      where: { slug: pieza.slug },
      update: pieza, // valores a copiar si ya existía
      create: pieza, // valores a crear si no existía
    });
  }

  console.log(`✅ Catálogo listo (${PIEZAS.length} piezas).`);

  console.log('🌱 Creando usuario de prueba...');
  const passwordHash = await bcrypt.hash(USUARIO_PRUEBA.password, 10);
  await prisma.user.upsert({
    where: { email: USUARIO_PRUEBA.email },
    update: {}, // no sobrescribimos nada si ya existe
    create: {
      email: USUARIO_PRUEBA.email,
      passwordHash,
      name: 'Usuario de prueba',
    },
  });

  console.log('✅ Usuario de prueba listo.');
  console.log('   email: test@configurador.local');
  console.log('   contraseña: test1234');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1); // código de salida ≠ 0 → el fallo se ve en CI/terminal
  })
  .finally(async () => {
    await prisma.$disconnect(); // cerramos la conexión a la BD siempre
  });