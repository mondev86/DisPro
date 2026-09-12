// ============================================================
// src/socket.js — capa de tiempo real (Socket.io)
//
// Eventos del SERVIDOR (lo que escucha):
//   joinDesign  { designId }                → entra en la "sala" del diseño
//   updatePiece { designId, piece }         → reenvía a los demás clientes
//   saveDesign  { designId, name, pieces }  → persiste el diseño (mismo
//                                              servicio que el REST)
//
// Eventos que EMITE:
//   designSaved → confirma la persistencia al autor
//   pieceUpdate → pieza actualizada recibida de otro cliente
//
// Mecánica de salas: `socket.join('design:'+id)` crea un grupo lógico.
// `socket.to(room)` envía a TODOS los de la sala MENOS al emisor.
// ============================================================

const { Server } = require('socket.io');
const machineService = require('./services/machineService');

let io = null; // referencia global al servidor Socket.io

/**
 * Inicializa Socket.io sobre el servidor HTTP.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    // CORS: mismo origen que Express. En producción usar FRONTEND_URL.
    cors: {
      origin: process.env.FRONTEND_URL || '*',
    },
  });

  // --- Conexión de un cliente ---
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // --- Unirse a la sala de un diseño (sincronización) ---
    socket.on('joinDesign', ({ designId } = {}) => {
      if (!designId) return;
      socket.join(`design:${designId}`); // sala: "design:<uuid>"
      console.log(`   ${socket.id} se unió a la sala design:${designId}`);
      // Avisamos al resto de la sala de que hay un nuevo editor
      socket.to(`design:${designId}`).emit('peerJoined', { peerId: socket.id });
    });

    // --- Movimiento/edición de una pieza (broadcast en tiempo real) ---
    socket.on('updatePiece', ({ designId, piece } = {}) => {
      if (!designId || !piece) return;
      // `socket.to(...)` = todos menos el emisor
      socket.to(`design:${designId}`).emit('pieceUpdate', piece);
    });

    // --- Guardar diseño desde WebSocket (alternativa al REST) ---
    socket.on('saveDesign', async ({ designId, name, pieces } = {}, callback) => {
      try {
        // Reusamos el MISMO servicio que usa POST /api/machines
        const guardado = await machineService.saveMachine({ sessionId: designId, name, pieces });
        // Confirmamos al autor (si pasó función callback) y al resto de la sala
        if (typeof callback === 'function') callback({ ok: true, data: guardado });
        socket.to(`design:${designId}`).emit('designSaved', { name, version: guardado.version });
      } catch (err) {
        console.error('❌ Error al guardar por WebSocket:', err.message);
        if (typeof callback === 'function') callback({ ok: false, error: err.message });
      }
    });

    // --- Abandonar la sala y limpieza ---
    socket.on('leaveDesign', ({ designId } = {}) => {
      if (designId) socket.leave(`design:${designId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Devuelve la instancia de Socket.io (para tests o emisiones externas).
 */
function getIo() {
  return io;
}

module.exports = { initSocket, getIo };