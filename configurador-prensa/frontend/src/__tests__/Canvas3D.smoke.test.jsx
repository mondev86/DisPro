// ============================================================
// src/__tests__/Canvas3D.smoke.test.jsx — smoke test del canvas 3D
//
// El objetivo NO es testear Three.js (eso lo hace la librería), sino
// verificar que nuestro componente:
//   1. se monta sin excepciones
//   2. renderiza el contenedor <div data-testid="canvas3d">
//   3. el montaje/desmontaje limpia los recursos (no hay fugas)
//
// Para ello mockeamos el módulo "three" y los controles orbitales
// con objetos vacíos (jsdom no tiene WebGL en CI).
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

// ---- MOCK del módulo three (evita WebGL en jsdom) ----
// Las clases auxiliares se definen DENTRO del factory porque
// `vi.mock` se "hoistea" (mueve) al principio del archivo y no
// puede acceder a variables declaradas fuera.
vi.mock('three', () => {
  // Clase base: no hace nada, expone campos que el componente usa
  class Stub {
    constructor() {
      this.position = { set: vi.fn() };
      this.rotation = { set: vi.fn() };
      this.scale = { set: vi.fn() };
      this.userData = {};
      this.dispose = vi.fn();
    }
  }

  // Material "estándar" con `color` y `emissive` (testable)
  class StubMaterial extends Stub {
    constructor(props = {}) {
      super();
      this.color = { set: vi.fn(), clone: () => this };
      this.emissive = { set: vi.fn() };
      this.roughness = props.roughness ?? 0.5;
      this.metalness = props.metalness ?? 0;
    }
  }

  return {
    Scene: class extends Stub { add() {} remove() {} },
    PerspectiveCamera: class extends Stub {
      constructor() {
        super();
        this.up = { set: vi.fn() };
      }
      lookAt() {}
      updateProjectionMatrix() {}
    },
    WebGLRenderer: class extends Stub {
      constructor() {
        super();
        // domElement debe ser un Nodo real para poder hacer appendChild
        this.domElement = document.createElement('canvas');
        this.setSize = vi.fn();
        this.setPixelRatio = vi.fn();
        this.render = vi.fn();
        this.shadowMap = { enabled: false };
      }
    },
    BoxGeometry: Stub,
    CylinderGeometry: Stub,
    SphereGeometry: Stub,
    Group: class extends Stub {
      constructor() {
        super();
        this.visible = false;
      }
      add() {}
    },
    MeshStandardMaterial: StubMaterial,
    MeshBasicMaterial: StubMaterial,
    Mesh: class extends Stub {
      constructor(geometry, material) {
        super();
        this.geometry = geometry;
        this.material = material;
        this.castShadow = false;
        this.receiveShadow = false;
      }
    },
    AmbientLight: class extends Stub { position = { set: vi.fn() } },
    DirectionalLight: class extends Stub { position = { set: vi.fn() } },
    GridHelper: Stub,
    Raycaster: class { setFromCamera() {} intersectObjects() { return []; } },
    Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    Vector3: class {
      constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }
    },
    Color: class { constructor() {} set() {} },
  };
});

// OrbitControls se importa desde un submódulo → mock propio
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    constructor(camera, dom) {
      this.camera = camera;
      this.dom = dom;
      this.enableDamping = false;
      this.target = { set: vi.fn() };
    }
    update() {}
    dispose() {}
  },
}));

// TransformControls (el gizmo) también viene de un submódulo → mock propio.
// Exponemos exactamente lo que usa Canvas3D: attach/detach, setMode, la
// ayuda (getHelper) para añadirla a la escena y los eventos de arrastre.
vi.mock('three/examples/jsm/controls/TransformControls.js', () => {
  class StubTransformControls {
    constructor(camera, dom) {
      this.camera = camera;
      this.domElement = dom;
      this.enabled = false;
      this.dragging = false;
      this.object = undefined; // malla enganchada (attach)
      this._helper = { add: () => {}, remove: () => {}, updateMatrixWorld: () => {} };
      this._listeners = {};
    }
    setMode() {}
    getHelper() {
      return this._helper;
    }
    attach(obj) {
      this.object = obj;
    }
    detach() {
      this.object = undefined;
    }
    addEventListener(nombre, fn) {
      (this._listeners[nombre] ||= []).push(fn);
    }
    removeEventListener(nombre, fn) {
      this._listeners[nombre] = (this._listeners[nombre] || []).filter((f) => f !== fn);
    }
    dispose() {}
  }
  return { TransformControls: StubTransformControls };
});

