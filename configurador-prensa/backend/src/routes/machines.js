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

// ------------------------------------------------------------
// GET /api/machines/:id/bom.csv — exportar el BOM en CSV descargable
//
// El BOM real devuelve { name, material, quantity, weightKg,
// unitPrice, lineTotal }. Se mantienen alias tolerantes para
// cualquier otro shape (dbFake o versiones futuras) → todas las
// columnas acaban rellenas.
// ------------------------------------------------------------
router.get('/:id/bom.csv', async (req, res, next) => {
  try {
    const bom = await machineService.getBom(req.params.id);
    if (!bom) return res.status(404).json({ error: 'Diseño no encontrado' });
    const items = bom.lineas || bom.items || [];
    const headers = ['Pieza', 'Cantidad', 'Material', 'Masa Unit (kg)', 'Masa Total (kg)', 'Coste Unit (€)', 'Coste Total (€)'];

    // Escapa comillas dobles → CSV válido ("a"b" → """a""b""")
    const eco = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const num = (v) => Number(v || 0);

    const filas = items.map((item) => {
      const cantidad = num(item.quantity || item.cantidad || 1);
      const pesoUnit = num(item.weightKg || item.pesoUnitKg || item.pesoKg || 0);
      // En el modelo real lineTotal = unitPrice * quantity; solo existe en
      // ese caso → masa total derivada, si no, alias del shape antiguo.
      const pesoTotal = item.lineTotal !== undefined ? pesoUnit * cantidad : num(item.pesoTotalKg || 0);
      const costeUnit = num(item.unitPrice || item.costeUnit || item.costeUnitEur || 0);
      const costeTotal = num(item.lineTotal || item.costeTotal || item.costeTotalEur || 0);
      return [
        eco(item.name || item.nombre || item.pieceName || ''),
        cantidad,
        eco(item.material || 'Acero'),
        pesoUnit.toFixed(2),
        pesoTotal.toFixed(2),
        costeUnit.toFixed(2),
        costeTotal.toFixed(2),
      ];
    });

    const contenido = [headers.join(','), ...filas.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="BOM-${req.params.id}.csv"`);
    res.send(contenido);
  } catch (err) {
    next(err);
  }
});

module.exports = router;