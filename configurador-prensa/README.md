# 🏋️ DisPro — Configurador 3D de máquinas de gimnasio

**DisPro** es un configurador técnico 3D para diseñar máquinas de gimnasio
(prensas de pierna, etc.) a medida:

- Diseña con piezas seleccionables (tubos, chapas, poleas, rodamientos, asiento…).
- Render **3D interactivo** hecho con Three.js (cubos y cilindros, extensible a GLTF).
- **Sincronización en tiempo real** entre clientes con Socket.io.
- **Guardado y versionado** de diseños en PostgreSQL (con Prisma).
- **BOM** (lista de materiales) autogenerado con precios y cantidades.
- Autenticación básica con **JWT**.

> Proyecto educativo listo para ejecutar en local: cada archivo está comentado
> y hay dos manuales técnicos que explican **qué hace cada cosa y por qué**:
> - [`docs/MANUAL-BACKEND.md`](docs/MANUAL-BACKEND.md)
> - [`docs/MANUAL-FRONTEND.md`](docs/MANUAL-FRONTEND.md)

---

## 1. Arquitectura

```
┌─────────────────────┐         ┌──────────────────────────────┐
│  FRONTEND (React)   │  REST  │         BACKEND               │
│ ┌─────────────────┐ │ ─────► │  Express (API REST)           │
│ │ Catalogo +      │ │        │   GET  /api/pieces            │
│ │ Canvas3D (3D)   │ │        │   POST /api/machines          │
│ │ PanelParametros │ │        │  Socket.io (tiempo real)      │
│ │ Zustand (estado)│ │ ◄────  │   joinDesign / updatePiece    │
│ │ socket.io-client│ │  WS    │   saveDesign                  │
│ └─────────────────┘ │        └──────────────┬───────────────┘
└─────────────────────┘                       │ Prisma
                                              ▼
                                 ┌────────────────────────────┐
                                 │  PostgreSQL                │
                                 │  users · pieces · machines │
                                 │  machine_versions · bom    │
                                 └────────────────────────────┘
```

**Flujo de colaboración en tiempo real:**

```
Cliente A (mueve un slider)  ─►  store  ─►  socket.emit('updatePiece')
                                                    │
                               socket.io ──────────► ┌───────────────┐
                                                    │ Cliente B      │
                                              emit('pieceUpdate')    │
                                                     │               │
                               store.aplicarRemoto ◄──┘   el B lo ve  │
                                                    mover en vivo      │
```

---

## 2. Estructura del repositorio

```
configurador-prensa/
├── README.md                     ← este manual
├── docs/
│   ├── MANUAL-BACKEND.md         ← manual técnico del servidor
│   └── MANUAL-FRONTEND.md        ← manual técnico del cliente
├── .env.example                  ← variables para docker-compose
├── .gitignore
├── docker-compose.yml            ← db + backend + frontend (opcional)
└── .github/workflows/ci.yml      ← CI: lint + tests (backend y frontend)

backend/
├── package.json
├── .env.example
├── .dockerignore
├── Dockerfile
├── eslint.config.js
├── prisma/
│   ├── schema.prisma             ← modelo de datos (tablas)
│   └── seed.js                   ← stock de materiales + usuario de prueba
├── src/
│   ├── server.js                 ← punto de entrada (HTTP + socket)
│   ├── app.js                    ← construcción de la app Express
│   ├── db.js                     ← instancia Prisma (o fake en tests)
│   ├── dbFake.js                 ← BD en memoria SOLO para tests
│   ├── socket.js                 ← eventos WebSocket
│   ├── middleware/
│   │   ├── auth.js               ← JWT (firma + verificación)
│   │   ├── error.js              ← 404 + error handler global
│   │   └── validate.js           ← validación con Zod
│   ├── routes/
│   │   ├── auth.js               ← /auth/register, /auth/login
│   │   ├── pieces.js             ← /api/pieces
│   │   ├── machines.js           ← /api/machines (+ BOM)
│   │   └── health.js             ← /health y /metrics
│   ├── services/
│   │   ├── bom.js                ← cálculo del BOM
│   │   └── machineService.js     ← lógica de guardado/versionado
│   └── validation/
│       └── schemas.js            ← esquemas Zod de todas las entradas
└── test/
    └── pieces.test.mjs           ← test de GET /api/pieces

frontend/
├── package.json
├── .env.example
├── .dockerignore
├── Dockerfile                    ← build multi-etapa + nginx
├── nginx.conf                    ← SPA + proxy API + WebSocket
├── eslint.config.js
├── vite.config.js                ← dev server + proxy + config Vitest
├── index.html
└── src/
    ├── main.jsx                  ← arranque React + router
    ├── App.jsx                   ← navegación y páginas
    ├── api.js                    ← cliente HTTP (fetch)
    ├── socket.js                 ← cliente Socket.io
    ├── index.css                 ← estilos de la app
    ├── store/useStore.js         ← estado global (Zustand)
    ├── components/
    │   ├── Catalogo.jsx          ← tarjetas de piezas + "Añadir"
    │   ├── Canvas3D.jsx          ← render 3D (Three.js)
    │   └── PanelParametros.jsx   ← sliders/campos de la pieza activa
    ├── pages/
    │   └── Disenos.jsx           ← lista de diseños + BOM
    ├── test/setup.js             ← polyfills para tests (jsdom)
    └── __tests__/
        └── Canvas3D.smoke.test.jsx ← smoke test del canvas
```

