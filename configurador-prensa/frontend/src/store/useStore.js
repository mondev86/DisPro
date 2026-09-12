// ============================================================
// src/store/useStore.js — estado global con Zustand
//
// Zentrand es un mini-Redux sin boilerplate: defines un store con
// estado + acciones y cualquier componente puede leerlo o modificarlo
// con un hook (useStore). El listado de piezas colocadas, la pieza
// seleccionada y la sesión de colaboración viven aquí.
//
// Estructura de "piezaDiseno" (lo que se renderiza en 3D):
// {
//   key:        'p-<uuid>'          ← clave única por INSTANCIA colocada
//   pieceId:    'clx1234'           ← id de la pieza en el catálogo (BD)
//   nombre:     'Tubo...'           ← copia para no depender del fetch
//   geometria:  { tipo, color, size }
//   cantidad:   number
//   transform:  { position:[x,y,z], rotation:[x,y,z], scale:[x,y,z] }
// }
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Genera una clave única por instancia (para piezas duplicadas)
const claveUnica = () => `p-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;

// ------------------------------------------------------------
// HISTORIAL DE DESHACER/REHACER (paso 5)
//
// Guardamos "instantáneas" del array piezasDiseno ANTES de cada cambio.
// El reto: un arrastre del gizmo/slider produce decenas de cambios por
// segundo y no queremos llenar el historial con 60 pasos por arrastre.
// Regla usada:
//   - Acciones DISCRETAS (añadir, eliminar, limpiar, cambio remoto)
//     → siempre crean un punto de deshacer.
//   - `actualizarPieza` (transformaciones) → solo crea punto si no hay
//     otro reciente (< MISMO_PASO_MS): así un arrastre completo cuenta
//     como UN solo paso que vuelve al estado previo al gesto.
// ------------------------------------------------------------
const MISMO_PASO_MS = 120;
const HISTORIAL_MAX = 50;

// Copia profunda (los arrays de transform entran por referencia si no)
const clonar = (piezasDiseno) =>
  piezasDiseno.map((p) => ({
    ...p,
    transform: {
      position: [...(p.transform?.position ?? [0, 0, 0])],
      rotation: [...(p.transform?.rotation ?? [0, 0, 0])],
      scale: [...(p.transform?.scale ?? [1, 1, 1])],
    },
  }));

// Crea un punto de deshacer con el estado ACTUAL (antes de mutar) y
// corta el futuro (un cambio nuevo invalida el redo).
const puntoHistorial = (estado) => ({
  historialPasado: [...estado.historialPasado, clonar(estado.piezasDiseno)].slice(-HISTORIAL_MAX),
  historialFuturo: [],
  historialUltimo: Date.now(),
});

// Para transformaciones continuas: añade punto SOLO si ha pasado el
// intervalo mínimo desde el último (inicio de un nuevo arrastre).
const puntoArrastre = (estado) => {
  if (Date.now() - (estado.historialUltimo || 0) < MISMO_PASO_MS) return null;
  return puntoHistorial(estado);
};

// Creamos el store con la función `create`.
// Envolvemos en `persist` para que el trabajo no se pierda al recargar
// la página (se guarda en localStorage bajo la key "prensa-diseno").
export const useStore = create(
  persist(
    (set) => ({
      // --------------------------------------------------
      // ESTADO
      // --------------------------------------------------

      // Sesión de colaboración. Nombre fijo "dispro" → sala compartida:
      // todos los clientes que abran la app colaboran sobre el mismo diseño.
      sessionId: 'dispro',
      nombreDiseno: 'dispro',

      // Catálogo de piezas cargado desde GET /api/pieces
      catalogo: [],

      // Piezas colocadas en el canvas
      piezasDiseno: [],

      // Clave de la pieza seleccionada (null = ninguna)
      seleccion: null,

      // Historial de deshacer/rehacer (paso 5). Arrays de "instantáneas"
      // de piezasDiseno; ver helpers arriba. NO se persiste en localStorage.
      historialPasado: [],
      historialFuturo: [],
      historialUltimo: 0,
      // bandera: TRUE mientras hay un arrastre del gizmo en curso → los
      // `actualizarPieza` de los frames NO crean puntos de historial.
      historialAbierto: false,

      // Ajustes globales de "snapping" (paso 2 de la hoja de ruta):
      // cuando el gizmo está en modo Mover/Girar/Escalar, arrastrar deja
      // de ser libre y los valores se redondean a los múltiplos indicados.
      //   - activo:    el snapping está habilitado (si no, arrastre libre)
      //   - espaciado: paso de POSICIÓN en metros (0.25 → cada 25 cm)
      //   - angulo:    paso de ROTACIÓN en grados (15 → 15°, 30°, 45°...)
      //   - escala:    paso de ESCALA (0.1 → 1.0, 1.1, 1.2...)
      //
      // Se persiste para que cada clienta conserve su preferencia al
      // recargar la página.
      snapping: { activo: true, espaciado: 0.25, angulo: 15, escala: 0.1 },

      // Datos de usuario (opcional). El token vive en localStorage.
      usuario: null,

      // --------------------------------------------------
      // ACCIONES (modifican el estado)
      // --------------------------------------------------

      // Carga el catálogo desde la API
      setCatalogo: (piezas) => set({ catalogo: piezas }),

      // Añade una pieza del catálogo al canvas en una posición aleatoria
      agregarPieza: (piezaCatalogo) =>
        set((estado) => {
          // Desplazamiento inicial para que no se apilen todas en el origen
          const pos = [
            (Math.random() - 0.5) * 2,
            0.5 + Math.random() * 0.5,
            (Math.random() - 0.5) * 2,
          ];
          const nueva = {
            key: claveUnica(),
            pieceId: piezaCatalogo.id,
            nombre: piezaCatalogo.name,
            geometria: piezaCatalogo.geometry,
            cantidad: 1,
            transform: { position: pos, rotation: [0, 0, 0], scale: [1, 1, 1] },
          };
          return {
            // Acción discreta → siempre un punto de deshacer (estado previo)
            ...puntoHistorial(estado),
            piezasDiseno: [...estado.piezasDiseno, nueva],
            seleccion: nueva.key, // seleccionamos la pieza recién añadida
          };
        }),

      // Elimina una pieza del canvas
      eliminarPieza: (key) =>
        set((estado) => ({
          ...puntoHistorial(estado),
          piezasDiseno: estado.piezasDiseno.filter((p) => p.key !== key),
          seleccion: estado.seleccion === key ? null : estado.seleccion,
        })),

      // (De)selecciona una pieza
      seleccionarPieza: (key) => set({ seleccion: key }),
      deseleccionar: () => set({ seleccion: null }),

      // ---- Fronteras del arrastre del gizmo (paso 5) ----
      // Se llaman desde Canvas3D en los eventos mouseDown/mouseUp del gizmo.
      capturarHistorial: () =>
        set((estado) => ({
          // Punto de deshacer del estado ANTES del arrastre + arrastre abierto
          ...puntoHistorial(estado),
          historialAbierto: true,
        })),
      cerrarHistorial: () => set({ historialAbierto: false }),

      // Actualiza un campo de una pieza (posición, rotación, escala, cantidad)
      // `delta` puede ser { transform:{...} } o { cantidad: 5 }
      // Es la acción que llaman sliders Y gizmo durante un arrastre. El gizmo
      // ya capturó el punto en su mouseDown (`historialAbierto`), así que los
      // frames no apilan más pasos; para editores continuos sin frontera
      // (sliders del panel) se usa `puntoArrastre` (colapso por tiempo).
      actualizarPieza: (key, delta) =>
        set((estado) => {
          const historial = estado.historialAbierto
            ? null
            : puntoArrastre(estado);
          return {
            ...(historial || {}),
            piezasDiseno: estado.piezasDiseno.map((p) => {
              if (p.key !== key) return p;
              // Si llega transform, fusionamos dentro (no reemplazamos el objeto)
              const transform = delta.transform
                ? {
                    position: delta.transform.position ?? p.transform.position,
                    rotation: delta.transform.rotation ?? p.transform.rotation,
                    scale: delta.transform.scale ?? p.transform.scale,
                  }
                : p.transform;
              return { ...p, ...delta, transform };
            }),
          };
        }),

      // Aplica un cambio recibido por WebSocket (de OTRO cliente).
      // Si la pieza no existe todavía (la creó el otro), se añade.
      aplicarRemoto: (pieza) =>
        set((estado) => {
          const historial = puntoHistorial(estado);
          const existe = estado.piezasDiseno.some((p) => p.key === pieza.key);
          if (existe) {
            return {
              ...historial,
              piezasDiseno: estado.piezasDiseno.map((p) =>
                p.key === pieza.key ? { ...p, ...pieza } : p
              ),
            };
          }
          return { ...historial, piezasDiseno: [...estado.piezasDiseno, pieza] };
        }),

      // Vacía el diseño (botón "Nuevo diseño")
      limpiarDiseno: () =>
        set((estado) => ({
          ...puntoHistorial(estado),
          piezasDiseno: [],
          seleccion: null,
          // NUEVA sesión para no mezclar con la sala anterior
          sessionId: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        })),

      // --------------------------------------------------
      // DESHACER / REHACER (paso 5) — atajos Ctrl+Z / Ctrl+Shift+Z
      // --------------------------------------------------
      deshacer: () =>
        set((estado) => {
          if (estado.historialPasado.length === 0) return {}; // nada que deshacer
          const pasados = [...estado.historialPasado];
          const objetivo = pasados.pop(); // estado anterior a la última edición
          return {
            piezasDiseno: clonar(objetivo),
            // Si la selección actual seguía existiendo, se conserva
            seleccion: objetivo.some((p) => p.key === estado.seleccion)
              ? estado.seleccion
              : null,
            historialPasado: pasados,
            historialFuturo: [estado.piezasDiseno, ...estado.historialFuturo],
            historialUltimo: Date.now(), // undo/rehacer cortan la "ráfaga"
          };
        }),

      rehacer: () =>
        set((estado) => {
          if (estado.historialFuturo.length === 0) return {}; // nada que rehacer
          const futuros = [...estado.historialFuturo];
          const objetivo = futuros.shift();
          return {
            piezasDiseno: clonar(objetivo),
            seleccion: objetivo.some((p) => p.key === estado.seleccion)
              ? estado.seleccion
              : null,
            historialPasado: [...estado.historialPasado, estado.piezasDiseno].slice(-HISTORIAL_MAX),
            historialFuturo: futuros,
            historialUltimo: Date.now(), // undo/rehacer cortan la "ráfaga"
          };
        }),

      // Actualiza el nombre del diseño
      setNombreDiseno: (nombre) => set({ nombreDiseno: nombre }),

      // Actualiza los ajustes de snapping (campo a campo)
      setSnapping: (parcial) =>
        set((estado) => ({ snapping: { ...estado.snapping, ...parcial } })),

      // Usuario (login/registro opcional)
      setUsuario: (usuario) => set({ usuario }),
    }),
    {
      // Configuración de persistencia
      name: 'prensa-diseno', // clave en localStorage
      // Solo persistimos los datos relacionados con el DISEÑO
      // (no el catálogo ni el usuario, que vienen de la API)
      partialize: (estado) => ({
        sessionId: estado.sessionId,
        nombreDiseno: estado.nombreDiseno,
        piezasDiseno: estado.piezasDiseno,
        snapping: estado.snapping,
      }),
    }
  )
);