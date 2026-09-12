// ============================================================
// src/dbFake.js — base de datos FALSA en memoria (SOLO tests)
//
// Implementa un subconjunto funcional de la API de Prisma sobre
// arrays de JavaScript. Sirve para que los tests unitarios del
// backend funcionen SIN base de datos real (sin instalar Postgres,
// sin mock de módulos con las complejidades de CJS/ESM de Vitest).
//
// Métodos implementados (los que usa la app):
//   piece.*  user.*  machine.*  machineVersion.*  bomItem.*
//   $transaction · $disconnect
//
// NO es un reemplazo de Prisma: es solo para tests. Si añades una
// consulta nueva a la app, añade aquí su contrapartida en memoria.
// ============================================================

// Generador simple de ids (cuid-like, determinista en tests)
let contador = 0;
const nuevoId = (prefixo) => `${prefixo}_${++contador}`;

// Clon profundo rápido (estado vivo no debe mutarse entre llamadas)
const clonar = (valor) => JSON.parse(JSON.stringify(valor));

// CLAVE GLOBAL del almacén en memoria.
// ⚠️ OJO: la app se carga dos veces en los tests (vía require de Node y
// vía el transformador de Vitest) → se crean DOS instancias de este módulo.
// Compartiendo el almacén por globalThis, ambas ven los MISMOS datos.
const STORAGE_KEY = '__configurador_prensa_fake_db__';

// Obtiene (o crea) el almacén compartido global
function obtenerAlmacen() {
  if (!globalThis[STORAGE_KEY]) {
    globalThis[STORAGE_KEY] = {
      piece: [],
      user: [],
      machine: [],
      machineVersion: [],
      bomItem: [],
    };
  }
  return globalThis[STORAGE_KEY];
}

function createFakePrisma() {
  // --- "Tablas" en memoria (compartidas entre instancias) ---
  const data = obtenerAlmacen();

  return {
    // Seed: expone las tablas para que los tests las rellenen
    _seed: data,

    // Limpia todas las tablas (útil entre grupos de tests)
    _reset() {
      data.piece.length = 0;
      data.user.length = 0;
      data.machine.length = 0;
      data.machineVersion.length = 0;
      data.bomItem.length = 0;
    },

    // ------------------------------------------------
    // PIECE
    // ------------------------------------------------
    piece: {
      async findMany() {
        return clonar(data.piece);
      },
      async findUnique({ where }) {
        const p = data.piece.find(
          (x) => x.id === where.id || (where.slug && x.slug === where.slug)
        );
        return p ? clonar(p) : null;
      },
      async create({ data: valores }) {
        const p = { id: nuevoId('pc'), ...valores };
        data.piece.push(p);
        return clonar(p);
      },
      async count() {
        return data.piece.length;
      },
    },

    // ------------------------------------------------
    // USER
    // ------------------------------------------------
    user: {
      async findUnique({ where }) {
        const u = data.user.find((x) => x.email === where.email || x.id === where.id);
        return u ? clonar(u) : null;
      },
      async create({ data: valores }) {
        const u = { id: nuevoId('us'), ...valores };
        data.user.push(u);
        return clonar(u);
      },
      async count() {
        return data.user.length;
      },
    },

    // ------------------------------------------------
    // MACHINE
    // ------------------------------------------------
    machine: {
      async findMany({ orderBy, include } = {}) {
        let lista = [...data.machine];
        // orden simple por updatedAt descendente
        lista.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        void orderBy; // aceptamos el arg para mantener la firma de Prisma
        if (include?.versions) {
          // añadimos todas las versiones de cada máquina
          lista = lista.map((m) => ({
            ...m,
            versions: data.machineVersion.filter((v) => v.machineId === m.id),
          }));
        }
        return clonar(lista);
      },
      async findUnique({ where, include } = {}) {
        const m = data.machine.find((x) => x.id === where.id || x.sessionId === where.sessionId);
        if (!m) return null;
        if (include?.versions) {
          return clonar({
            ...m,
            versions: data.machineVersion.filter((v) => v.machineId === m.id),
          });
        }
        return clonar(m);
      },
      async upsert({ where, update, create }) {
        const existente = data.machine.find((x) => x.sessionId === where.sessionId);
        if (existente) {
          Object.assign(existente, update); // actualizamos nombre, etc.
          return clonar(existente);
        }
        const m = { id: nuevoId('mc'), ...create };
        data.machine.push(m);
        return clonar(m);
      },
      async create({ data: valores }) {
        const m = { id: nuevoId('mc'), ...valores };
        data.machine.push(m);
        return clonar(m);
      },
      async count() {
        return data.machine.length;
      },
    },

    // ------------------------------------------------
    // MACHINE VERSION
    // ------------------------------------------------
    machineVersion: {
      async findFirst({ where, orderBy = {} }) {
        const lista = data.machineVersion
          .filter((v) => v.machineId === where.machineId)
          // orden por versión desc
          .sort((a, b) => b.version - a.version);
        void orderBy; // aceptamos el arg para mantener la firma de Prisma
        return lista[0] ? clonar(lista[0]) : null;
      },
      async create({ data: valores }) {
        const v = { id: nuevoId('mv'), ...valores };
        data.machineVersion.push(v);
        return clonar(v);
      },
      async count() {
        return data.machineVersion.length;
      },
    },

    // ------------------------------------------------
    // BOM ITEM
    // ------------------------------------------------
    bomItem: {
      async createMany({ data: filas }) {
        for (const fila of filas) {
          data.bomItem.push({ id: nuevoId('bi'), ...fila });
        }
        return { count: filas.length };
      },
      async findMany({ where, include, orderBy = {} }) {
        let lista = data.bomItem.filter((b) => b.machineVersionId === where.machineVersionId);
        // orden por subtotal desc
        lista.sort((a, b) => b.lineTotal - a.lineTotal);
        void orderBy; // aceptamos el arg para mantener la firma de Prisma
        if (include?.piece) {
          lista = lista.map((b) => ({
            ...b,
            piece: data.piece.find((p) => p.id === b.pieceId),
          }));
        }
        return clonar(lista);
      },
    },

    // ------------------------------------------------
    // TRADUCCIÓN / LIMPIEZA
    // ------------------------------------------------
    async $transaction(ejecutar) {
      // En memoria basta con ejecutar la función con `this`
      return ejecutar(this);
    },
    async $disconnect() {
      // nada que cerrar en memoria
    },
  };
}

module.exports = { createFakePrisma };