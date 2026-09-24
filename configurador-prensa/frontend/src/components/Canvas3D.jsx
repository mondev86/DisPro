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
import { registrarAplicadorVista } from './registroVistas';
import { Camera } from 'lucide-react';

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

// ------------------------------------------------------------
// Hit-box ampliado (paso 4): las piezas finas (tubos de 3cm,
// varillas...) son casi imposibles de pinchar con el ratón. Para
// cada pieza creamos una CAJA INVISIBLE que solo usa el raycaster,
// con un MÍNIMO de tamaño por eje. El aspecto visual no cambia.
// ------------------------------------------------------------
const HITBOX_MIN = 0.06; // mínimo clicable en cada eje (m)

// Tamaño en el mundo de la caja de colisión de una pieza:
//   box      → tamaño real del paralelepípedo (size)
//   cylinder → [diámetro, alto, diámetro] (size[0] es el radio)
// Se multiplica por la escala de la pieza y se garantiza HITBOX_MIN.
function tamanoHitBox(geometria, escala = [1, 1, 1]) {
  const size = geometria?.size || [0.1, 0.1, 0.1];
  const dims =
    geometria?.tipo === 'cylinder'
      ? [size[0] * 2, size[1] ?? 1, size[0] * 2]
      : [size[0] ?? 1, size[1] ?? 1, size[2] ?? 1];
  return dims.map((d, eje) => Math.max(d * (escala[eje] ?? 1), HITBOX_MIN));
}

