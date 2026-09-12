// ============================================================
// src/db.js — instancia de Prisma (o fake en tests)
//
// En desarrollo/producción (NODE_ENV ≠ 'test') creamos la
// instancia real de PrismaClient (un singleton compartido).
//
// En TESTS (NODE_ENV === 'test') usamos una base de datos falsa
// en memoria (src/dbFake.js) para que los tests unitarios corran
// sin PostgreSQL. Así los tests pasan por la app real al 100%,
// sin mocks de módulos (evita las limitaciones de mocks CJS/ESM
// de Vitest).
//
// SELECCIÓN AUTOMÁTICA: los tests solo tienen que poner
// `process.env.NODE_ENV = 'test'` antes de importar la app.
// ============================================================

const { PrismaClient } = require('@prisma/client');
const { createFakePrisma } = require('./dbFake');

// La app entera usa ESTA única instancia (real o falsa)
const prisma = process.env.NODE_ENV === 'test' ? createFakePrisma() : new PrismaClient();

module.exports = { prisma };