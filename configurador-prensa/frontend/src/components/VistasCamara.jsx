// ============================================================
// src/components/VistasCamara.jsx — barra de vistas de cámara (paso 7)
//
// Botones flotantes sobre el canvas. Al pulsarlos se mueve la cámara a
// una vista estándar (isométrica, alzados y planta), centrada en el
// centro de masas de las piezas colocadas.
// ============================================================

import { aplicarVista } from './registroVistas';

const VISTAS = [
  { codigo: 'iso', etiqueta: 'Iso' },
  { codigo: 'frente', etiqueta: 'Frente' },
  { codigo: 'atras', etiqueta: 'Atrás' },
  { codigo: 'izquierda', etiqueta: 'Izq.' },
  { codigo: 'derecha', etiqueta: 'Der.' },
  { codigo: 'arriba', etiqueta: 'Arriba' },
];

export default function VistasCamara() {
  return (
    <div className="vistas-camara" aria-label="Vistas de cámara">
      {VISTAS.map((v) => (
        <button
          key={v.codigo}
          type="button"
          className="btn"
          title={`Ver ${v.etiqueta.toLowerCase()}`}
          onClick={() => aplicarVista(v.codigo)}
        >
          {v.etiqueta}
        </button>
      ))}
    </div>
  );
}