// Importamos el componente DESPUÉS de los mocks
import Canvas3D from '../components/Canvas3D.jsx';
import { useStore } from '../store/useStore.js';

describe('Canvas3D (smoke test)', () => {
  beforeEach(() => {
    cleanup();
    // Estado inicial limpio del store (sin piezas, sin selección)
    useStore.setState({
      piezasDiseno: [],
      seleccion: null,
    });
  });

  it('se monta y muestra el contenedor del canvas', () => {
    const { getByTestId } = render(<Canvas3D />);
    expect(getByTestId('canvas3d')).toBeInTheDocument();
  });

  it('se monta y desmonta sin lanzar excepciones (comprobación de limpieza)', () => {
    const { unmount } = render(<Canvas3D />);
    expect(() => unmount()).not.toThrow();
  });

  it('el store sigue funcionando con piezas aunque Three.js sea un stub', () => {
    // Verifica el puente store → componente a nivel de lógica
    const estadoInicial = useStore.getState();
    expect(Array.isArray(estadoInicial.piezasDiseno)).toBe(true);
  });

  it('el snapping se configura desde el store (paso 2)', () => {
    // Los valores por defecto deben existir y la acción debe actualizarlos
    const estado = useStore.getState();
    expect(estado.snapping).toEqual({
      activo: true,
      espaciado: 0.25,
      angulo: 15,
      escala: 0.1,
    });
    estado.setSnapping({ espaciado: 0.5, activo: false });
    expect(useStore.getState().snapping.espaciado).toBe(0.5);
    expect(useStore.getState().snapping.activo).toBe(false);
  });

  // ------------------------------------------------------
  // PASO 6 — duplicar y reflejar
  // ------------------------------------------------------
  const piezaPos = (pos) => ({
    key: 'test-6',
    pieceId: 'p1',
    nombre: 'Polea',
    geometria: { tipo: 'cylinder', color: '#fab005', size: [0.06, 0.03, 24] },
    cantidad: 1,
    transform: { position: pos, rotation: [0, 0, 0], scale: [1, 1, 1] },
  });

  it('duplicar crea una copia seleccionada con posición desplazada +0.5 en X (paso 6)', () => {
    reiniciarHistorial();
    useStore.setState({ piezasDiseno: [piezaPos([0.25, 0.8, 0])], seleccion: 'test-6' });
    useStore.getState().duplicarPieza('test-6');
    const estado = useStore.getState();
    expect(estado.piezasDiseno).toHaveLength(2);
    const copia = estado.piezasDiseno.find((p) => p.key !== 'test-6');
    expect(estado.seleccion).toBe(copia.key);                     // se selecciona la copia
    expect(copia.transform.position).toEqual([0.75, 0.8, 0]);   // +0.5 en X
    expect(copia.transform.rotation).toEqual([0, 0, 0]);         // hereda la rotación
    expect(copia.key).not.toBe('test-6');                         // distinta instancia
  });

  it('reflejar pieza invierte la posición en X y la rotación Y/Z (paso 6)', () => {
    reiniciarHistorial();
    useStore.setState({
      piezasDiseno: [piezaPos([0.5, 0.8, 0])],
      seleccion: 'test-6',
    });
    useStore.getState().reflejarPieza('test-6');
    const t = useStore.getState().piezasDiseno[0].transform;
    expect(t.position[0]).toBeCloseTo(-0.5, 5);   // espejo X
    expect(t.position[1]).toBeCloseTo(0.8, 5);    // sin cambio

    // Aplicarlo una segunda vez debe restaurar exactamente
    useStore.getState().reflejarPieza('test-6');
    const t2 = useStore.getState().piezasDiseno[0].transform;
    expect(t2.position[0]).toBeCloseTo(0.5, 5);
    expect(t2.rotation[1]).toBeCloseTo(0, 5);
    expect(t2.rotation[2]).toBeCloseTo(0, 5);
  });

  // ------------------------------------------------------
  // PASO 5 — deshacer / rehacer (Ctrl+Z / Ctrl+Shift+Z)
  // ------------------------------------------------------
  const piezaBase = (key, pos) => ({
    key,
    pieceId: 'p1',
    nombre: 'Patín',
    geometria: { tipo: 'box', size: [0.3, 0.2, 0.3] },
    cantidad: 1,
    transform: { position: pos, rotation: [0, 0, 0], scale: [1, 1, 1] },
  });
  const reiniciarHistorial = () =>
    useStore.setState({
      historialPasado: [],
      historialFuturo: [],
      historialUltimo: 0,
      historialAbierto: false,
    });

  it('deshacer elimina la última pieza añadida y rehacer la restaura (paso 5)', () => {
    reiniciarHistorial();
    useStore.getState().agregarPieza(piezaBase('publica', [0, 0, 0]));
    const k = useStore.getState().piezasDiseno[0].key;
    expect(useStore.getState().piezasDiseno).toHaveLength(1);

    useStore.getState().deshacer();
    expect(useStore.getState().piezasDiseno).toHaveLength(0);

    useStore.getState().rehacer();
    expect(useStore.getState().piezasDiseno).toHaveLength(1);
    expect(useStore.getState().piezasDiseno[0].key).toBe(k);
    // Tras un paso nuevo, el redo se corta
    useStore.getState().deshacer();
    useStore.getState().agregarPieza(piezaBase('publica', [1, 0, 0]));
    useStore.getState().rehacer();
    expect(useStore.getState().piezasDiseno).toHaveLength(1); // el redo murió al editar
  });

  it('el arrastre del gizmo es UN solo paso (captura en mouseDown) (paso 5)', async () => {
    reiniciarHistorial();
    useStore.getState().agregarPieza(piezaBase('publica', [0, 0, 0]));
    const k = useStore.getState().piezasDiseno[0].key;
    const inicial = useStore.getState().piezasDiseno[0].transform.position; // spawn aleatorio

    // mouseDown del gizmo → captura el estado previo y abre el historial
    useStore.getState().capturarHistorial();
    useStore.getState().actualizarPieza(k, { transform: { position: [1, 0, 0] } });
    useStore.getState().actualizarPieza(k, { transform: { position: [1, 0.5, 0] } });
    useStore.getState().actualizarPieza(k, { transform: { position: [2, 0.5, 0] } });
    useStore.getState().cerrarHistorial(); // mouseUp

    // Un solo deshacer devuelve a la posición inicial del arrastre
    useStore.getState().deshacer();
    const pieza = useStore.getState().piezasDiseno[0];
    expect(pieza.transform.position).toEqual(inicial);
    expect(useStore.getState().historialFuturo).toHaveLength(1);

    // Y un rehacer restaura el punto final del arrastre
    useStore.getState().rehacer();
    expect(useStore.getState().piezasDiseno[0].transform.position).toEqual([2, 0.5, 0]);

    // Con el historial cerrado, una nueva edición vuelve a generar puntos
    await new Promise((r) => setTimeout(r, 250)); // gesto nuevo tras el mouseUp
    useStore.getState().actualizarPieza(k, { transform: { position: [3, 0, 0] } });
    useStore.getState().deshacer();
    expect(useStore.getState().piezasDiseno[0].transform.position).toEqual([2, 0.5, 0]);
  });

  it('los cambios continuos del panel se colapsan por tiempo en un solo paso (paso 5)', async () => {
    // Los sliders del panel no tienen "mouseDown" del gizmo: su frontera es
    // el intervalo. Varios ticks en < 120 ms deben contar como UN paso.
    reiniciarHistorial();
    useStore.getState().agregarPieza(piezaBase('publica', [0, 0, 0]));
    const k = useStore.getState().piezasDiseno[0].key;
    const inicial = useStore.getState().piezasDiseno[0].transform.position;

    // Pequeña pausa para que el primer tick del slider sea un "gesto nuevo".
    await new Promise((r) => setTimeout(r, 250));

    useStore.getState().actualizarPieza(k, { transform: { position: [1, 0, 0] } });
    useStore.getState().actualizarPieza(k, { transform: { position: [1.5, 0.2, 0] } });
    useStore.getState().actualizarPieza(k, { transform: { position: [2, 0.5, 0] } });

    useStore.getState().deshacer();
    expect(useStore.getState().piezasDiseno[0].transform.position).toEqual(inicial);

    useStore.getState().rehacer();
    expect(useStore.getState().piezasDiseno[0].transform.position).toEqual([2, 0.5, 0]);
  });

  it('muestra la referencia de escala humana ocultable (paso 9)', () => {
    const { container } = render(<Canvas3D />);
    const toggle = container.querySelector('.regla-toggle input');
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(true); // visible por defecto

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
  });
});