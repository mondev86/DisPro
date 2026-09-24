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

describe('GET /api/machines/:id/bom.csv — exportar BOM en CSV', () => {
  let idDiseño;

  beforeAll(async () => {
    // Guardamos un diseño con las piezas ya sembradas (p1, p2)
    const creado = await request(app).post('/api/machines').send({
      sessionId: 'bbbbbbbb-cccc-dddd-eeee-ffff00000001',
      name: 'Diseño de pruebas CSV',
      pieces: [
        { pieceId: 'p1', cantidad: 2, transform: { position: [0, 0, 0] } },
        { pieceId: 'p2', cantidad: 4, transform: { position: [1, 0, 0] } },
      ],
    });
    expect(creado.status).toBe(201);
    idDiseño = creado.body.machine?.id || creado.body.id;
  });

  it('responde 200 con CSV descargable y valores por columnas', async () => {
    const res = await request(app).get(`/api/machines/${idDiseño}/bom.csv`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(`BOM-${idDiseño}.csv`);
    expect(res.text.startsWith('Pieza,Cantidad,Material,Masa Unit (kg),Masa Total (kg),Coste Unit (€),Coste Total (€)')).toBe(true);

    const lineas = res.text.trim().split('\n');
    const tubo = lineas.find((l) => l.includes('Tubo cuadrado 60x60x3 (3 m)'));
    expect(tubo).toBeTruthy();
    // cantidad 2 · masa total 2×16,9=33,80 · coste total 2×18,5=37,00
    expect(tubo).toContain('"Tubo cuadrado 60x60x3 (3 m)",2,"Acero estructural S235",16.90,33.80,18.50,37.00');
  });

  it('escapa las comillas dobles del nombre en el CSV', async () => {
    const creado = await request(app).post('/api/machines').send({
      sessionId: 'cccccccc-cccc-dddd-eeee-ffff00000002',
      name: 'Diseño con comillas',
      pieces: [{ pieceId: 'p1', cantidad: 1, transform: { position: [0, 0, 0] } }],
    });
    const idOtro = creado.body.machine?.id || creado.body.id;

    // Mutamos el nombre de p1 en la BD falsa para forzar comillas
    const { prisma } = await import('../src/db');
    prisma._seed.piece[0].name = 'Tubo 60 "XL" (3 m)';

    const res = await request(app).get(`/api/machines/${idOtro}/bom.csv`);
    expect(res.text).toContain('"Tubo 60 ""XL"" (3 m)"');
  });
});