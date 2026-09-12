// ============================================================
// src/server.js — PUNTO DE ENTRADA del backend
//
// Hace 4 cosas:
//   1. Carga las variables de entorno (.env)
//   2. Construye la app Express (app.js)
//   3. Crea el servidor HTTP y le conecta Socket.io
//   4. Escucha en el puerto configurado
//
// Ejecutar:  npm run dev    (nodemon, recarga automática)
//            npm start      (node, arranque normal)
// ============================================================

// 1. Variables de entorno ANTES de importar la app
// (app.js → routes → services leen process.env al cargarse)
require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 4000;

// 2 y 3. Servidor HTTP + Socket.io sobre la misma conexión.
// (Así WebSocket y REST comparten puerto — ideal para el proxy del frontend)
const httpServer = http.createServer(app);
initSocket(httpServer);

// 4. Arrancar el servidor
httpServer.listen(PORT, () => {
  console.log(`🚀 DisPro — API lista en http://localhost:${PORT}`);
  console.log(`   Healthcheck: http://localhost:${PORT}/health`);
});

// Apagado limpio: cerrar servidor y conexiones al recibir Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor...');
  httpServer.close(() => process.exit(0));
});