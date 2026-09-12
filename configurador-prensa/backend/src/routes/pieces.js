// ============================================================
// src/routes/pieces.js — catálogo de piezas
//
//   GET  /api/pieces  → lista todas las piezas (público)
//   POST /api/pieces  → crea una pieza (requiere JWT: `auth`)
//
// GET es público porque el catálogo se muestra en el configurador
// sin necesidad de loguearse. POST está protegido porque añadir
// componentes modifica el catálogo compartido.
// ============================================================

const express = require('express');
const { prisma } = require('../db');
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createPieceSchema } = require('../validation/schemas');

const router = express.Router();

// ------------------------------------------------------------
// GET /api/pieces — lista del catálogo
// ------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    // findMany sin filtros = todas las piezas, ordenadas por categoría
    const piezas = await prisma.piece.findMany({ orderBy: { category: 'asc' } });
    res.json(piezas);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /api/pieces — crear una pieza nueva (protegido)
// ------------------------------------------------------------
router.post('/', auth, validate(createPieceSchema), async (req, res, next) => {
  try {
    const pieza = await prisma.piece.create({ data: req.body });
    res.status(201).json(pieza);
  } catch (err) {
    // Si el slug ya existe, Prisma lanza una violación de unicidad (P2002)
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una pieza con ese slug' });
    }
    next(err);
  }
});

module.exports = router;