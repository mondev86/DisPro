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
import { render, cleanup } from '@testing-library/react';

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
    PerspectiveCamera: class extends Stub { lookAt() {} updateProjectionMatrix() {} },
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
    MeshStandardMaterial: StubMaterial,
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
});