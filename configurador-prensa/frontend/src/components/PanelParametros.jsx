// ============================================================
// src/components/PanelParametros.jsx — edición de la pieza seleccionada
//
// Muestra sliders y campos numéricos para la pieza que está
// seleccionada en el canvas (la que brilla). Cada cambio:
//   1. actualiza el store (local, instantáneo)
//   2. emite el evento 'updatePiece' por WebSocket (colaboración)
//
// Incluye el validador ERGONÓMICO (README-MEJORAS) para asientos y
// respaldos, y acciones rápidas con iconos (duplicar / reflejar).
// ============================================================

import { useStore } from '../store/useStore';
import { emitirUpdatePiece } from '../socket';
import { Copy, FlipHorizontal2, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

// Un "grupo" de 3 valores con étiquetas de eje (x, y, z)
const EJES = ['X', 'Y', 'Z'];

// ------------------------------------------------------------
// Validador ERGONÓMICO (README-MEJORAS):
// Para asientos/respaldo calcula la inclinación respecto a la
// vertical (rotación X en grados). 35°–50° → rango biomecánico OK;
// fuera → alerta ámbar.
// ------------------------------------------------------------
function Ergonomia({ pieza, catalogo }) {
  const ficha = catalogo.find((c) => c.id === pieza.pieceId);
  const esErgonomico =
    ficha?.category === 'asiento' ||
    /asiento|respaldo|almohad/i.test(pieza.nombre || '');
  if (!esErgonomico) return null;

  const grados = Math.abs(Math.round((pieza.transform.rotation[0] * 180) / Math.PI));
  const ok = grados >= 35 && grados <= 50;

  return (
    <div className={`ergonomia ${ok ? 'ok' : 'alerta'}`} data-testid="ergonomia">
      {ok ? (
        <CheckCircle2 size={18} style={{ color: 'var(--ok)' }} />
      ) : (
        <AlertTriangle size={18} style={{ color: 'var(--alerta)' }} />
      )}
      <div className="detalle">
        <span className="titulo">
          {ok ? 'Ergonomía válida' : 'Ajuste ergonómico'}
        </span>
        <span className="sub">
          Inclinación del respaldo: <strong>{grados}°</strong> · rango
          biomecánico recomendado: 35°–50°
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Subcomponente: campo numérico + slider para UN eje
// Permite arrastrar el slider o teclear un valor exacto.
// ------------------------------------------------------------
function ControlEje({ etiqueta, valor, rango, paso, alCambiar }) {
  return (
    <div className="control-eje">
      <label>
        <span className="eje">{etiqueta}</span>
        <input
          type="number"
          step={paso}
          value={Number(valor.toFixed(3))}
          onChange={(e) => alCambiar(Number(e.target.value))}
        />
      </label>
      <input
        type="range"
        min={rango[0]}
        max={rango[1]}
        step={paso}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Subcomponente: ajustes globales de snapping (paso 2 de la hoja de
// ruta). Los redondea TransformControls en el canvas; aquí solo se
// configuran los pasos. Se muestra SIEMPRE (con o sin pieza activa).
// ------------------------------------------------------------
function ConfigSnapping() {
  const snapping = useStore((s) => s.snapping);
  const setSnapping = useStore((s) => s.setSnapping);

  return (
    <fieldset className="snap-config">
      <legend>Ajustes de arrastre (snapping)</legend>
      <label className="snap-fila">
        <span>Activar al arrastrar</span>
        <input
          type="checkbox"
          checked={snapping.activo}
          onChange={(e) => setSnapping({ activo: e.target.checked })}
        />
      </label>
      <label className="snap-fila">
        <span>Espaciado mover (m)</span>
        <input
          type="number"
          min="0.05"
          step="0.05"
          value={snapping.espaciado}
          disabled={!snapping.activo}
          onChange={(e) => setSnapping({ espaciado: Math.max(0.05, Number(e.target.value)) })}
        />
      </label>
      <label className="snap-fila">
        <span>Ángulo girar (°)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={snapping.angulo}
          disabled={!snapping.activo}
          onChange={(e) => setSnapping({ angulo: Math.max(1, Number(e.target.value)) })}
        />
      </label>
      <label className="snap-fila">
        <span>Escala</span>
        <input
          type="number"
          min="0.05"
          step="0.05"
          value={snapping.escala}
          disabled={!snapping.activo}
          onChange={(e) => setSnapping({ escala: Math.max(0.05, Number(e.target.value)) })}
        />
      </label>
    </fieldset>
  );
}

// ------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------
export default function PanelParametros() {
  // Estado del store que nos interesa
  const { piezasDiseno, seleccion, catalogo, eliminarPieza, duplicarPieza, reflejarPieza, deseleccionar, sessionId } =
    useStore();

  // Pieza actualmente seleccionada (o null)
  const pieza = piezasDiseno.find((p) => p.key === seleccion) || null;

  // Si no hay selección, mostramos un aviso vacío
  if (!pieza) {
    return (
      <aside className="panel">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Parámetros</h2>
        <p className="muted">
          Haz clic sobre una pieza del canvas para editarla. Con el{' '}
          <strong>gizmo</strong> que aparece sobre la pieza seleccionada puedes{' '}
          <strong>moverla</strong> (W), <strong>girarla</strong> (E) o{' '}
          <strong>escalarla</strong> (R). También puedes ajustar los valores con
          precisión aquí abajo.
        </p>
        <ConfigSnapping />
      </aside>
    );
  }

  const t = pieza.transform;

  // Helper: aplica un cambio y lo difunde por WebSocket
  const aplicar = (delta) => {
    useStore.getState().actualizarPieza(pieza.key, delta);
    // Enviamos el estado completo de la pieza tras el cambio
    const piezaActualizada = useStore
      .getState()
      .piezasDiseno.find((p) => p.key === pieza.key);
    if (piezaActualizada) emitirUpdatePiece(sessionId, piezaActualizada);
  };

  // Cambiar UN componente de UN eje
  const editarEje = (campo, eje, valor) => {
    const nueva = [...t[campo]];
    nueva[eje] = valor;
    aplicar({ transform: { [campo]: nueva } });
  };

  return (
    <aside className="panel parametros custom-scrollbar">
      <div className="card-pieza seleccionada">
        <div
          className="silueta"
          style={{
            background: pieza.geometria?.color || '#888',
            borderRadius: pieza.geometria?.tipo === 'cylinder' ? '50%' : '4px',
          }}
        />
        <div className="card-info">
          <h3 style={{ margin: 0 }}>{pieza.nombre}</h3>
          <small className="muted">
            Cantidad: para el BOM
            <input
              type="number"
              min="1"
              value={pieza.cantidad}
              onChange={(e) => aplicar({ cantidad: Math.max(1, Number(e.target.value)) })}
            />
          </small>
        </div>
      </div>

      {/* Validador ergonómico (solo asientos/respaldos) */}
      <Ergonomia pieza={pieza} catalogo={catalogo} />

      <p className="muted" style={{ margin: 0 }}>
        Gizmo activo: <strong>W</strong> mover · <strong>E</strong> girar ·{' '}
        <strong>R</strong> escalar (en el canvas)
      </p>

      <fieldset>
        <legend>Posición (m)</legend>
        {EJES.map((eje, i) => (
          <ControlEje
            key={`pos-${eje}`}
            etiqueta={eje}
            valor={t.position[i]}
            rango={[-4, 4]}
            paso={0.05}
            alCambiar={(v) => editarEje('position', i, v)}
          />
        ))}
      </fieldset>

      <fieldset>
        <legend>Rotación (grados)</legend>
        {EJES.map((eje, i) => (
          <ControlEje
            key={`rot-${eje}`}
            etiqueta={eje}
            valor={(t.rotation[i] * 180) / Math.PI} // rad → grados para la UI
            rango={[-180, 180]}
            paso={1}
            alCambiar={(v) => editarEje('rotation', i, (v * Math.PI) / 180)}
          />
        ))}
      </fieldset>

      <fieldset>
        <legend>Escala</legend>
        {EJES.map((eje, i) => (
          <ControlEje
            key={`esc-${eje}`}
            etiqueta={eje}
            valor={t.scale[i]}
            rango={[0.1, 5]}
            paso={0.1}
            alCambiar={(v) => editarEje('scale', i, v)}
          />
        ))}
      </fieldset>

      {/* Acciones rápidas de la pieza (paso 6): duplicar y espejar en X */}
      <fieldset>
        <legend>Acciones</legend>
        <div className="botonera-pieza">
          <button className="btn" onClick={() => duplicarPieza(pieza.key)}>
            <Copy size={14} /> Duplicar (Ctrl+D)
          </button>
          <button className="btn" onClick={() => reflejarPieza(pieza.key)}>
            <FlipHorizontal2 size={14} /> Reflejar X
          </button>
        </div>
        <p className="muted" style={{ margin: '0.3rem 0 0' }}>
          Reflejar X es un espejo respecto al plano YZ (la pieza queda del
          otro lado del eje X). Aplicarlo dos veces la devuelve a su sitio.
        </p>
      </fieldset>

      <ConfigSnapping />

      <div className="acciones">
        <button
          className="btn danger"
          onClick={() => eliminarPieza(pieza.key)}
        >
          <Trash2 size={14} /> Eliminar pieza
        </button>
        <button className="btn ghost" onClick={deseleccionar}>
          Deseleccionar
        </button>
      </div>
    </aside>
  );
}