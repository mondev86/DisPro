// ============================================================
// src/socket.js — cliente de Socket.io (tiempo real)
//
// Conecta con el backend y traduce los eventos WebSocket en
// actualizaciones del store de Zustand:
//
//   CONECTAR  → conectar(designId)  → joinDesign(designId)
//   ENVIAR    → emitirUpdatePiece(designId, pieza)  [al mover/editar]
//   RECIBIR   → 'pieceUpdate' → store.aplicarRemoto(pieza)
//
// Nota: este módulo importa el store (y el store NO importa este
// módulo) para evitar ciclos de importación.
// ============================================================

import { io } from 'socket.io-client';
import { useStore } from './store/useStore';

// En desarrollo, Vite proxifica /socket.io al backend (ver vite.config.js).
// En producción, VITE_WS_URL puede apuntar al servidor real.
const URL_WS = import.meta.env.VITE_WS_URL || undefined;

// autoConnect:false → controlamos el momento de conectar (joinDiseno)
const socket = io(URL_WS, { autoConnect: false });

// ------------------------------------------------------------
// Utilidades de "throttle" (limitación de emisiones)
// ------------------------------------------------------------
// Cuando arrastras un slider se emiten decenas de eventos por segundo.
// Este mini-throttle limita los envíos por WebSocket conservando el último.
const pendientes = new Map();
function emitirThrottled(evento, payload, espera = 80) {
  const clave = `${evento}:${payload?.piece?.key || payload?.key || payload?.designId || 'g'}`;
  pendientes.set(clave, payload); // guardamos el último valor
  if (pendientes.has(`${clave}:t`)) return; // ya hay un timer activo
  setTimeout(() => {
    const ultimo = pendientes.get(clave);
    pendientes.delete(clave);
    pendientes.delete(`${clave}:t`);
    if (ultimo) socket.emit(evento, ultimo);
  }, espera);
  pendientes.set(`${clave}:t`, true);
}

// ------------------------------------------------------------
// API expuesta a los componentes
// ------------------------------------------------------------

/**
 * (Des)conecta el socket y entra/sale de la sala de colaboración.
 * Se llama al montar/desmontar el configurador.
 */
export function sincronizarDiseno(designId) {
  if (!socket.connected) {
    socket.connect();
  }
  socket.emit('joinDesign', { designId });

  // Al salir de la página desmontamos (pero no cerramos la página)
  return () => {
    if (socket.connected) {
      socket.emit('leaveDesign', { designId });
      socket.disconnect();
    }
  };
}

/**
 * Envía la transformación de una pieza a los demás clientes.
 * @param {string} designId - sala de colaboración
 * @param {object} pieza - objeto piezaDiseno completo (ver store)
 */
export function emitirUpdatePiece(designId, pieza) {
  if (!socket.connected) return;
  // Versión depurada para la red (sin campos circulares si los hubiera)
  emitirThrottled('updatePiece', {
    designId,
    piece: {
      key: pieza.key,
      pieceId: pieza.pieceId,
      nombre: pieza.nombre,
      geometria: pieza.geometria,
      cantidad: pieza.cantidad,
      transform: pieza.transform,
    },
  });
}

/**
 * Guarda el diseño desde WebSocket (alternativa a la llamada REST).
 * Devuelve una promesa con la confirmación del servidor.
 */
export function guardarPorSocket(designId, nombreDiseno, pieces) {
  return socket.timeout(5000).emitWithAck('saveDesign', {
    designId,
    name: nombreDiseno,
    pieces,
  });
}

// ------------------------------------------------------------
// Registro de eventos RECIBIDOS (broadcasts del servidor)
// ------------------------------------------------------------

// Cuando OTRO cliente mueve/edita una pieza, el servidor nos la reenvía
socket.on('pieceUpdate', (pieza) => {
  useStore.getState().aplicarRemoto(pieza);
});

// Aviso de que otro editor entró en la sala
socket.on('peerJoined', ({ peerId }) => {
  console.log(`👥 Otro editor se unió al diseño (${peerId})`);
});

// Confirmación de guardado (viene del evento saveDesign del servidor)
socket.on('designSaved', (info) => {
  console.log('💾 Diseño guardado por otro cliente:', info);
});

export { socket };