---

## 3. Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 18+ (recomendado 20 LTS) |
| npm | 9+ |
| PostgreSQL | 14+ (o Docker para levantar la BD) |
| Docker + Compose | opcional (entorno contenerizado) |

Comprueba tu instalación:

```bash
node --version && npm --version
```

---

## 4. Puesta en marcha (desarrollo local)

### Paso 1 — Levantar la base de datos

Opción A) **Con Docker** (recomendada, no instala nada):

```bash
# Desde la raíz del proyecto
docker compose up -d db

# Comprueba que está sana:
docker compose ps
```

Opción B) **PostgreSQL nativo**: crea la BD y un usuario:

```bash
psql -U postgres -c "CREATE USER prensa WITH PASSWORD 'prensa_dev_password';"
psql -U postgres -c "CREATE DATABASE configurador_prensa OWNER prensa;"
```

### Paso 2 — Configurar variables de entorno

Cada carpeta (raíz y backend) necesita un `.env`. Copia los ejemplos:

```bash
# raíz (solo si usas docker compose)
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# backend
cd backend
cp .env.example .env
```

El `.env` del backend debe contener (ajusta contraseñas/host si es necesario):

```env
DATABASE_URL=postgresql://prensa:prensa_dev_password@localhost:5432/configurador_prensa?schema=public
JWT_SECRET=pon_un_secreto_largo_aleatorio_aqui
PORT=4000
FRONTEND_URL=http://localhost:5173
```

> Si usas Docker para la BD, `DATABASE_URL` apunta a `localhost` porque
> el puerto 5432 se expone en el host.

### Paso 3 — Instalar dependencias y migrar

```bash
cd backend
npm install

# Crea la base de datos (video) y genera la migración SQL
npm run migrate          # = prisma migrate dev

# Crea el cliente Prisma en la carpeta node_modules (por si hace falta)
npx prisma generate
```

### Paso 4 — Sembrar datos iniciales

```bash
npm run seed
```

Esto crea el **stock completo de materiales** (36 piezas en 9 categorías:
tubos, chapas, ejes, rodamientos, poleas, cables, asientos, guías y
ferretería) y un **usuario de prueba**:

| email | contraseña |
|---|---|
| `test@configurador.local` | `test1234` |

Para ver la BD en un panel web (Prisma Studio):

```bash
npm run studio
```

### Paso 5 — Arrancar el backend

```bash
npm run dev        # nodemon → recarga automática en cambios
```

Comprueba que responde:

```bash
curl http://localhost:4000/health
# → {"status":"ok","uptime":...,"requests":...,"timestamp":"..."}
```

### Paso 6 — Arrancar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. Vite proxifica `/api` y `/socket.io`
automáticamente hacia el backend (configuración en `vite.config.js`).

---

## 5. Uso rápido de la app

1. En el panel izquierdo (**Catálogo**) pulsa **Añadir** en una pieza → aparece en el canvas 3D.
2. **Arrastra** una pieza con el ratón para **moverla**; arrastra con el **botón derecho** para **girarla** (la cámara se orbita arrastrando en el vacío y con la rueda haces zoom).
3. Haz **clic** sobre la pieza → se selecciona (se ilumina) y el panel derecho muestra sus **parámetros** con sliders y campos numéricos para ajuste fino.
4. Pon un **nombre** al diseño y pulsa **💾 Guardar diseño**.
5. Abre **Diseños** para ver la lista y consultar el **BOM** de cada diseño (cantidades, precios, total).
6. Abre el sitio en **dos pestañas** a la vez: todos los clientes entran en la misma sala `dispro` y los cambios se reflejan en tiempo real entre ellas.

> Para guardar vinculado a un usuario: usa el formulario **Login/Registro** de la
> cabecera con el usuario de prueba. (El guardado también funciona anónimo.)

---