export default function Canvas3D() {
  // Contenedor donde Three.js insertará su <canvas>
  const contenedorRef = useRef(null);

  // Modo actual del gizmo para la UI (cambia con W/E/R). La instancia
  // "viva" de TransformControls vive dentro del useEffect; este estado
  // solo alimenta el badge de la esquina.
  const [modo, setModo] = useState('translate');

  // Referencia de escala humana (paso 9): visible por defecto y ocultable
  const [reglaVisible, setReglaVisible] = useState(true);
  const reglaRef = useRef(null);

  // Captura de pantalla (paso moderno): la función se guarda aquí dentro
  // del efecto (necesita el renderer) y el botón del overlay la invoca.
  const capturaRef = useRef(null);

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
    // 2a. VISTAS DE CÁMARA (paso 7)
    //     La barra flotante sobre el canvas publica en `registroVistas`.
    //     Aquí movemos cámara + controles hacia una vista estándar,
    //     centrada en el centro de masas de las piezas colocadas.
    // ------------------------------------------------
    const DISTANCIA_VISTA = 8;
    const VISTAS = {
      iso: { vec: [4, 4, 6], up: [0, 1, 0] },
      frente: { vec: [0, 0, DISTANCIA_VISTA], up: [0, 1, 0] },
      atras: { vec: [0, 0, -DISTANCIA_VISTA], up: [0, 1, 0] },
      izquierda: { vec: [-DISTANCIA_VISTA, 0, 0], up: [0, 1, 0] },
      derecha: { vec: [DISTANCIA_VISTA, 0, 0], up: [0, 1, 0] },
      arriba: { vec: [0, DISTANCIA_VISTA, 0], up: [0, 0, -1] },
    };
    const centroPiezas = () => {
      const piezas = useStore.getState().piezasDiseno;
      if (piezas.length === 0) return { x: 0, y: 1, z: 0 }; // coincide con el lookAt inicial
      const n = piezas.length;
      const suma = piezas.reduce(
        (acc, p) => {
          acc.x += p.transform.position[0];
          acc.y += p.transform.position[1];
          acc.z += p.transform.position[2];
          return acc;
        },
        { x: 0, y: 0, z: 0 }
      );
      return { x: suma.x / n, y: suma.y / n, z: suma.z / n }; // centro de masas
    };
    const aplicarVista = (codigo) => {
      const vista = VISTAS[codigo];
      if (!vista) return;
      const c = centroPiezas();
      camera.up.set(...vista.up);
      camera.position.set(
        c.x + vista.vec[0],
        c.y + vista.vec[1],
        c.z + vista.vec[2]
      );
      controls.target.set(c.x, c.y, c.z);
      camera.lookAt(c.x, c.y, c.z);
      controls.update();
    };
    const quitarVista = registrarAplicadorVista(aplicarVista);

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

    // Pausa/reanuda la cámara mientras se arrastra el gizmo.
    // Paso 5: al EMPEZAR el arrastre se captura el punto de deshacer (estado
    // previo al gesto) y se "abre" el historial: los frames del arrastre no
    // generarán más puntos, así un drag completo = UN solo Ctrl+Z.
    // Al soltar (mouseUp) se cierra el historial.
    const pausarCamara = () => {
      controls.enabled = false;
      useStore.getState().capturarHistorial();
    };
    const reanudarCamara = () => {
      controls.enabled = true;
      useStore.getState().cerrarHistorial();
    };
    transformControls.addEventListener('mouseDown', pausarCamara);
    transformControls.addEventListener('mouseUp', reanudarCamara);

    // Cambio de modo del gizmo con el teclado (W/E/R)
    const MODOS_TECLA = { KeyW: 'translate', KeyE: 'rotate', KeyR: 'scale' };
    const alTecla = (evento) => {
      // No robar las teclas mientras se teclea en un input/slider del panel
      const etiqueta = evento.target?.tagName;
      if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return;

      // DESHACER / REHACER (paso 5): Ctrl+Z, Ctrl+Shift+Z y Ctrl+Y
      const conCtrl = evento.ctrlKey || evento.metaKey;
      if (conCtrl && evento.code === 'KeyZ') {
        evento.preventDefault(); // que no haga el undo nativo del navegador
        if (evento.shiftKey) useStore.getState().rehacer();
        else useStore.getState().deshacer();
        return;
      }
      if (conCtrl && evento.code === 'KeyY') {
        evento.preventDefault();
        useStore.getState().rehacer();
        return;
      }
      // DUPLICAR (paso 6): Ctrl+D — la acción ignora la selección vacía
      if (conCtrl && evento.code === 'KeyD') {
        evento.preventDefault(); // que no salga el diálogo "marcar" del navegador
        useStore.getState().duplicarPieza(useStore.getState().seleccion);
        return;
      }

      const nuevoModo = MODOS_TECLA[evento.code];
      if (!nuevoModo) return;
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
    // 3a. REFERENCIA DE ESCALA HUMANA (paso 9)
    //     Una figura de 1,70 m junto a la máquina para juzgar el tamaño
    //     real de las piezas. No es una pieza (no se selecciona), se
    //     puede ocultar con el botón del canvas y mira hacia el centro
    //     de la escena.
    // ------------------------------------------------
    const construirRegla = () => {
      const grupo = new THREE.Group();
      const matPiel = new THREE.MeshStandardMaterial({ color: 0xf1c9a5 });
      const matCamisa = new THREE.MeshStandardMaterial({ color: 0xfa5252 });
      const matPantalon = new THREE.MeshStandardMaterial({ color: 0x4263eb });
      const matZapato = new THREE.MeshStandardMaterial({ color: 0x343a40 });
      const parte = (geo, mat, x, y, z) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        grupo.add(m);
        return m;
      };

      // Piernas (pantalón) + zapatillas
      parte(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8), matPantalon, -0.07, 0.4, 0);
      parte(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8), matPantalon, 0.07, 0.4, 0);
      parte(new THREE.CylinderGeometry(0.05, 0.035, 0.08, 8), matZapato, -0.09, 0.04, 0.04);
      parte(new THREE.CylinderGeometry(0.05, 0.035, 0.08, 8), matZapato, 0.07, 0.04, 0.04);

      // Caderas + torso (camisa)
      parte(new THREE.BoxGeometry(0.2, 0.1, 0.12), matPantalon, 0, 0.86, 0);
      parte(new THREE.BoxGeometry(0.28, 0.52, 0.17), matCamisa, 0, 1.17, 0);

      // Brazos (camisa)
      parte(new THREE.CylinderGeometry(0.035, 0.03, 0.62, 8), matCamisa, -0.23, 1.14, 0);
      parte(new THREE.CylinderGeometry(0.035, 0.03, 0.62, 8), matCamisa, 0.23, 1.14, 0);

      // Cabeza (piel)
      parte(new THREE.SphereGeometry(0.1, 16, 12), matPiel, 0, 1.6, 0);

      // Colocación: al lado de la máquina, mirando hacia el origen.
      grupo.position.set(1.55, 0, 1.3);
      grupo.rotation.y = Math.atan2(-1.55, -1.3);
      grupo.visible = true; // el interruptor siguiente la oculta/muestra
      return grupo;
    };
    const regla = construirRegla();
    reglaRef.current = regla;
    scene.add(regla);

    // ------------------------------------------------
    // 3b. CENTRO DE MASAS + PROYECCIÓN AL SUELO (README-MEJORAS)
    //     Marcador ámbar en el CoG ponderado por peso de cada pieza,
    //     con una línea de proyección vertical hasta el suelo y un disco
    //     que marca el punto sobre el plano. Se actualiza en dibujarMallas.
    // ------------------------------------------------
    const materiaCog = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.35,
    });
    const esferaCog = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), materiaCog);
    const lineaCog = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), materiaCog);
    const discoCog = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 16), materiaCog);
    const grupoCog = new THREE.Group();
    grupoCog.add(esferaCog);
    grupoCog.add(lineaCog);
    grupoCog.add(discoCog);
    scene.add(grupoCog);
    grupoCog.visible = false; // sin piezas no hay centro de masas

    const actualizarCog = () => {
      const storeCog = useStore.getState();
      const catCog = new Map(storeCog.catalogo.map((c) => [c.id, c]));
      let masas = 0;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (const p of storeCog.piezasDiseno) {
        const peso = (catCog.get(p.pieceId)?.weightKg ?? 1) * (p.cantidad || 1);
        const [px, py, pz] = p.transform.position;
        masas += peso;
        sx += px * peso;
        sy += py * peso;
        sz += pz * peso;
      }
      grupoCog.visible = storeCog.piezasDiseno.length > 0 && masas > 0;
      if (!grupoCog.visible) return;
      const cog = { x: sx / masas, y: sy / masas, z: sz / masas };
      esferaCog.position.set(cog.x, cog.y, cog.z);
      const alto = Math.max(cog.y, 0.02); // no invertir la línea si baja del suelo
      lineaCog.scale.set(1, alto, 1);
      lineaCog.position.set(cog.x, alto / 2, cog.z);
      discoCog.position.set(cog.x, 0.006, cog.z);
    };

    // ------------------------------------------------
    // 4. RAYCASTER (selección por clic)
    // ------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // Malla por cada pieza colocada: map key-de-pieza → Mesh
    const mallas = new Map();

    // Hit-boxes (paso 4): un material invisible compartido + una caja por
    // pieza, SOLO para el raycast (jamás se renderiza). Así los tubos finos
    // se pinchan con facilidad (área ≥ HITBOX_MIN) y los grandes mantienen
    // su tamaño exacto.
    const materialColision = new THREE.MeshBasicMaterial({ visible: false });
    const colisionadores = new Map(); // key-de-pieza → Mesh invisible

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
          // Y su hit-box invisible
          const col = colisionadores.get(key);
          if (col) {
            scene.remove(col);
            col.geometry.dispose();
            colisionadores.delete(key);
          }
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

        // Hit-box invisible: misma transformación, tamaño ampliado a lo
        // mínimo clicable (las piezas grandes quedan con su tamaño justo)
        let colisionador = colisionadores.get(pieza.key);
        if (!colisionador) {
          colisionador = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materialColision);
          colisionador.visible = false; // solo para el raycaster
          colisionador.userData.key = pieza.key;
          colisionadores.set(pieza.key, colisionador);
          scene.add(colisionador);
        }
        colisionador.position.set(...(t.position || [0, 0, 0]));
        colisionador.rotation.set(...(t.rotation || [0, 0, 0]));
        colisionador.scale.set(...tamanoHitBox(pieza.geometria, t.scale || [1, 1, 1]));
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

      // (d) Centro de masas: se recalcula con cada cambio de piezas
      actualizarCog();
    };

    // Dibujo inicial
    dibujarMallas();

    // ------------------------------------------------
    // 3c. CAPTURA DE PANTALLA EN ALTA RESOLUCIÓN (render a PNG 2x)
    //     Sube temporalmente el buffer del canvas (sin tocar el CSS,
    //     updateStyle=false), renderiza y descarga. Luego restaura.
    // ------------------------------------------------
    const capturar = () => {
      const origen = renderer.domElement;
      const pr = renderer.getPixelRatio?.() || 1;
      const w = origen.clientWidth || origen.width;
      const h = origen.clientHeight || origen.height;
      renderer.setPixelRatio(pr * 2);
      renderer.setSize(w * 2, h * 2, false); // buffer 2x, CSS intacto
      renderer.render(scene, camera);
      const url = origen.toDataURL('image/png');
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      renderer.render(scene, camera);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'diseno-prensa.png';
      enlace.click();
    };
    capturaRef.current = capturar;

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
      // Intersectamos las HIT-BOXES (no las mallas visuales): así las piezas
      // pequeñas se pueden pinchar aunque su malla sea finísima.
      const blancos = raycaster.intersectObjects([...colisionadores.values()]);
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
      quitarVista(); // paso 7: des-registramos el aplicador de vistas
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
      for (const col of colisionadores.values()) col.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === contenedor) {
        contenedor.removeChild(renderer.domElement);
      }
    };
    // El array vacío = el efecto se ejecuta SOLO al montar (y limpia al desmontar).
    // La suscripción al store es la que mantiene el 3D actualizado.
  }, []);

  // El botón de la figura humana solo conmuta la visibilidad del grupo.
  // El grupo se crea una sola vez (en el efecto anterior); aquí NO se
  // recrea, para no perder materiales ni coste de render.
  useEffect(() => {
    if (reglaRef.current) reglaRef.current.visible = reglaVisible;
  }, [reglaVisible]);

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
      {/* Referencia de escala (paso 9): figura humana ocultable */}
      <label className="regla-toggle" title="Mostrar/ocultar la figura de 1,70 m">
        <input
          type="checkbox"
          checked={reglaVisible}
          onChange={(e) => setReglaVisible(e.target.checked)}
        />{' '}
        Regla de escala (1,70 m)
      </label>
      {/* Captura PNG en alta resolución (README-MEJORAS) */}
      <button
        className="btn-captura"
        onClick={() => capturaRef.current?.()}
        title="Descargar captura del canvas en alta resolución (PNG 2x)"
      >
        <Camera size={14} /> Capturar PNG
      </button>
    </div>
  );
}