// ============================================================
// src/services/machineService.js — lógica de negocio de diseños
//
// Esta capa intermedia se usa desde DOS lugares:
//   - Rutas REST (routes/machines.js)
//   - WebSockets (socket.js, evento 'saveDesign')
//
// Así evitamos duplicar la lógica de guardado entre ambos canales.
// ============================================================

const crypto = require('crypto');
const { prisma } = require('../db');
const { computeBom, bomTotal } = require('./bom');

/**
 * Lista las máquinas guardadas con su última versión y total del BOM.
 * @returns {Promise<Array>}
 */
async function listMachines() {
  const machines = await prisma.machine.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 }, // solo la última versión
    },
  });

  // Normalizamos la forma de salida para la API
  return machines.map((m) => {
    const ultima = m.versions[0];
    return {
      id: m.id,
      sessionId: m.sessionId,
      name: m.name,
      version: ultima ? ultima.version : 0,
      bomTotal: ultima ? ultima.bomTotal : 0,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  });
}

/**
 * Devuelve una máquina con su última versión de diseño (y el BOM).
 * @param {string} id - id interno de la máquina
 * @returns {Promise<object|null>}
 */
async function getMachine(id) {
  const machine = await prisma.machine.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!machine) return null;

  const ultima = machine.versions[0];
  return {
    id: machine.id,
    sessionId: machine.sessionId,
    name: machine.name,
    userId: machine.userId,
    version: ultima ? ultima.version : 0,
    designData: ultima ? ultima.designData : [],
    bomTotal: ultima ? ultima.bomTotal : 0,
    createdAt: machine.createdAt,
    updatedAt: machine.updatedAt,
  };
}

/**
 * Guarda (o actualiza) un diseño creando una NUEVA versión.
 *
 * Flujo:
 *   1. Busca o crea la máquina por sessionId (si viene).
 *   2. Calcula la versión siguiente = última + 1 (o 1 si es nueva).
 *   3. Calcula el BOM desde el catálogo.
 *   4. Guarda la versión + filas de BOM en UNA transacción.
 *
 * @param {object} datos - { sessionId?, name, pieces }
 * @param {string|null} userId - usuario autenticado (puede ser null)
 * @returns {Promise<object>} la máquina con su nueva versión
 */
async function saveMachine(datos, userId = null) {
  const { sessionId, name, pieces } = datos;

  // --- 1. Resolver la máquina (buscar por sesión o crear) ---
  let maquina;
  if (sessionId) {
    maquina = await prisma.machine.upsert({
      where: { sessionId },
      update: { name },            // si ya existe: actualizamos solo el nombre
      create: { sessionId, name, userId }, // si no existe: la creamos
    });
  } else {
    // Sin sessionId → creamos una máquina nueva con uuid aleatorio
    maquina = await prisma.machine.create({
      data: { sessionId: crypto.randomUUID(), name, userId },
    });
  }

  // --- 2. Calcular número de versión ---
  const ultimaVersion = await prisma.machineVersion.findFirst({
    where: { machineId: maquina.id },
    orderBy: { version: 'desc' },
  });
  const nextVersion = ultimaVersion ? ultimaVersion.version + 1 : 1;

  // --- 3. Calcular BOM contra el catálogo ---
  const catalogo = await prisma.piece.findMany();
  const bomItems = computeBom(pieces, catalogo);
  const total = bomTotal(bomItems);

  // --- 4. Insertar versión + BOM de forma atómica ---
  // (transacción: o se guarda todo, o no se guarda nada)
  const version = await prisma.$transaction(async (tx) => {
    const nueva = await tx.machineVersion.create({
      data: {
        machineId: maquina.id,
        version: nextVersion,
        designData: { pieces }, // guardamos el diseño completo en JSON
        bomTotal: total,
      },
    });

    // Insertamos cada fila del BOM apuntando a la nueva versión
    await tx.bomItem.createMany({
      data: bomItems.map((item) => ({
        machineVersionId: nueva.id,
        pieceId: item.pieceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    });

    return nueva;
  });

  return { ...maquina, version: version.version, bomTotal: total, designData: { pieces } };
}

/**
 * BOM de la última versión de una máquina, con datos de cada pieza.
 * @param {string} id
 * @returns {Promise<object|null>} { machine, version, items, total } o null
 */
async function getBom(id) {
  const machine = await prisma.machine.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!machine) return null;

  const ultima = machine.versions[0];
  if (!ultima) return { machine: { id, name: machine.name }, version: 0, items: [], total: 0 };

  // Fila de BOM + datos de la pieza relacionada
  const items = await prisma.bomItem.findMany({
    where: { machineVersionId: ultima.id },
    include: { piece: true },
    orderBy: { lineTotal: 'desc' },
  });

  return {
    machine: { id: machine.id, name: machine.name },
    version: ultima.version,
    items: items.map((row) => ({
      pieceId: row.pieceId,
      slug: row.piece.slug,
      name: row.piece.name,
      category: row.piece.category,
      material: row.piece.material,
      quantity: row.quantity,
      weightKg: row.piece.weightKg,
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
    })),
    total: ultima.bomTotal,
  };
}

module.exports = { listMachines, getMachine, saveMachine, getBom };