## 6. Endpoints de la API

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/health` | Estado del servicio (healthcheck) | — |
| `GET` | `/metrics` | Contadores simples (piezas, máquinas, usuarios, versiones) | — |
| `POST` | `/auth/register` | Crea un usuario `{email, password, name?}` → `{token, user}` | — |
| `POST` | `/auth/login` | Inicia sesión → `{token, user}` | — |
| `GET` | `/api/pieces` | Lista el catálogo de piezas | — |
| `POST` | `/api/pieces` | Crea una pieza | Bearer 🔐 |
| `GET` | `/api/machines` | Lista de diseños con última versión y total BOM | — |
| `POST` | `/api/machines` | Guarda un diseño (nueva versión + BOM) | optativa |
| `GET` | `/api/machines/:id` | Diseño con su última versión | — |
| `GET` | `/api/machines/:id/bom` | BOM del diseño (piezas, cantidades, subtotales, total) | — |

**Ejemplo POST /api/machines:**

```bash
curl -X POST http://localhost:4000/api/machines \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "dispro",
    "name": "DisPro Vertical 45°",
    "pieces": [
      { "pieceId": "ID_DE_PIEZA", "cantidad": 2,
        "transform": { "position": [0,1,0], "rotation": [0,0,0], "scale": [1,1,1] } }
    ]
  }'
```

---

## 7. Eventos WebSocket (Socket.io)

| Evento (cliente → servidor) | Payload | Efecto |
|---|---|---|
| `joinDesign` | `{ designId }` | Entra en la sala de colaboración |
| `updatePiece` | `{ designId, piece }` | Reenvía la pieza al resto de la sala |
| `leaveDesign` | `{ designId }` | Abandona la sala |
| `saveDesign` | `{ designId, name, pieces }` | Guarda el diseño (igual que el REST) |

| Evento (servidor → cliente) | Payload | Cuándo |
|---|---|---|
| `pieceUpdate` | `piece` | Otro cliente movió/creó una pieza |
| `peerJoined` | `{ peerId }` | Otro editor entró en la sala |
| `designSaved` | `{ name, version }` | Confirmación de guardado |

---

## 8. Tests

```bash
# Backend — test de GET /api/pieces (con BD en memoria)
cd backend && npm run test

# Frontend — smoke test del Canvas3D (Three.js mockeado)
cd frontend && npm run test
```

Los tests **no necesitan base de datos**:
- Backend: `NODE_ENV=test` activa una BD falsa en memoria (`src/dbFake.js`).
- Frontend: mock de Three.js (jsdom no tiene WebGL).

---

## 9. Lint y formato

```bash
cd backend && npm run lint           # ESLint (reglas + Prettier-compatibles)
cd frontend && npm run lint

npm run lint:fix                     # auto-corrige donde puede
npm run format                       # formatea con Prettier
```

---

## 10. Docker (entorno completo)

```bash
# 1. Copia el .env de la raíz (o crea el tuyo)
cp .env.example .env

# 2. Construye y levanta: PostgreSQL + backend + frontend
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Frontend (nginx) | http://localhost:5173 |
| Backend (API + WS) | http://localhost:4000 |
| PostgreSQL | localhost:5432 (solo interno) |

Comandos útiles:

```bash
docker compose up -d db              # solo base de datos
docker compose logs -f backend       # logs del backend
docker compose logs -f frontend      # logs del frontend
docker compose down                  # apagar (conserva datos)
docker compose down -v               # apagar y BORRAR la BD
```

> El backend en Docker ejecuta `prisma migrate deploy` en su `CMD`, por lo que
> aplica las migraciones automáticamente al arrancar. Para sembrar la BD dentro
> del contenedor: `docker compose exec backend npm run seed`.

---

## 11. Scripts disponibles

### Backend

| Script | Comando real | Qué hace |
|---|---|---|
| `npm run dev` | `nodemon src/server.js` | Servidor con recarga automática |
| `npm start` | `node src/server.js` | Servidor en producción |
| `npm run migrate` | `prisma migrate dev` | Genera y aplica migraciones |
| `npm run seed` | `node prisma/seed.js` | Semilla de datos iniciales |
| `npm run studio` | `prisma studio` | Panel web de la BD |
| `npm run lint` | `eslint src prisma test` | Análisis estático |
| `npm run test` | `vitest run` | Tests unitarios |
| `npm run docker:build` | `docker build ...` | Imagen del backend |

### Frontend

| Script | Comando real | Qué hace |
|---|---|---|
| `npm run dev` | `vite` | Dev server en :5173 |
| `npm run build` | `vite build` | Compila a `dist/` |
| `npm run preview` | `vite preview` | Sirve el build localmente |
| `npm run lint` | `eslint .` | Análisis estático |
| `npm run test` | `vitest run` | Tests (smoke canvas) |

---

## 12. CI (GitHub Actions)

Workflow en `.github/workflows/ci.yml` que, en cada push/PR a `main`:

1. Instala Node 20 con caché npm.
2. `npm ci` en backend y frontend.
3. `npm run lint` en ambos.
4. `npm run test` en ambos (con BD en memoria y mock de Three.js, sin BD real).

