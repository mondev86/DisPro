// ============================================================
// src/App.jsx — estructura general (navegación + páginas)
//
// Enrutado con react-router:
//   /         → Configurador (catálogo + canvas 3D + parámetros)
//   /designs  → Lista de diseños guardados
//
// Cabecera común: nombre del proyecto, navegación, botón "Guardar",
// gestión de usuario (login/registro opcional) y contador de piezas.
// ============================================================

import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

import Catalogo from './components/Catalogo.jsx';
import Canvas3D from './components/Canvas3D.jsx';
import Outliner from './components/Outliner.jsx';
import PanelParametros from './components/PanelParametros.jsx';
import VistasCamara from './components/VistasCamara.jsx';
import SelectorPlantillas from './components/SelectorPlantillas.jsx';
import Disenos from './pages/Disenos.jsx';

import { useStore } from './store/useStore';
import { guardarDiseno, iniciarSesion, registrar } from './api';
import { sincronizarDiseno } from './socket';

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
      alert('✅ Diseño guardado. Revisa la pestaña "Diseños".');
    } catch (err) {
      alert(`❌ Error al guardar: ${err.message}`);
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
            💾 Guardar diseño
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
  return (
    <div className="app">
      {/* Cabecera común */}
      <header className="cabecera">
        <h1 className="logo">🏋️ DisPro · Configurador 3D</h1>
        <nav>
          <NavLink to="/" className={(x) => (x.isActive ? 'activo' : '')}>Configurador</NavLink>
          <NavLink to="/designs" className={(x) => (x.isActive ? 'activo' : '')}>Diseños</NavLink>
        </nav>
        <AuthMini />
      </header>

      {/* Rutas de las páginas */}
      <Routes>
        <Route path="/" element={<Configurador />} />
        <Route path="/designs" element={<Disenos />} />
        <Route path="*" element={<div className="panel"><p>404 — Ruta no encontrada</p></div>} />
      </Routes>
    </div>
  );
}