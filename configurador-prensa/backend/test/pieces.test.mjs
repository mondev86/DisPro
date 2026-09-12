// ============================================================
// test/pieces.test.mjs — test unitario del endpoint GET /api/pieces
//
// Estrategia: en vez de mockear módulos, arrancamos la app REAL
// con la base de datos FALSA en memoria (src/dbFake.js). En src/db.js
// se elige fake cuando `NODE_ENV === 'test'`, así que solo tenemos
// que definir esa variable ANTES de importar la app.
//
// Ejecución:  npm run test        (desde backend/)
// ============================================================

process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Datos de ejemplo que poblamos en la BD falsa
const mockPiezas = [
  {
    id: 'p1',
    slug: 'tubo_60x60x3',
    name: 'Tubo cuadrado 60x60x3 (3 m)',
    category: 'tubo',
    material: 'Acero estructural S235',
    weightKg: 16.9,
    priceEur: 18.5,
    dimensions: { seccion: [0.06, 0.06], largo: 3 },
    geometry: { tipo: 'box', color: '#4c6ef5', size: [0.06, 0.06, 3] },
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'p2',
    slug: 'polea_120',
    name: 'Polea 120 mm',
    category: 'polea',
    material: 'NYLON-PA6',
    weightKg: 0.45,
    priceEur: 3.4,
    dimensions: { diametro: 0.12 },
    geometry: { tipo: 'cylinder', color: '#fab005', size: [0.06, 0.03, 24] },
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
];

// Importamos la app (usa la BD falsa por NODE_ENV=test)
const app = (await import('../src/app')).default;

describe('GET /api/pieces', () => {
  beforeAll(async () => {
    // Rellenamos la "tabla" piece de la BD falsa
    const { prisma } = await import('../src/db');
    prisma._seed.piece.push(...mockPiezas);
  });

  it('devuelve 200 OK con todas las piezas del catálogo', async () => {
    const res = await request(app).get('/api/pieces');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].slug).toBe('tubo_60x60x3');
    expect(res.body[0].geometry.tipo).toBe('box');
  });

  it('devuelve JSON con el contenido esperado por el configurador', async () => {
    const res = await request(app).get('/api/pieces');

    // Cada pieza debe exponer los campos que usa el frontend (3D y BOM)
    const polea = res.body.find((p) => p.slug === 'polea_120');
    expect(polea).toMatchObject({
      priceEur: 3.4,
      geometry: { tipo: 'cylinder' },
    });
  });

  it('responde 404 para rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
  });
});