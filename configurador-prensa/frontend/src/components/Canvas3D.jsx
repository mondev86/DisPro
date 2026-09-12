// ============================================================
// src/components/Canvas3D.jsx — render 3D con Three.js (imperativo)
//
// Muestra todas las piezas del diseño como mallas 3D sencillas
// (cubos y cilindros; suficientes para un prototipo funcional).
//
// Cómo funciona:
//   - Un <div ref> aloja el <canvas> que crea Three.js
//   - "escena" = luces + rejilla de suelo + las mallas de las piezas
//   - Suscribirse al store de Zustand: cada vez que cambian las piezas
//     o la selección, se re-renderizan las mallas
//   - Clic en una malla → selecciona la pieza (brillo de resaltado)
//   - GIZMO de transformación (TransformControls) enganchado a la
//     pieza seleccionada: se alterna el modo con las teclas
//       W → mover (translate) · E → girar (rotate) · R → escalar (scale)
//     Cada cambio del gizmo se escribe en el store (y se difunde por
//     WebSocket), de modo que PanelParametros.jsx lo refleja en tiempo
//     real; y en la otra dirección, si mueves los sliders del panel, el
//     store actualiza la malla y el gizmo la sigue.
//   - Clic en el vacío → deseleccionar. OrbitControls queda reservado
//     para rotar/panear/zoom en el vacío (y se pausa mientras arrastras
//     el gizmo).
//
// TODO(avanzado): sustituir cubos/cilindros por modelos GLTF reales
// TODO(avanzado): simulación de cargas visual (deformaciones, colores)
// ============================================================

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { useStore } from '../store/useStore';
import { emitirUpdatePiece } from '../socket';

// Nombre legible de cada modo del gizmo (para el badge de la esquina)
const NOMBRE_MODO = { translate: 'Mover', rotate: 'Girar', scale: 'Escalar' };

// ------------------------------------------------------------
// Utilidad: crea la geometría Three.js a partir del campo
// `geometry` de una pieza del catálogo:
//   { tipo:'box', size:[w,h,d] }        → BoxGeometry
//   { tipo:'cylinder', size:[r,h,seg] } → CylinderGeometry
// ------------------------------------------------------------
function crearGeometria(geometry) {
  if (!geometry) return new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const [a, b, c] = geometry.size || [0.1, 0.1, 0.1];
  if (geometry.tipo === 'cylinder') {
    // (radiusTop, radiusBottom, height, radialSegments)
    return new THREE.CylinderGeometry(a, a, b, Math.max(3, Math.round(c)));
  }
  return new THREE.BoxGeometry(a, b, c);
}

// Identificador estable de una geometría (para no recrearla en vano)
const claveGeometria = (geometry) =>
  `${geometry?.tipo}:${(geometry?.size || []).join(',')}`;

