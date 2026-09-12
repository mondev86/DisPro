// ============================================================
// src/routes/health.js — healthcheck y métricas simples
//
//   GET /health   → estado del servicio (up/down) para el orquestador
//   GET /metrics  → contadores básicos desde la BD (para monitorizar)
//
// En producción real se usaría prom-client + Prometheus/Grafana.
// Aquí mantenemos algo simple y sin dependencias extra.
// ============================================================

const express = require('express');
const { prisma } = require('../db');

const router = express.Router();

// Marca de tiempo de arranque del proceso (para calcular uptime)
const START_TIME = Date.now();

// Contador en memoria de peticiones (suficiente para una primera métrica)
let requestCount = 0;

// Middleware local: cuenta cada petición a /health y /metrics
router.use((req, res, next) => {
  requestCount += 1;
  next();
});

// ------------------------------------------------------------
// GET /health — ¿está vivo el servicio?
// ------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round((Date.now() - START_TIME) / 1000), // segundos activo
    timestamp: new Date().toISOString(),
    requests: requestCount,
  });
});

// ------------------------------------------------------------
// GET /metrics — contadores desde la base de datos
// ------------------------------------------------------------
router.get('/metrics', async (req, res, next) => {
  try {
    // Contamos filas en paralelo con Promise.all
    const [pieces, machines, users, versions] = await Promise.all([
      prisma.piece.count(),
      prisma.machine.count(),
      prisma.user.count(),
      prisma.machineVersion.count(),
    ]);

    res.json({
      uptime: Math.round((Date.now() - START_TIME) / 1000),
      requests: requestCount,
      db: { pieces, machines, users, machineVersions: versions },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;