# 📗 Manual técnico del FRONTEND

Este manual explica **qué es cada cosa** y **cómo funciona cada archivo**
del frontend (React + Vite + Three.js + Zustand + Socket.io).

---

## Índice

1. [Visión general](#1-visión-general)
2. [Flujo de una interacción del usuario](#2-flujo-de-una-interacción-del-usuario)
3. [Archivo a archivo](#3-archivo-a-archivo)
   - [vite.config.js](#viteconfigjs)
   - [src/main.jsx y src/App.jsx](#mainjsx-y-appjsx)
   - [src/api.js](#apijs)
   - [src/store/useStore.js](#storeusestorejs)
   - [src/socket.js](#socketjs)
   - [src/components/Catalogo.jsx](#catalogojsx)
   - [src/components/Outliner.jsx](#outlinerjsx)
   - [src/components/Canvas3D.jsx](#canvas3djsx)
   - [src/components/PanelParametros.jsx](#panelparametrosjsx)
   - [src/pages/Disenos.jsx](#disenosjsx)
4. [Estado global con Zustand](#4-estado-global-con-zustand)
5. [Tiempo real (WebSocket)](#5-tiempo-real-websocket)
6. [Three.js en el componente](#6-threejs-en-el-componente)
7. [Tests](#7-tests)
8. [Build y despliegue (Docker/nginx)](#8-build-y-despliegue)

---

## 1. Visión general

```
index.html ─► src/main.jsx ─► App.jsx (router)
               │                    ├── /          → Configurador
               │                    └── /designs   → Disenos
               │
        store/useStore.js (Zustand) ◄── estado global
        api.js (fetch)           ◄── rutas HTTP
        socket.js (socket.io)    ◄── tiempo real
```

Cada pieza que colocas en el canvas es un objeto "piezaDiseno" que vive en el
**store de Zustand** y que el **Canvas3D** dibuja como una malla Three.js.

---

## 2. Flujo de una interacción del usuario

**"Añadir polea y moverla un poco":**

```
1. Catalina: GET /api/pieces → store.setCatalogo(lista)
2. Usuario pulsa "Añadir" (en la tarjeta de la polea)
   → store.agregarPieza(pieza)       (nueva piezaDiseno en el estado)
   → socket.emitirUpdatePiece(...)   (avisa a la sala)
3. El store cambia → Canvas3D (suscrito) redibuja las mallas
4. Usuario hace clic en la polea 3D →
   raycaster detecta la malla → store.seleccionarPieza(key)
   → el gizmo (TransformControls) se "engancha" a esa malla
5. PanelParametros muestra sliders de la pieza seleccionada
6. Usuario mueve la pieza con el gizmo (W=mover / E=girar / R=escalar)
   → evento 'objectChange' del gizmo
   → store.actualizarPieza(key, { transform })   (local, instantáneo)
   → socket.emitirUpdatePiece(sessionId, pieza)  (a los demás)
   → PanelParametros se actualiza SOLO (mismo store)
7. Otro cliente recibe 'pieceUpdate' → store.aplicarRemoto(pieza)
   → su Canvas3D se redibuja → VÉS MOVERSE LA PIEZA EN VIVO 🎉
   (lo mismo ocurre a la inversa: si mueves un slider del panel, el store
   actualiza la malla y el gizmo la sigue automáticamente)
```

**Alternativa de selección (paso 3):** en vez de hacer clic en la malla 3D,
puedes hacer clic en la fila del **Outliner** (columna de la izquierda). Al
final todas las vías tocan el mismo `store.seleccion`, así que el gizmo, el
panel y el outliner quedan sincronizados.

**Deshacer/rehacer (paso 5):** `Ctrl+Z` deshace el último paso, `Ctrl+Shift+Z`
(o `Ctrl+Y`) lo rehace. El historial se guarda por gesto: un arrastre del
gizmo o de un slider cuenta como un único paso. Los atajos no roban las teclas
mientras escribes en un input (se comprueba `event.target.tagName`).

**Duplicar y reflejar (paso 6):** con una pieza seleccionada, el panel ofrece
"Duplicar" (o `Ctrl+D`) y "Reflejar X". Duplicar crea una copia con nueva
instancia desplazada `+0.5 m` en X para que no quede encima de la original, y
queda seleccionada la copia. Reflejar X hace un espejo de la pieza respecto al
plano YZ (x → −x): invierte el signo de la posición en X y de las rotaciones
en Y/Z, dejando la geometría intacta (dos aplicaciones la devuelven a su
lugar). Ambas acciones registran un punto de deshacer.

**Vistas de cámara (paso 7):** en la esquina inferior derecha del canvas
hay una barra flotante con las vistas estándar: **Iso**, **Frente**,
**Atrás**, **Izq.**, **Der.** y **Arriba**. Al pulsarla, la cámara se sitúa
en esa vista y centra en el centro de masas de las piezas colocadas (si no
hay piezas, mantiene el foco inicial `(0,1,0)`). La vista "Arriba" gira el
"up" de la cámara a `-Z` para encuadrar como un plano; las demás usan `+Y`.
Desde cualquier vista puedes seguir rotando/panear/zoom con el ratón.

**Plantillas base (paso 8):** en la barra del canvas, un `<select>` ofrece
puntos de partida prefabricados (estructura de prensa clásica, mesa de
trabajo, banco de musculación). Al elegir una, se **reemplaza** el diseño
actual (pide confirmación si ya hay piezas), las instancias se crean desde el
catálogo resuelto **por nombre exacto** y la primera pieza queda
seleccionada. Como la carga es una acción discreta, `Ctrl+Z` recupera el
diseño anterior.

**Referencia de escala humana (paso 9):** junto a la máquina hay una figura
de **1,70 m** (construida con primitivas Three.js, sin modelos externos) que
ayuda a juzgar las medidas reales de las piezas. No es una pieza: no se
selecciona, ni aparece en el outliner, ni en el historial. El interruptor
"Regla de escala (1,70 m)" en la esquina superior derecha del canvas la
oculta o la muestra. Las vistas de cámara se centran solo en las piezas, así
que la figura nunca desvirtúa los encuadres.

---

## 3. Archivo a archivo

### `vite.config.js`

Vite es el dev-server + bundler. Claves:

| Bloque | Para qué sirve |
|---|---|
| `plugins: [react()]` | Soporte JSX + Fast Refresh |
| `server.proxy` | En dev, reenvía `/api`, `/auth` y `/socket.io` a `http://localhost:4000`. Gracias a esto el frontend usa rutas relativas y **no hace falta CORS entre pestañas locales**. |
| `test` | Configuración de Vitest: entorno `jsdom`, `globals: true`, setup file. |

### `main.jsx` y `App.jsx`

`main.jsx` monta React sobre `<div id="root">` y envuelve la app en
`<BrowserRouter>` (react-router) para las rutas `/` y `/designs`.

`App.jsx` define la **cabecera común** (navegación + formulario de login
opcional + acceso a guardar) y las **rutas**. El componente `Configurador`
usa el layout de 3 columnas:

```
┌────────────┐  ┌─────────────────────┐  ┌────────────┐
│  Catalogo  │  │  barra (nombre +    │  │ Parametros │
│  (piezas)  │  │   Guardar diseño)   │  │ (sliders)  │
│            │  │    ┌─────────────┐  │  │            │
│  Añadir ▸  │  │    │  Canvas3D   │  │  │ posición   │
│  Añadir ▸  │  │    │  (Three.js) │  │  │ rotación   │
│  Añadir ▸  │  │    └─────────────┘  │  │ escala     │
└────────────┘  └─────────────────────┘  └────────────┘
```

### `api.js`

Mini-cliente HTTP con `fetch` plano (sin axios — menos dependencias):

- `peticion(path, opts)` parsea `{method, body}`, añade el header
  `Authorization: Bearer <token>` si hay un JWT en localStorage, lanza
  `Error` con el mensaje del servidor si `!res.ok`.
- Exporta funciones por dominio: `getPiezas`, `guardarDiseno`, `getDisenos`,
  `getDiseno`, `getBom`, `registrar`, `iniciarSesion`.

> El token se lee de `localStorage` para que la "sesión" sobreviva al refrescar.

### `store/useStore.js`

El **cerebro del estado global** (Zustand). Ver sección 4.

### `socket.js`

Cliente Socket.io. Ver sección 5.

### `Catalogo.jsx`

- En `useEffect` (con guard `activo`) carga el catálogo una vez.
- Renderiza una **tarjeta por pieza**: silueta de color según `geometry`,
  nombre, categoría/precio/peso y botón **Añadir**.
- `anadir()` llama a la acción del store y después emite por WebSocket la pieza
  nueva (para que otros clientes la vean aparecer).

> El guard `activo` es una práctica habitual con React 18: evita `setState`
> después de desmontar.

### `Outliner.jsx`

Árbol del diseño (paso 3), como el panel de capas de Blender/Illustrator:

- Agrupa las piezas colocadas **por categoría** del catálogo (`pieceId` →
  `catalogo[].category`). Las piezas llegadas por WebSocket sin ficha en el
  catálogo caen en **"Sin categoría"**.
- Cada fila muestra el **punto de color** de la pieza, nombre (con `#N` si hay
  varias copias) y su **posición**.
- Clic en la fila → `store.seleccionarPieza(key)` → **el gizmo y el panel se
  sincronizan** por el mismo `seleccion`.
- Cada categoría es un `<details>` plegable; apretar `open` mantiene el árbol
  desplegado por defecto.

### `plantillas.js` y `SelectorPlantillas.jsx`

**Plantillas base (paso 8).** `plantillas.js` es un array de datos puro:
cada plantilla tiene `slug`, `nombre`, `descripcion` y una lista `piezas`,
referenciadas por el **nombre exacto** del catálogo (los ids de BD no son
estables entre entornos) con su `transform` completo. Si una pieza del
catálogo no existe se ignora al cargar.

`SelectorPlantillas.jsx` es el `<select>` de la barra del canvas: pide
confirmación si ya hay piezas, invoca `store.cargarPlantilla(plantilla)` y se
deja en "Elegir…". Toda la magia de resolver nombre→ficha y construir
instancias únicas (`claveUnica()`, `pieceId`, `geometria`, `cantidad`,
`transform`) está en la acción del store, que además registra un punto de
deshacer (la plantilla es deshacible con `Ctrl+Z`).

### `registroVistas.js` y `VistasCamara.jsx`

Mecanismo de **vistas de cámara** (paso 7), desacoplado para evitar
dependencias circulares:

- `registroVistas.js` es EL puente: un `Set` de "aplicadores" que cada
  instancia de `Canvas3D` registra al montar (y elimina al desmontar). Expone
  `registrarAplicadorVista(fn)` y `aplicarVista(codigo)`.
- `VistasCamara.jsx` es SOLO consumidor: no sabe nada de three. Renderiza la
  barra flotante (Iso / Frente / Atrás / Izq. / Der. / Arriba) y al pulsar un
  botón hace `aplicarVista(codigo)`.
- El aplicador en `Canvas3D` mueve `camera.position` y `controls.target` al
  centro de masas de las piezas, ajusta `camera.up` (la vista Arriba usa
  `(0,0,−1)` para encuadrar como plano) y llama `controls.update()`. No
  modifica el store: es puramente visual.

### `Canvas3D.jsx`

El corazón 3D (ver sección 6). Incluye el **gizmo de transformación**
(`TransformControls`) enganchado a la pieza seleccionada.

### `PanelParametros.jsx`

- Lee la pieza **seleccionada** del store (`seleccion`).
- `ControlEje` = un campo numérico + slider para UN eje (X/Y/Z) de una
  propiedad (posición, rotación, escala).
- Rotación se muestra en **grados** pero se guarda en **radianes** (unidad de
  Three.js) — la conversión se hace en `alCambiar`.
- Cada cambio: `actualizarPieza` + `emitirUpdatePiece`.

### `Disenos.jsx`

- `GET /api/machines` → lista de tarjetas (nombre, versión, fecha, total BOM).
- Botón "Ver BOM" → `GET /api/machines/:id/bom` → tabla expandible de
  cantidad/pieza/material/€-unitario/subtotal con total.

---

## 4. Estado global con Zustand

Zustand es un mini-Redux sin boilerplate. `create()` recibe una función
`(set, get) => ({ estado, acciones })`.

```js
const { create } = require('zustand');
const useStore = create(
  persist((set, get) => ({
    sessionId: crypto.randomUUID(),      // sala de colaboración
    catalogo: [],                        // piezas de la API
    piezasDiseno: [],                    // piezas colocadas (con transform)
    seleccion: null,                     // clave de la pieza activa
    usuario: null,
    // acciones:
    agregarPieza: (cat) => set(...),
    actualizarPieza: (key, delta) => set(...),
    aplicarRemoto: (pieza) => set(...),  // viene de WebSocket
    ...
  })),
  { name: 'prensa-diseno', partialize: ... }
);
```

**Decisiones clave:**

- **`persist` + `partialize`**: los datos del diseño (sessionId, nombre, piezas)
  se guardan en localStorage. El catálogo y el usuario NO (vienen de la API).
- **`partialize`** recorta lo que se persiste. Sin él, guardaríamostodo el store.
- **`aplicarRemoto`** duplica piezas si otro cliente creó una con una `key` que
  no conocemos → la sincronización funciona en ambos sentidos.
- **Historial de deshacer/rehacer (paso 5)**: el store mantiene
  `historialPasado` / `historialFuturo`, arrays de "instantáneas" del diseño
  (copias profundas con `clonar()`), y **no** se persisten en localStorage.
  Cada acción mutadora registra el estado previo:

  - Acciones **discretas** (agregar, eliminar, limpiar, cambio remoto) siempre
    crean un punto con `puntoHistorial()`.
  - El **gizmo** tiene frontera real de gesto: en `mouseDown` hace
    `capturarHistorial()` (punto del estado previo + `historialAbierto: true`) y
    en `mouseUp` `cerrarHistorial()`. Mientras está abierto, `actualizarPieza`
    NO apila puntos → **todo un arrastre es un único Ctrl+Z** pase lo que pase
    (los frames pueden ir espaciados en máquinas lentas).
  - Para editores continuos **sin** frontera de gesto (sliders del panel),
    `actualizarPieza` usa `puntoArrastre()`: solo registra si pasaron más de
    `MISMO_PASO_MS = 120 ms` desde el último punto → un barrido de slider
    cuenta como un único paso.
  - `historialUltimo` marca el instante del último punto para ese colapso;
    `deshacer`/`rehacer` lo reinician (cortan la "ráfaga").
  - `deshacer()`/`rehacer()` restauran la instantánea (recalculando la
    selección si la pieza activa dejó de existir). Un cambio nuevo corta el
    redo (`historialFuturo: []`).
- **Estructura de la piezaDiseno** — es el contrato entre store, canvas y WS:

```js
{
  key: 'p-abc123',                       // clave de Instancia (única por pieza)
  pieceId: 'clx...',                     // id en el catálogo (BD)
  nombre: 'Polea 120 mm',
  geometria: { tipo:'cylinder', color:'#fab005', size:[0.06,0.03,24] },
  cantidad: 1,
  transform: { position:[0,1,0], rotation:[0,0,0], scale:[1,1,1] }
}
```

> Los componentes NO tocamos el store directamente: usan las **acciones**.

---

## 5. Tiempo real (WebSocket)

`socket.js` conecta con el backend y traduce eventos en acciones del store:

| Dirección | Evento | Acción |
|---|---|---|
| Cliente → Server | `joinDesign {designId}` | Entrar en la sala al montar el configurador |
| Cliente → Server | `updatePiece {designId, piece}` | Enviar cambios al mover/editar |
| Server → Cliente | `pieceUpdate (piece)` | `store.aplicarRemoto(piece)` |
| Server → Cliente | `peerJoined {peerId}` | Aviso de otro editor (console) |

**Optimización — throttle**: mover un slider genera decenas de eventos/segundo.
`emitirThrottled` agrupa los envíos: guarda el último valor y emite como máximo
cada 80 ms. Mantiene el tiempo real sin saturar la red.

**Conexión**: `io(undefined, { autoConnect: false })` → controlamos cuándo
conectar desde `sincronizarDiseno(designId)` (llamado desde `App.jsx` al montar,
con desconexión al desmontar).

---

## 6. Three.js en el componente

`Canvas3D.jsx` usa Three.js **imperativo** (sin react-three-fiber) para mantener
las dependencias al mínimo. El ciclo de vida dentro de un único `useEffect`
que se ejecuta **una vez** al montar:

```
useEffect(() => {
  // 1) escena + cámara + renderer (appendChild del <canvas>)
  // 2) OrbitControls (rotar/zoom/pan)
  // 2b) TransformControls: el gizmo (W/E/R) enganchado a la selección
  // 3) luces + GridHelper (suelo)
  // 4) Raycaster (selección por clic)
  // 5) dibujarMallas(): crear/actualizar/borrar mallas según el store
  // 6) useStore.subscribe(...) → redibuja al cambiar piezas/selección
  // 7) eventos de puntero (selección) + tecla W/E/R + Ctrl+Z/Y + resize
  // 8) bucle requestAnimationFrame (render cada frame)
  // 9) cleanup: desconecta suscripción y libera recursos WebGL
}, []);
```

**Teclado (pasos 1 y 5):** `alTecla` escucha `keydown` en `window` y, con un
guard previo (si el foco está en un `INPUT`/`TEXTAREA`/`SELECT` no actúa),
hace `Ctrl+Z` → `deshacer()`, `Ctrl+Shift+Z` o `Ctrl+Y` → `rehacer()`. `Ctrl+D`
→ `duplicarPieza()`. Si no era un atajo, reenvía al modo del gizmo con **W**=mover, **E**=girar, **R**=escalar.

**¿Por qué un solo `useEffect` vacío?** Porque los objetos Three.js no son
"reactivos". La reactividad entra por la **suscripción al store**
(`useStore.subscribe`). Cuando el estado cambia, `dibujarMallas()` actualiza
posición/rotación/escala/color de las mallas existentes, crea las nuevas y
elimina las retiradas.

**Selección**: clic → `raycaster.setFromCamera(pointer, camera)` →
`intersectObjects(mallas)` → `seleccionarPieza(key)` → la malla se pinta con
`emissive` (brillo) mientras está seleccionada.

**El gizmo de transformación (`TransformControls`).** Es la pieza clave de la
edición: sustituye al "arrastre libre" por un controlador con ejes de color que
permite **mover** (W), **girar** (E) y **escalar** (R) la pieza seleccionada.

- Se crea una vez en el `useEffect` y se añade su manecilla a la escena con
  `scene.add(transformControls.getHelper())`.
- Al seleccionar una pieza, `dibujarMallas()` hace `attach(malla)`: a partir de
  ese momento el gizmo manipula directamente esa malla. Al deseleccionar se hace
  `detach()` y se desactiva (`enabled = false`).
- El arrastre emite el evento `objectChange` por cada frame: leemos
  `position/rotation/scale` de la malla y los escribimos en el store con
  `actualizarPieza`. De ahí salen dos efectos en cadena:
  1. el **subscribe** redibuja (misma transformación → sin bucle) y
  2. `PanelParametros` lee el mismo store → sus inputs/sliders se mueven solos.
- A la **inversa**, si el usuario arrastra un slider del panel, el store
  modifica la malla y el gizmo la sigue porque está enganchado a ella.
- Los eventos `mouseDown`/`mouseUp` del gizmo pausan/reanudan `OrbitControls`
  para que la cámara no gire mientras se arrastra un eje.
- El envío por WebSocket pasa por el throttle de `socket.js`, así que arrastrar

**Duplicar (paso 6).** El botón "Duplicar" (o `Ctrl+D` en el canvas) ejecuta
`duplicarPieza(key)`, que busca la pieza en `piezasDiseno`, crea una copia con
`key: claveUnica()`, hereda `nombre/geometria/cantidad/transform`, desplaza la
posición `+0.5 m` en X para que no quede encima y dispara el click de la
selección hacia la copia. La acción es discreta: registra un punto de
deshacer con el estado previo.

**Reflejar X.** `reflejarPieza(key)` espeja la pieza respecto al plano YZ
(x → −x): el vector posición queda `[-px, py, pz]`, las rotaciones se
invierten en Y y Z (`[rx, −ry, −rz]`) y la escala no cambia. Al ser un
operador involutivo (aplicarlo dos veces devuelve la pieza a su pose
original), la iteración es sencilla de comprender y de "deshacer".

- El envío por WebSocket pasa por el throttle de `socket.js`, así que arrastrar
  el gizmo no satura la red (solo se emite como máximo cada 80 ms por pieza).

**Snapping configurable (paso 2).** TransformControls redondea el arrastre si
las propiedades `translationSnap`, `rotationSnap` y `scaleSnap` están fijadas:

- El estado vive en el store (`snapping: { activo, espaciado, angulo, escala }`)
  y **se persiste** en localStorage (en `partialize` de `useStore.js`).
- El panel (`ConfigSnapping` en `PanelParametros.jsx`) edita esos valores:
  espaciado de posición en metros, ángulo de giro en grados y paso de escala.
- `Canvas3D` reacciona al cambio de `snapping` por su suscripción al store y
  aplica:
  ```
  transformControls.translationSnap = espaciado              // escalar (metros)
  transformControls.rotationSnap     = angulo * (π / 180)    // grados → radianes
  transformControls.scaleSnap        = escala                // paso de escala
  ```
  `translationSnap` es un **escalar** (three redondea X, Y y Z a ese paso).
  Si `activo` es false, las tres se ponen a `null` → arrastre libre.
- Así mover la pieza con el gizmo "salta" de `0.25 en 0.25 m`, girar de `15° en
  15°` y escalar de `0.1 en 0.1` (valores por defecto editables).

**Geometrías**: `BoxGeometry` para tubos/chapas/asientos y `CylinderGeometry`
para poleas/rodamientos. La clave de geometría evita recrear la forma si no
cambió (perf).

**Hit-box ampliado (paso 4).** Los tubos finos (3×3 cm) son casi imposibles
de pinchar con el ratón. Por eso cada pieza tiene además una **caja de
colisión invisible** (material `visible:false`) que **nunca se renderiza**:

- `tamanoHitBox()` calcula el tamaño en el mundo: para `box` usa `size`, para
  `cylinder` usa `[diámetro, alto, diámetro]`, lo multiplica por la escala de
  la pieza y garantiza un **mínimo por eje** (`HITBOX_MIN = 0.06 m`).
- El raycaster intersecta estas cajas (`colisionadores`) en vez de las mallas
  visuales, así que el clic "engorda" solo en la detección, no en el dibujo.
- Las piezas grandes mantienen su hit-box exacto (el mínimo solo sube lo que
  es más pequeño que 6 cm en algún eje).

**TODO (avanzado)**: sustituir por modelos GLTF con `GLTFLoader` manteniendo la
misma interfaz ("geometria") — así el Canvas seguirá funcionando igual.

---

## 7. Tests

`src/__tests__/Canvas3D.smoke.test.jsx` hace un *smoke test*:

- **Mockea `three`, OrbitControls y TransformControls** (jsdom no tiene WebGL;
  sustituimos las clases por stubs con métodos no-op).
- Verifica que el componente se monta, muestra `data-testid="canvas3d"` y se
  desmonta sin excepciones.
- Comprueba que el store expone la configuración de **snapping** con sus valores
  por defecto y que `setSnapping` la actualiza. Incluye además los tests de
  **deshacer/rehacer** (paso 5) y de **duplicar/reflejar** (paso 6) a nivel de
  lógica del store.

`src/__tests__/VistasCamara.smoke.test.jsx` (paso 7) no toca Three.js: el
componente está desacoplado vía `registroVistas`. Verifica que renderiza los 6
botones, que un clic publica el código correcto en el registro y que la baja de
un aplicador funciona.

`src/__tests__/Plantillas.smoke.test.jsx` (paso 8) verifica las plantillas (definición
con slugs únicos), la resolución por nombre contra un catálogo mínimo, el
no-op cuando no hay fichas, y el selector (render de opciones, carga al elegir
y petición de confirmación con diseño no vacío).

`src/__tests__/Canvas3D.smoke.test.jsx` añade además (paso 9) la comprobación
del interruptor de la regla humana: está activo por defecto y se puede
des/activar sin romper el canvas.

`src/__tests__/Outliner.smoke.test.jsx` (paso 3) verifica el árbol: agrupa por
categoría (incluido el fallback "Sin categoría"), muestra una fila por pieza y
un clic selecciona la pieza en el store.

El mock de `three` incluye los stubs de las clases que usa `Canvas3D`
(`MeshBasicMaterial` entre ellos, necesarios para las hit-boxes del paso 4).

`src/test/setup.js` aporta los polyfills que jsdom no trae: `requestAnimationFrame`,
`canvas.getContext`, `ResizeObserver`.

Ejecuta: `cd frontend && npm run test`.

> Para tests más profundos: testear la lógica de transformaciones del store
> (sin Three.js) o el flujo completo con React Testing Library y mocks de `api.js`.

---

## 8. Build y despliegue (Docker/nginx)

`Dockerfile` en dos fases:

```
FASE 1 (build):  node:20-slim → npm ci → vite build → dist/
FASE 2 (runt):   nginx:1.27-alpine → copia dist/ + nginx.conf → sirve :80
```

`nginx.conf` hace tres cosas críticas:

1. `location / { try_files $uri $uri/ /index.html; }` → SPA fallback
   (react-router necesita que `/designs` sirva el HTML).
2. `location /api/`, `/auth/`, `/health` → proxy hacia el contenedor
   `backend:4000`.
3. `location /socket.io/` → **proxy WebSocket** con `Upgrade`/`Connection`
   (`proxy_read_timeout 86400s` para conexiones largas).

Así la app en producción es **un solo contenedor** que sirve estáticos y
proxifica la API — sin CORS ni bases de URL cruzadas.

---

## Comandos útiles

```bash
cd frontend
npm install            # dependencias
npm run dev            # dev server http://localhost:5173
npm run build          # compilar a dist/
npm run preview        # servir el build (como en producción, sin nginx)
npm run lint           # ESLint
npm run test           # Vitest (smoke canvas)
```