export default function Canvas3D() {
  // Contenedor donde Three.js insertará su <canvas>
  const contenedorRef = useRef(null);

  // Modo actual del gizmo para la UI (cambia con W/E/R). La instancia
  // "viva" de TransformControls vive dentro del useEffect; este estado
  // solo alimenta el badge de la esquina.
  const [modo, setModo] = useState('translate');

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return undefined;

    // ------------------------------------------------
    // 1. ESCENA + CÁMARA + RENDERIZADOR
    // ------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101018); // fondo oscuro tipo CAD

    const ancho = contenedor.clientWidth || 800;
    const alto = contenedor.clientHeight || 600;

    const camera = new THREE.PerspectiveCamera(60, ancho / alto, 0.1, 100);
    camera.position.set(4, 4, 6); // cámara en perspectiva agradable
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(ancho, alto);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; // sombras (más realismo)
    contenedor.appendChild(renderer.domElement);

    // ------------------------------------------------
    // 2. CONTROLES ORBITALES (rotar/zoom/panear con el ratón)
    // ------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // inercia suave
    controls.target.set(0, 1, 0);

    // ------------------------------------------------
    // 2b. GIZMO DE TRANSFORMACIÓN (transformación de la pieza activa)
    //     Sustituye al "arrastre libre": ahora el movimiento lo hace
    //     TransformControls con ejes de color y 3 modos (W/E/R).
    //     - Se engancha a la malla seleccionada (attach) y se suelta al
    //       deseleccionar (detach).
    //     - 'objectChange' salta en cada frame de arrastre: leemos la
    //       matriz resultante y la escribimos en el store → el panel de
    //       parámetros y los demás clientes se enteran al instante.
    //     - 'mouseDown'/'mouseUp' pausan OrbitControls mientras se
    //       arrastra el gizmo (para que la cámara no gire a la vez).
    // ------------------------------------------------
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate'); // modo inicial: mover (W)
    transformControls.enabled = false; // solo interactúa si hay selección
    scene.add(transformControls.getHelper()); // las manecillas del gizmo

    // Snapping (paso 2): las propiedades translationSnap / rotationSnap /
    // scaleSnap redondean el arrastre a los pasos configurados en el panel.
    // translationSnap es un ESCALAR (0.25 → se redondean X, Y y Z a 0.25);
    // rotationSnap va en radianes (∂ de los grados de la UI) y scaleSnap en
    // unidades de escala. Si "activo" es false, las fijamos a null → arrastre
    // totalmente libre.
    const aplicarSnapping = () => {
      const { snapping } = useStore.getState();
      if (snapping.activo) {
        transformControls.translationSnap = snapping.espaciado;
        transformControls.rotationSnap = (snapping.angulo * Math.PI) / 180; // grados → rad
        transformControls.scaleSnap = snapping.escala;
      } else {
        transformControls.translationSnap = null;
        transformControls.rotationSnap = null;
        transformControls.scaleSnap = null;
      }
    };
    aplicarSnapping();

    // Al terminar un arrastre del gizmo, los valores "vivos" de la malla
    // se copian al store y se difunden por WebSocket (socket.js hace
    // throttle del envío, así que arrastrar no satura la red).
    const sincronizarGizmo = () => {
      const objeto = transformControls.object;
      if (!objeto) return;
      const key = objeto.userData.key;
      const store = useStore.getState();
      const pieza = store.piezasDiseno.find((p) => p.key === key);
      if (!pieza) return;
      store.actualizarPieza(key, {
        transform: {
          position: [objeto.position.x, objeto.position.y, objeto.position.z],
          rotation: [objeto.rotation.x, objeto.rotation.y, objeto.rotation.z],
          scale: [objeto.scale.x, objeto.scale.y, objeto.scale.z],
        },
      });
      const piezaActual = useStore
        .getState()
        .piezasDiseno.find((p) => p.key === key);
      if (piezaActual) emitirUpdatePiece(useStore.getState().sessionId, piezaActual);
    };
    transformControls.addEventListener('objectChange', sincronizarGizmo);

    // Pausa/reanuda la cámara mientras se arrastra el gizmo
    const pausarCamara = () => {
      controls.enabled = false;
    };
    const reanudarCamara = () => {
      controls.enabled = true;
    };
    transformControls.addEventListener('mouseDown', pausarCamara);
    transformControls.addEventListener('mouseUp', reanudarCamara);

    // Cambio de modo del gizmo con el teclado (W/E/R)
    const MODOS_TECLA = { KeyW: 'translate', KeyE: 'rotate', KeyR: 'scale' };
    const alTecla = (evento) => {
      const nuevoModo = MODOS_TECLA[evento.code];
      if (!nuevoModo) return;
      // No robar las teclas mientras se teclea en un input/slider del panel
      const etiqueta = evento.target?.tagName;
      if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return;
      transformControls.setMode(nuevoModo);
      setModo(nuevoModo); // el badge de la esquina refleja el modo actual
    };
    window.addEventListener('keydown', alTecla);

    // ------------------------------------------------
    // 3. LUCES + REJILLA DEL SUELO
    // ------------------------------------------------
    scene.add(new THREE.AmbientLight(0xffffff, 0.6)); // luz ambiental suave

    const luzPrincipal = new THREE.DirectionalLight(0xffffff, 1.2);
    luzPrincipal.position.set(5, 10, 7);
    luzPrincipal.castShadow = true;
    scene.add(luzPrincipal);

    const suelo = new THREE.GridHelper(8, 16, 0x8a8a8a, 0x3a3a3a);
    scene.add(suelo);

    // ------------------------------------------------
    // 4. RAYCASTER (selección por clic)
    // ------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // Malla por cada pieza colocada: map key-de-pieza → Mesh
    const mallas = new Map();

    // ------------------------------------------------
    // 5. SINCERIZADO: crea/actualiza/elimina las mallas 3D
    //    según el contenido actual del store.
    // ------------------------------------------------
    const dibujarMallas = () => {
      const { piezasDiseno: piezas, seleccion } = useStore.getState();
      const presentes = new Set(piezas.map((p) => p.key));

      // (a) Eliminar mallas de piezas ya retiradas del diseño
      for (const [key, mesh] of mallas) {
        if (!presentes.has(key)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mallas.delete(key);
        }
      }

      // (b) Crear / actualizar mallas presentes
      for (const pieza of piezas) {
        // Identificador de la forma real (re-crear la geometría solo si cambia)
        const kGeo = claveGeometria(pieza.geometria);
        let mesh = mallas.get(pieza.key);
        if (!mesh) {
          // Material estándar metálico
          const material = new THREE.MeshStandardMaterial({
            roughness: 0.55,
            metalness: 0.35,
          });
          mesh = new THREE.Mesh(crearGeometria(pieza.geometria), material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.key = pieza.key; // para identificar el clic
          mesh.userData.geoKey = kGeo;
          mallas.set(pieza.key, mesh);
          scene.add(mesh);
        } else if (mesh.userData.geoKey !== kGeo) {
          mesh.geometry?.dispose();
          mesh.geometry = crearGeometria(pieza.geometria);
          mesh.userData.geoKey = kGeo;
        }

        // Aplicar transformación (posición / rotación / escala). Estos
        // valores llegan del store: los escribe PanelParametros (sliders)
        // o el propio gizmo (sincronizarGizmo). Así ambos sentidos
        // convergen en el mismo objeto de estado.
        const t = pieza.transform || {};
        mesh.position.set(...(t.position || [0, 0, 0]));
        mesh.rotation.set(...(t.rotation || [0, 0, 0]));
        mesh.scale.set(...(t.scale || [1, 1, 1]));

        // Color según catálogo + resaltado de pieza seleccionada
        mesh.material.color.set(pieza.geometria?.color || '#888888');
        mesh.material.emissive.set(pieza.key === seleccion ? 0x224444 : 0x000000);
      }

      // (c) Enganchar / soltar el gizmo según la pieza seleccionada.
      //     El gizmo necesita una malla "real" de la escena (attach).
      const mallaSeleccionada = seleccion ? mallas.get(seleccion) : undefined;
      if (mallaSeleccionada && transformControls.object !== mallaSeleccionada) {
        transformControls.attach(mallaSeleccionada);
        transformControls.enabled = true;
      } else if (!mallaSeleccionada && transformControls.object) {
        transformControls.detach();
        transformControls.enabled = false;
      }
    };

    // Dibujo inicial
    dibujarMallas();

    // ------------------------------------------------
    // 6. SUSCRIPCIÓN AL STORE: redibuja al cambiar piezas/selección
    //   (zustand.subscribe recibe elapsed estado y el anterior)
    // ------------------------------------------------
    const unsubscribe = useStore.subscribe((estado, previo) => {
      if (estado.piezasDiseno !== previo.piezasDiseno || estado.seleccion !== previo.seleccion) {
        dibujarMallas();
      }
      if (estado.snapping !== previo.snapping) {
        aplicarSnapping();
      }
    });

    // ------------------------------------------------
    // 7. SELECCIÓN + ATAJOS DE TECLADO
    //    - Clic izquierdo sobre una pieza → seleccionarla
    //      (el MOVER/GIRAR/ESCALAR lo hace el gizmo, no el ratón libre)
    //    - Clic en el vacío → deseleccionar (y OrbitControls sigue
    //      funcionando en el vacío: rotar con izquierdo, panear con
    //      derecho, zoom con la rueda)
    //    - W/E/R → cambiar el modo del gizmo (ver 2b)
    //    - PanelParametros sigue disponible para ajuste fino numérico
    // ------------------------------------------------
    const UMBRAL_ARRASTRE = 5; // px a partir de los cuales NO es un clic
    const evitarMenu = (e) => e.preventDefault(); // clic derecho del canvas
    renderer.domElement.addEventListener('contextmenu', evitarMenu);

    let clicVacio = { x: 0, y: 0, activo: false }; // clic en el vacío (para deseleccionar)

    // Pieza bajo el puntero (o null). Normaliza coordenadas en `punto`.
    const piezaBajoPuntero = (evento, punto) => {
      const rect = renderer.domElement.getBoundingClientRect();
      punto.x = ((evento.clientX - rect.left) / rect.width) * 2 - 1;
      punto.y = -((evento.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(punto, camera);
      const blancos = raycaster.intersectObjects([...mallas.values()]);
      return blancos.length > 0 ? blancos[0].object.userData.key : null;
    };

    const alPulsar = (evento) => {
      // Solo el botón izquierdo selecciona (el derecho lo usa la cámara)
      if (evento.button !== 0) return;
      const key = piezaBajoPuntero(evento, pointer);
      if (!key) {
        clicVacio = { x: evento.clientX, y: evento.clientY, activo: true };
        return; // vacío → la cámara (OrbitControls) sigue funcionando
      }
      clicVacio = { activo: false };
      useStore.getState().seleccionarPieza(key);
    };

    const alMover = (evento) => {
      // Mientras el gizmo arrastra, no reprogramar el cursor
      if (transformControls.dragging) return;
      const key = piezaBajoPuntero(evento, pointer);
      renderer.domElement.style.cursor = key ? 'grab' : 'default';
    };

    const alSoltar = (evento) => {
      if (clicVacio.activo) {
        const registro = clicVacio;
        if (
          Math.hypot(evento.clientX - registro.x, evento.clientY - registro.y) < UMBRAL_ARRASTRE
        ) {
          useStore.getState().deseleccionar(); // clic en el vacío → nada seleccionado
        }
      }
      clicVacio = { activo: false };
    };

    renderer.domElement.addEventListener('pointerdown', alPulsar);
    renderer.domElement.addEventListener('pointermove', alMover);
    renderer.domElement.addEventListener('pointerup', alSoltar);
    // Si el puntero "se escapa" de la ventana durante un arrastre, cancelamos
    window.addEventListener('pointerup', alSoltar);

    // ------------------------------------------------
    // 8. REDIMENSIONADO (ventana flexible)
    // ------------------------------------------------
    const alRedimensionar = () => {
      const w = contenedor.clientWidth || ancho;
      const h = contenedor.clientHeight || alto;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', alRedimensionar);

    // ------------------------------------------------
    // 9. BUCLE DE ANIMACIÓN (re-pintar cada frame)
    // ------------------------------------------------
    let frameId;
    const animar = () => {
      frameId = requestAnimationFrame(animar);
      controls.update(); // suaviza los controles orbitales
      renderer.render(scene, camera);
    };
    animar();

    // ------------------------------------------------
    // 10. LIMPIEZA al desmontar el componente
    // ------------------------------------------------
    return () => {
      unsubscribe();
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('keydown', alTecla);
      transformControls.removeEventListener('objectChange', sincronizarGizmo);
      transformControls.removeEventListener('mouseDown', pausarCamara);
      transformControls.removeEventListener('mouseUp', reanudarCamara);
      renderer.domElement.removeEventListener('contextmenu', evitarMenu);
      renderer.domElement.removeEventListener('pointerdown', alPulsar);
      renderer.domElement.removeEventListener('pointermove', alMover);
      renderer.domElement.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointerup', alSoltar);
      cancelAnimationFrame(frameId);
      controls.dispose();
      scene.remove(transformControls.getHelper());
      transformControls.dispose();
      for (const mesh of mallas.values()) mesh.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === contenedor) {
        contenedor.removeChild(renderer.domElement);
      }
    };
    // El array vacío = el efecto se ejecuta SOLO al montar (y limpia al desmontar).
    // La suscripción al store es la que mantiene el 3D actualizado.
  }, []);

  return (
    <div
      ref={contenedorRef}
      data-testid="canvas3d"
      className="canvas3d"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Badge informativo del gizmo (no bloquea el puntero) */}
      <div className="gizmo-hint">
        Gizmo: <strong>{NOMBRE_MODO[modo]}</strong> · W mover · E girar · R
        escalar
      </div>
    </div>
  );
}