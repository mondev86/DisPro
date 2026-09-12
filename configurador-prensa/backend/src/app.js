// ============================================================
// src/app.js — montaje de la aplicación Express (SIN escuchar)
//
// Separamos "construir la app" de "arrancar el servidor":
//   - app.js     → crea y configura la app Express (testeable sin red)
//   - server.js  → crea el servidor HTTP, el Socket.io y escucha
//
// Esto permite que los tests importen `app` y lancen peticiones
// con supertest sin abrir un puerto real.
// ============================================================

const express = require('express');
const cors = require('cors');

const { notFound, errorHandler } = require('./middleware/error');
const authRouter = require('./routes/auth');
const piecesRouter = require('./routes/pieces');
const machinesRouter = require('./routes/machines');
const healthRouter = require('./routes/health');

const app = express();

// CORS: permitimos el origen del frontend (Vite en dev / nginx en prod)
// Si FRONTEND_URL no existe, permitimos todo (solo desarrollo).
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
  })
);

// Parseo del body en JSON con límite de 1 MB
app.use(express.json({ limit: '1mb' }));

// Pequeño log de peticiones en consola (para desarrollo)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  }
  next();
});

// ------------------------------------------------------------
// Rutas públicas y de API
// ------------------------------------------------------------
app.use('/auth', authRouter);       // login / registro
app.use('/api/pieces', piecesRouter); // catálogo de piezas
app.use('/api/machines', machinesRouter); // diseños + BOM
app.use('/', healthRouter);         // /health y /metrics

// Bienvenida en la raíz
app.get('/', (req, res) => {
  res.json({ api: 'dispro', docs: 'ver README.md', endpoints: ['/health', '/metrics', '/api/pieces', '/api/machines'] });
});

// ------------------------------------------------------------
// Manejo de errores (SIEMPRE al final, en este orden)
// ------------------------------------------------------------
app.use(notFound);   // 404 para lo no definido
app.use(errorHandler); // 500 para errores no controlados

module.exports = app;