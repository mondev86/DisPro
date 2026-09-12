# 📘 Manual técnico del BACKEND

Este manual explica **qué es cada cosa** y **cómo funciona cada archivo**
del backend. Léelo junto al código: cada bloque tiene comentarios.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Flujo de una petición HTTP](#2-flujo-de-una-petición-http)
3. [Archivo a archivo](#3-archivo-a-archivo)
   - [src/server.js](#serverjs—punto-de-entrada)
   - [src/app.js](#appjs—la-app-express)
   - [src/db.js](#dbjs—cliente-de-prisma)
   - [src/middleware/**](#middleware—capas-intermedias)
   - [src/routes/**](#routes—los-endpoints)
   - [src/services/**](#services—la-lógica-de-negocio)
   - [src/validation/schemas.js](#validationschemasjs)
   - [prisma/schema.prisma](#prismaschemaprisma)
   - [prisma/seed.js](#prismaseedjs)
4. [Modelo de datos en detalle](#4-modelo-de-datos)
5. [WebSockets (socket.js)](#5-websockets-socketjs)
6. [Tests](#6-tests)
7. [Manejo de errores y validación](#7-manejo-de-errores-y-validación)
8. [Comandos útiles](#8-comandos-útiles)

---

## 1. Visión general

El backend es una **API REST + WebSocket** en Node.js/Express que habla con
PostgreSQL a través de Prisma. Capas, de fuera hacia dentro:

```
Cliente (REST/WS)
   │
   ▼
┌────────────────────────────────────────────────┐
│ app.js (middlewares globales: CORS, JSON, log) │
│   ├─ routes/auth.js        (POST /auth/*)      │
│   ├─ routes/pieces.js      (GET/POST /api/pieces)
│   ├─ routes/machines.js    (GET/POST /api/machines)
│   ├─ routes/health.js      (/health /metrics)  │
│   └─ notFound + errorHandler                  │
└───────────────┬────────────────────────────────┘
                ▼
       services/machineService.js   (lógica de guardado/BOM)
               │  ▼
       services/bom.js              (cálculo del BOM)
               │  ▼
       db.js (única instancia PrismaClient)
               │  ▼
          PostgreSQL
```

**Regla de oro**: las rutas son *delgadas* (validan y responden); la lógica
importante vive en `services/`. Así se puede reutilizar la misma lógica desde
REST **y** desde WebSocket (evento `saveDesign`) sin duplicar código.

---

## 2. Flujo de una petición HTTP

1. Express recibe `POST /api/machines`.
2. Pasa por los **middlewares globales** de `app.js`: CORS → parse de JSON → log.
3. Llega a `routes/machines.js` → el middleware `validate(createMachineSchema)`
   **valida el body** contra Zod (si falla → 400 sin tocar la BD).
4. El handler llama a `machineService.saveMachine(datos, userId)`.
5. El servicio calcula la versión nueva y el BOM, y guarda **en una transacción**.
6. El router responde `201` con la máquina guardada.
7. Si algo lanza una excepción → cae en `errorHandler` (500 con mensaje en dev).

---

## 3. Archivo a archivo

### `server.js` — punto de entrada

```js
require('dotenv').config();   // 1. variables de entorno ANTES de importar app
const http = require('http');
const app = require('./app'); // la app Express (no escucha)
const { initSocket } = require('./socket');

const httpServer = http.createServer(app); // 2. servidor HTTP
initSocket(httpServer);                    // 3. Socket.io sobre el MISMO puerto
httpServer.listen(PORT, () => {...});      // 4. escuchar
```

| Concepto | Explicación |
|---|---|
| `require('dotenv').config()` | Carga el `.env` en `process.env`. Se hace **primero** porque `app.js` y sus módulos leen variables al importarse. |
| `http.createServer(app)` | Express es una *función* (request handler). Aquí lo envolvemos en un servidor HTTP real para poder montar Socket.io encima. |
| `initSocket(httpServer)` | Vincula Socket.io al mismo servidor → **REST y WebSocket comparten puerto** (más fácil para proxies/CORS). |
| `SIGINT` handler | Al pulsar Ctrl+C cierra el servidor limpiamente (cierra conexiones, sale con código 0). |

> ¿Por qué separar `server.js` y `app.js`? Porque **los tests importan `app.js`
> y lanzan peticiones con supertest sin abrir un puerto real**.

### `app.js` — la app Express

Monta los middlewares globales y las rutas, y añade las dos últimas piezas:
`notFound` (404) y `errorHandler` (500).

El orden de los `app.use` **importa muchísimo** en Express: primero lo global,
luego las rutas, y **al final** los manejadores de error.

CORS: `cors({ origin: process.env.FRONTEND_URL || '*' })` permite que el
frontend de Vite (otro puerto) llame a la API. En producción debe apuntar al
dominio real.

### `db.js` — cliente de Prisma (o fake en tests)

```js
const { PrismaClient } = require('@prisma/client');
const { createFakePrisma } = require('./dbFake');

// En tests (NODE_ENV='test') usamos una BD FALSA en memoria;
// en desarrollo/producción, la instancia real de Prisma.
const prisma = process.env.NODE_ENV === 'test' ? createFakePrisma() : new PrismaClient();
```

Un **singleton**: toda la app usa la misma instancia. Prisma no conecta a la BD
al instanciarse — conecta de forma perezosa en la primera consulta y mantiene un
pool.

**¿Por qué `dbFake.js`?** Los tests quieren ejercitar la app real sin una BD.
Sustituir el módulo con `vi.mock(...)` de Vitest tiene limitaciones serias con
cadenas de `require()` en CommonJS (el mock no siempre se aplica dentro de la
app). Así que `db.js` elige una implementación en memoria cuando
`NODE_ENV === 'test'`: la app funciona con la interfaz de Prisma (métodos
`findMany`, `create`, `$transaction`, …) pero sobre arrays de JavaScript.

`dbFake.js` comparte su almacén vía `globalThis` porque los tests cargan la app
dos veces (una por `require` de Node y otra por el transformador de Vitest, que
son instancias separadas); con `globalThis` ambas ven los mismos datos.

### `middleware/` — capas intermedias

| Archivo | Rol |
|---|---|
| `validate.js` | Factory que devuelve un middleware. Usa `schema.safeParse()` de Zod (nunca lanza): si `!result.success` → 400 con la lista de errores; si es válido, escribe `req[source] = result.data` (datos "limpios"). |
| `auth.js` | `signToken(user)` firma un JWT con `{ sub, email }` y expiración 7d. `auth` es el middleware: espera `Authorization: Bearer <token>`, lo verifica y deja `req.userId`. |
| `error.js` | `notFound` responde 404 a rutas desconocidas. `errorHandler` responde 500; en producción oculta `err.message`. |

**Cómo funcionan los middlewares**: Express ejecuta sus funciones en orden; cada
una puede (a) responder, (b) llamar a `next()` para seguir, o (c) llamar a
`next(err)` para saltar al primer error-handler. Esto es la base de Express.

### `routes/` — los endpoints

| Archivo | Rutas | Detalles |
|---|---|---|
| `auth.js` | `POST /auth/register`, `POST /auth/login` | Hash bcrypt (10 rondas) antes de guardar. Mensajes de error genéricos en login ("Credenciales incorrectas") para no revelar qué emails existen. |
| `pieces.js` | `GET /api/pieces`, `POST /api/pieces` | GET público; POST protegido con `auth`. Si el slug duplicado → Prisma lanza `P2002` → respondemos 409. |
| `machines.js` | `GET /api/machines`, `POST /api/machines`, `GET /:id`, `GET /:id/bom` | Cada handler delega en `machineService`; el POST acepta sesión anónima (diseños sin usuario). |
| `health.js` | `GET /health`, `GET /metrics` | Contadores en memoria (`requestCount`) + `count()` de Prisma para métricas de BD. |

> `POST /api/machines` **no exige** `auth`: así cualquiera puede guardar. Si vienes
> autenticado, se asocia el `userId`; si no, queda `null`. Es una decisión de diseño
> deliberada para mantener el prototipo accesible.

### `services/` — la lógica de negocio

**`bom.js`** — cálculo del BOM:

```
piezasDiseno: [{ pieceId, cantidad }]
   + catálogo con precios
   => agrupa por pieceId (suma cantidades)
   => línea del BOM: quantity, unitPrice, lineTotal = price × qty
   => ordena de mayor a menor subtotal
```

Es una función **pura** (sin BD): fácil de testear y de reutilizar.

**`machineService.js`** — guardar/consultar diseños:

`saveMachine(datos, userId)`:

```
1. ¿sessionId? → machine.upsert (busca por sessionId o la crea; si existe, actualiza el nombre)
2. versión siguiente = (última versión) + 1, o 1 si es nueva
3. BOM = computeBom(piezas, catálogo)
4. $transaction:
     - crear MachineVersion (designData = JSON de piezas, bomTotal)
     - insertar filas bomItem
```

La **transacción** garantiza atomicidad: la versión y su BOM se guardan juntos o
nada. `getBom(id)` lee las filas del BOM de la última versión **uniendo** los datos
de cada pieza (`include: { piece: true }`) para devolver nombre/material/precio.

### `validation/schemas.js`

Todos los esquemas Zod de entrada. Ejemplos de herramientas que usan:

- `registerSchema` → `z.string().email()`, `z.string().min(6)`: rechaza emails
  malos y contraseñas cortas antes de tocar la BD.
- `geometrySchema` → solo `box`/`cylinder`, color hexadecimal `#rrggbb`,
  tamaños con exactamente 3 números.
- `designPieceSchema` → `transform` es una **tupla** de 3 números (Zod lo valida).
- `createMachineSchema` → `sessionId` debe ser un **UUID** real, el diseño debe
  tener ≥1 pieza.

---

## 4. Modelo de datos

```
User ───1:N─── Machine ───1:N─── MachineVersion ───1:N─── BomItem
                                        │                     │
                                        │                     └── N:1 ── Piece
                                        └── designData (JSON) ──┘
```

| Tabla | Campos clave | Para qué sirve |
|---|---|---|
| `User` | `email` (único), `passwordHash` | Autenticación |
| `Piece` | `slug` (único), `geometry` Json, `priceEur`, `weightKg` | Catálogo 3D + BOM |
| `Machine` | `sessionId` (único), `userId?`, `name` | Diseño (sala de colaboración) |
| `MachineVersion` | `machineId`, `version`, `designData` Json, `bomTotal` | Versionado del diseño |
| `BomItem` | `machineVersionId`, `pieceId`, `quantity`, `unitPrice`, `lineTotal` | Filas del BOM |

**Detalle importante**: `@@unique([machineId, version])` evita versiones
duplicadas; `@@unique([machineVersionId, pieceId])` evita que una pieza aparezca
dos veces en el mismo BOM.

Los campos `Json` guardan datos flexibles (geometría, transformaciones) sin
necesidad de migrar tablas por cada cambio de forma de la pieza.

---

## 5. WebSockets (socket.js)

Mecánica de **salas**: `socket.join('design:' + designId)` crea un grupo
lógico. `socket.to(room)` envía a **todos menos** al emisor.

```
Cliente A                    Server socket.js                 Cliente B
  | emit('updatePiece',{designId,piece})                           |
  |─ ─ ─ ─ ─ ─ ─ ───────────►| socket.to('design:id')             |
  |                           |──────── emit('pieceUpdate',piece)─►|
  |                           |                                    | store.aplicarRemoto(piece)
```

Eventos del server: `joinDesign`, `updatePiece`, `saveDesign`, `leaveDesign`,
`disconnect` (automático). El evento `saveDesign` reutiliza
`machineService.saveMachine`, igual que el REST → **una sola lógica de guardado**.

---

## 6. Tests

`test/pieces.test.mjs`:

1. Pone `process.env.NODE_ENV = 'test'` **antes** de importar la app.
2. Importa la app real (`src/app`) → `src/db.js` devuelve la **BD falsa en
   memoria** (`src/dbFake.js`).
3. Siembra la "tabla" de piezas con `prisma._seed.piece.push(...)`.
4. Lanza peticiones HTTP reales contra la app con **supertest** y comprueba
   respuestas y estructura del JSON.

Ventajas frente a mockear módulos: el test pasa por la app al 100% (middlewares,
validación Zod, rutas, formato JSON) y no depende de trucos de resolución
ESM/CJS de Vitest.

Ejecuta: `cd backend && npm run test`.

> Para añadir más tests: mismo patrón — sembrar datos en la BD falsa y probar
> auth/machines/bom. Si usas una consulta de Prisma nueva, añade su contrapartida
> en `src/dbFake.js`.

---

## 7. Manejo de errores y validación

Dos frentes, complementarios:

1. **Validación de entrada** (Zod en `validate.js`): 400 con detalles. Se dispara
   ANTES de la lógica y de la BD.
2. **Errores de ejecución** (`error.js`): cualquier `next(err)` acaba en el
   errorHandler → 500 genérico (mensaje interno solo en desarrollo).

Error de negocio típico: `P2002` (violación de unicidad de Prisma) → 409.

---

## 8. Comandos útiles

```bash
cd backend

npm run migrate          # crea migración + la aplica + regenera cliente
npm run migrate:deploy   # SOLO aplica migraciones existentes (producción)
npm run seed             # stock de materiales (36 piezas) + usuario de prueba
npm run studio           # panel web de la BD
npm run dev              # nodemon (recarga automática)
npm run lint             # ESLint (código limpio)
npm run test             # Vitest (con BD falsa en memoria)
npm run test:watch       # Vitest en modo watch
```