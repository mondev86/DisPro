// ============================================================
// src/App.jsx — estructura general (navegación + páginas + telemetría)
//
// Enrutado con react-router:
//   /         → Configurador 3D (catálogo + canvas + parámetros)
//   /designs  → Diseños & BOM
//   /mejoras  → Mejoras del Proyecto
//
// Cabecera tipo "cockpit": tabs, medidores en vivo (masa total, BOM,
// centro de masas), botones Deshacer/Rehacer y usuario (opcional).
// ============================================================

import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { Scale, Coins, Boxes, Undo2, Redo2, Dumbbell, Save } from 'lucide-react';

import Catalogo from './components/Catalogo.jsx';
import Canvas3D from './components/Canvas3D.jsx';
import Outliner from './components/Outliner.jsx';
import PanelParametros from './components/PanelParametros.jsx';
import VistasCamara from './components/VistasCamara.jsx';
import SelectorPlantillas from './components/SelectorPlantillas.jsx';
import Disenos from './pages/Disenos.jsx';
import Mejoras from './pages/Mejoras.jsx';

import { useStore } from './store/useStore';
import { useToasts, notificar } from './toast';
import { guardarDiseno, iniciarSesion, registrar } from './api';
import { sincronizarDiseno } from './socket';

// ------------------------------------------------------------
// Telemetría en vivo: masa total (kg), BOM (€) y centro de masas
// ------------------------------------------------------------
function useTelemetria() {
  const piezasDiseno = useStore((s) => s.piezasDiseno);
  const catalogo = useStore((s) => s.catalogo);

  const ficha2 = new Map(catalogo.map((c) => [c.id, c]));

  let masa = 0;
  let bom = 0;
  let pesoTot = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;

  for (const p of piezasDiseno) {
    const ficha = ficha2.get(p.pieceId);
    const peso = (ficha?.weightKg ?? 0) * (p.cantidad || 1);
    const coste = (ficha?.priceEur ?? 0) * (p.cantidad || 1);
    const pos = p.transform?.position || [0, 0, 0];
    masa += peso;
    bom += coste;
    pesoTot += peso || 1; // sin ficha → peso neutro para no dividir por cero
    cx += pos[0] * (peso || 1);
    cy += pos[1] * (peso || 1);
    cz += pos[2] * (peso || 1);
  }

  const n = piezasDiseno.length;
  const cog = n === 0
    ? [0, 0, 0]
    : [cx / pesoTot, cy / pesoTot, cz / pesoTot].map((v) => Number(v.toFixed(2)));

  return { masa, bom, cog, nPiezas: n };
}

function Metrica({ icono, color, etiqueta, valor }) {
  return (
    <span className="metrica" title={etiqueta}>
      {icono}
      <span className="valor" style={{ color }}>
        {valor}
      </span>
    </span>
  );
}

// ------------------------------------------------------------
// Página INICIO: el configurador completo en 3 columnas
// ------------------------------------------------------------
function Configurador() {
  const {
    sessionId,
    nombreDiseno,
    piezasDiseno,
    setNombreDiseno,
  } = useStore();

  // Activar la colaboración WebSocket al montar (y desconectar al salir)
  useEffect(() => {
    const limpiar = sincronizarDiseno(sessionId);
    return limpiar; // desconecta al desmontar la página
  }, [sessionId]);

  const guardar = async () => {
    // Convertir el estado 3D a la forma que espera la API
    const cuerpo = {
      sessionId,
      name: nombreDiseno,
      pieces: piezasDiseno.map((p) => ({
        pieceId: p.pieceId,
        cantidad: p.cantidad,
        transform: p.transform,
      })),
    };
    try {
      await guardarDiseno(cuerpo);
      notificar('Diseño guardado. Revisa la pestaña "Diseños & BOM".');
    } catch (err) {
      notificar(`Error al guardar: ${err.message}`, 'error');
    }
  };

  return (
    <div className="layout-configurador">
      {/* Columna izquierda: catálogo */}
      <Catalogo />

      {/* Columna 2: árbol de piezas colocadas (outliner, paso 3) */}
      <Outliner />

      {/* Columna central: canvas 3D */}
      <section className="canvas-wrap">
        <div className="barra-canvas">
          <SelectorPlantillas />
          <input
            className="input-nombre"
            value={nombreDiseno}
            onChange={(e) => setNombreDiseno(e.target.value)}
            placeholder="Nombre del diseño..."
          />
          <button className="btn primary" onClick={guardar}>
            <Save size={15} /> Guardar diseño
          </button>
        </div>
        <Canvas3D />
        {/* Vistas de cámara (paso 7): barra flotante sobre el canvas */}
        <VistasCamara />
      </section>

      {/* Columna derecha: parámetros de la pieza seleccionada */}
      <PanelParametros />
    </div>
  );
}

