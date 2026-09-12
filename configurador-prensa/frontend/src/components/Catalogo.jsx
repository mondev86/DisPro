// ============================================================
// src/components/Catalogo.jsx — tarjetas de piezas disponibles
//
// Carga el catálogo desde GET /api/pieces (en montaje) y muestra
// una tarjeta por pieza con su forma 3D previa y el botón "Añadir".
// Al añadir, se actualiza el store y (opcionalmente) se avisa a la
// sala de colaboración.
// ============================================================

import { useEffect } from 'react';
import { getPiezas } from '../api';
import { useStore } from '../store/useStore';
import { emitirUpdatePiece } from '../socket';

export default function Catalogo() {
  // Estado local del catálogo (en conjunto con el store)
  const { catalogo, setCatalogo, agregarPieza, sessionId } = useStore();

  // 1. Cargar catálogo al montar
  useEffect(() => {
    let activo = true; // evita setState tras desmontar el componente
    getPiezas()
      .then((piezas) => {
        if (activo) setCatalogo(piezas);
      })
      .catch((err) => console.error('No se pudo cargar el catálogo:', err.message));
    return () => {
      activo = false;
    };
  }, [setCatalogo]);

  // 2. Acción "Añadir": agrega la pieza y emite el cambio a la sala
  const anadir = (piezaCatalogo) => {
    agregarPieza(piezaCatalogo);
    // Tras agregar, la última pieza está en piezasDiseno (estado nuevo).
    // La leemos con useStore.getState() y broadcast a la sala.
    const nuevas = useStore.getState().piezasDiseno;
    const primeraNueva = nuevas[nuevas.length - 1];
    emitirUpdatePiece(sessionId, primeraNueva);
  };

  // Mini-previo 3D: dibujamos la silueta como un cuadradito/círculo CSS
  const vistaPrevia = (geometry) => {
    if (geometry?.tipo === 'cylinder') return {};
    return { borderRadius: '4px' };
  };

  return (
    <aside className="panel catalogo">
      <h2>Catálogo de piezas</h2>
      <p className="muted">Toca "Añadir" para colocar una pieza en el canvas.</p>

      <div className="grid-piezas">
        {catalogo.map((pieza) => (
          <div className="card-pieza" key={pieza.id}>
            {/* Silueta de color de la pieza */}
            <div
              className="silueta"
              style={{
                background: pieza.geometry?.color || '#666',
                ...vistaPrevia(pieza.geometry),
              }}
            />
            <div className="card-info">
              <strong>{pieza.name}</strong>
              <small className="muted">
                {pieza.category} · {pieza.priceEur} € · {pieza.weightKg} kg
              </small>
            </div>
            <button className="btn" onClick={() => anadir(pieza)}>
              Añadir
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}