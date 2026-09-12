// ============================================================
// src/routes/machines.js — diseños (prensas) guardados
//
//   GET  /api/machines          → lista de diseños
//   POST /api/machines          → guarda un diseño (nueva versión + BOM)
//   GET  /api/machines/:id      → un diseño con su última versión
//   GET  /api/machines/:id/bom  → BOM del diseño
//
// POST acepta usuario anónimo (userId = null) o autenticado.
// ============================================================

const express = require('express');
const { validate } = require('../middleware/validate');
const { createMachineSchema } = require('../validation/schemas');
const machineService = require('../services/machineService');

const router = express.Router();

// ------------------------------------------------------------
// GET /api/machines — lista de diseños guardados
// ------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    res.json({ machines: await machineService.listMachines() });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /api/machines — guardar un diseño
// El usuario puede venir autenticado (req.userId) o no (undefined).
// Cuerpo: { sessionId?, name, pieces:[{pieceId, cantidad, transform}] }
// ------------------------------------------------------------
router.post('/', validate(createMachineSchema), async (req, res, next) => {
  try {
    const datos = req.body;
    const userId = req.userId || null; // userName lo deja el middleware `auth` si se usó

    const resultado = await machineService.saveMachine(datos, userId);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// GET /api/machines/:id — diseño con su última versión
// ------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const diseno = await machineService.getMachine(req.params.id);
    if (!diseno) {
      return res.status(404).json({ error: 'Diseño no encontrado' });
    }
    res.json(diseno);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// GET /api/machines/:id/bom — lista de materiales del diseño
// ------------------------------------------------------------
router.get('/:id/bom', async (req, res, next) => {
  try {
    const bom = await machineService.getBom(req.params.id);
    if (!bom) {
      return res.status(404).json({ error: 'Diseño no encontrado' });
    }
    res.json(bom);
  } catch (err) {
    next(err);
  }
});

module.exports = router;