// ------------------------------------------------------------
// Formulario de login/registro comprimido (header dropdown)
// ------------------------------------------------------------
function AuthMini() {
  const [modo, setModo] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [mensaje, setMensaje] = useState('');
  const { setUsuario, usuario } = useStore();

  const enviar = async (e) => {
    e.preventDefault();
    try {
      const datos = modo === 'login' ? await iniciarSesion({ email, password: pass }) : await registrar({ email, password: pass });
      localStorage.setItem('prensa_token', datos.token); // guardar JWT
      setUsuario(datos.user);
      setMensaje('Sesión iniciada.');
    } catch (err) {
      setMensaje(err.message);
    }
  };

  const salir = () => {
    localStorage.removeItem('prensa_token');
    setUsuario(null);
    setMensaje('Sesión cerrada.');
  };

  if (usuario) {
    return (
      <div className="auth">
        <span className="muted">👤 {usuario.email}</span>
        <button className="btn ghost" onClick={salir}>Salir</button>
      </div>
    );
  }

  return (
    <form className="auth" onSubmit={enviar}>
      <select value={modo} onChange={(e) => setModo(e.target.value)}>
        <option value="login">Login</option>
        <option value="register">Registro</option>
      </select>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        type="password"
        placeholder="contraseña"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />
      <button className="btn">Entrar</button>
      {mensaje && <small className="muted">{mensaje}</small>}
    </form>
  );
}

// ------------------------------------------------------------
// App principal
// ------------------------------------------------------------
export default function App() {
  const { deshacer, rehacer } = useStore();
  const pesoHistorial = useStore((s) => s.historialPasado.length);
  const pesoFuturo = useStore((s) => s.historialFuturo.length);
  const { masa, bom, cog } = useTelemetria();
  const { lista: toasts, quitar } = useToasts();

  return (
    <div className="app">
      {/* Cabecera común */}
      <header className="cabecera">
        <h1 className="logo"><Dumbbell size={18} style={{ color: 'var(--acento)' }} /> DisPro · Cockpit 3D</h1>
        <nav>
          <NavLink to="/" className={(x) => (x.isActive ? 'activo' : '')}>Configurador 3D</NavLink>
          <NavLink to="/designs" className={(x) => (x.isActive ? 'activo' : '')}>Diseños &amp; BOM</NavLink>
          <NavLink to="/mejoras" className={(x) => (x.isActive ? 'activo' : '')}>Mejoras del Proyecto</NavLink>
        </nav>

        {/* Telemetría en vivo (README-MEJORAS) */}
        <div className="telemetria">
          <Metrica icono={<Scale size={14} style={{ color: 'var(--masa)' }} />} etiqueta="Masa total del diseño"
            color="var(--masa)" valor={`${masa.toFixed(2)} kg`} />
          <Metrica icono={<Coins size={14} style={{ color: 'var(--bom)' }} />} etiqueta="Presupuesto estimado del BOM"
            color="var(--bom)" valor={`${bom.toFixed(2)} €`} />
          <Metrica icono={<Boxes size={14} style={{ color: 'var(--cog)' }} />} etiqueta="Centro de masas [X, Y, Z]"
            color="var(--cog)" valor={`CoG [${cog.join(', ')}]`} />
          <button className="btn btn-undo" disabled={pesoHistorial === 0} onClick={deshacer} title="Deshacer (Ctrl+Z)">
            <Undo2 size={14} />
          </button>
          <button className="btn btn-undo" disabled={pesoFuturo === 0} onClick={rehacer} title="Rehacer (Ctrl+Y / Ctrl+Shift+Z)">
            <Redo2 size={14} />
          </button>
        </div>

        <AuthMini />
      </header>

      {/* Rutas de las páginas */}
      <Routes>
        <Route path="/" element={<Configurador />} />
        <Route path="/designs" element={<Disenos />} />
        <Route path="/mejoras" element={<Mejoras />} />
        <Route path="*" element={<div className="panel"><p>404 — Ruta no encontrada</p></div>} />
      </Routes>

      {/* Pila de notificaciones toast */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`} onClick={() => quitar(t.id)}>
            {t.mensaje}
          </div>
        ))}
      </div>
    </div>
  );
}