---

## 13. Variables de entorno

| Variable | Dónde se usa | Descripción |
|---|---|---|
| `DATABASE_URL` | backend | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | backend | Secreto para firmar tokens JWT |
| `PORT` | backend | Puerto HTTP + WebSocket (4000) |
| `FRONTEND_URL` | backend | Origen CORS permitido |
| `POSTGRES_DB/USER/PASSWORD/PORT` | compose | Datos de la BD del contenedor |
| `VITE_API_URL` / `VITE_WS_URL` | frontend | Opcionales (si no usas proxy) |

> **Seguridad**: nunca comitees `.env`. Cambia `JWT_SECRET` antes de publicar.
> Genera uno con: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

---

## 14. Extender el proyecto (hoja de ruta)

El código está pensado para crecer. Puntos de entrada marcados con `TODO` en el código:

1. **Exportación del BOM a CSV / Excel** — el `getBom()` ya devuelve una estructura
   plana ideal para serializar; solo falta un endpoint `GET /api/machines/:id/bom.csv`
   que convierta las filas a CSV (capa de transformación, sin tocar el modelo).
2. **Export DXF / PDF (planos)** — añadir un endpoint que genere DXF a partir de las
   transformaciones (rotación de tubos, posición) y, opcionalmente, una vista en 2D.
   Librerías ligeras: `dxf-parser` / `tiny-ndjson-dxf` (o generador propio).
3. **Modelos 3D reales (GLTF)** — sustituir los cubos/cilindros de `Canvas3D.jsx`
   por modelos GLTF cargados con `GLTFLoader` (trocear el tubo, usar el archivo real).
4. **Validaciones de ergonomía y seguridad** — en `schema.prisma` y en el `services/`
   correspondiente: ángulos de presión, recorrido del carro, cargas máximas
   (simulación FEM simple con `cannon-es` o reglas heurísticas).
5. **Simulación de cargas** — acoplar `cannon-es` (física) para ver la estabilidad
   estática y fuerzas en los rodamientos antes de fabricar.
6. **Despliegue real** — subir el `dist/` + API a un VPS/Railway/Fly.io con
   PostgreSQL gestionado y HTTPS (nginx conf es la base; añadir certbot).
7. **Multi-archivo / librerías de piezas** — categorías, búsqueda y packs
   (ver futuras extensiones en `docs/`).

---

## 15. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `PrismaClient is unable to run in this browser environment` | El backend se ejecutó mal empacado | No ejecutar el backend desde un bundler; siempre `node src/server.js` |
| `DATABASE_URL` no definido | Falta `.env` en `backend/` | `cp .env.example .env` y rellenar |
| `P2002` al crear pieza | El slug ya existe | Usar un slug distinto |
| Los cambios en una pestaña no se ven en la otra | `sessionId` distinto | Mismo navegador y no pulsar "Nuevo diseño"; revisar logs del backend |
| WebSocket no conecta en Docker | nginx sin `ws` upgrade | Ver `frontend/nginx.conf` (`proxy_set_header Upgrade/Connection`) |
| Puerto 5432 ocupado | otra BD local | Cambiar `POSTGRES_PORT` en `.env` |
| `npm run migrate` no aplica | Prisma CLI no tiene la BD | Levanta `docker compose up -d db` antes |

---

## 16. Siguientes pasos recomendados

1. **Añade la exportación de BOM a CSV** en `backend/src/routes/machines.js`
   (un endpoint `/:id/bom.csv` + enlace de descarga en `frontend/src/pages/Disenos.jsx`).
2. **Manipulación directa avanzada**: ya se puede mover (arrastrar) y girar
   (botón derecho) en el canvas; como siguiente paso se puede añadir el gizmo
   `TransformControls.js` de Three.js para rotar/escalar con ejes visuales y
   un gesto de escala por arrastre.
3. **Carga de juntas y puntos de soldadura** como pieza nueva del catálogo,
   con un campo `joinType` en `schema.prisma` para agrupar el BOM por tipo de unión.
4. **Validación ergonómica** (por ejemplo, ángulo de la banqueta entre 35°–50°):
   reglas en `backend/src/services/` + mensajes de aviso en `PanelParametros`.
5. **Simulación estática ligera**: calcula en el frontend el centro de masas y
   dibuja un vector de carga en `Canvas3D.jsx` (física básica, sin servidor).
6. **Autenticación por tokens de corta duración + refresh** y permisos por
   usuario en `/api/machines` (solo tus diseños), preparando el multiusuario real.

---

*Documentación detallada: ve a [`docs/MANUAL-BACKEND.md`](docs/MANUAL-BACKEND.md) y
[`docs/MANUAL-FRONTEND.md`](docs/MANUAL-FRONTEND.md) para entender el código línea a línea.*