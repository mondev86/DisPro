// ============================================================
// src/components/Catalogo.jsx — tarjetas de piezas disponibles
//
// - Filtro interactivo por texto (nombre o material), en vivo.
// - Filtros por categoría funcional: Estructurales, Mecanismos,
//   Ergonomía, Sujeción (mapeo de las categorías del catálogo).
// - Botón directo "+" en cada tarjeta para instanciar la pieza.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { getPiezas } from '../api';
import { useStore } from '../store/useStore';
import { emitirUpdatePiece } from '../socket';

// Categorías funcionales de la UI → categorías internas del catálogo
const FILTROS_CATEGORIA = [
  { id: 'todos', nombre: 'Todos', incluye: null },
  { id: 'estructurales', nombre: 'Estructurales', incluye: ['tubo', 'chapa'] },
  { id: 'mecanismos', nombre: 'Mecanismos', incluye: ['eje', 'rodamiento', 'polea', 'cable', 'guia'] },
  { id: 'ergonomia', nombre: 'Ergonomía', incluye: ['asiento'] },
  { id: 'sujecion', nombre: 'Sujeción', incluye: ['herraje'] },
];

export default function Catalogo() {
  // Estado local del catálogo (en conjunto con el store)
  const { catalogo, setCatalogo, agregarPieza, sessionId } = useStore();
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('todos');

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

  // 3. Filtros combinados (texto + categoría funcional), en vivo
  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase();
    const filtroCategoria = FILTROS_CATEGORIA.find((f) => f.id === categoria);
    return catalogo.filter((pieza) => {
      if (q && !`${pieza.name} ${pieza.material ?? ''}`.toLowerCase().includes(q)) return false;
      if (filtroCategoria?.incluye && !filtroCategoria.incluye.includes(pieza.category)) return false;
      return true;
    });
  }, [catalogo, texto, categoria]);

  // Mini-previo 3D: dibujamos la silueta como un cuadradito/círculo CSS
  const vistaPrevia = (geometry) => {
    if (geometry?.tipo === 'cylinder') return {};
    return { borderRadius: '4px' };
  };

  return (
    <aside className="panel catalogo custom-scrollbar">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Catálogo de piezas</h2>

      {/* Búsqueda en vivo */}
      <div className="relative mt-2">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="filtro-texto pl-8"
          placeholder="Buscar por nombre o material…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>

      {/* Filtros por categoría funcional */}
      <div className="chips-categoria">
        {FILTROS_CATEGORIA.map((f) => (
          <button
            key={f.id}
            className={`chip${categoria === f.id ? ' activo' : ''}`}
            onClick={() => setCategoria(f.id)}
          >
            {f.nombre}
          </button>
        ))}
      </div>

      <p className="muted">Toca el <Plus size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> para colocar una pieza en el canvas.</p>

      <div className="grid-piezas">
        {visibles.length === 0 && <p className="muted">Sin resultados para el filtro actual.</p>}
        {visibles.map((pieza) => (
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
            <button
              className="btn ghost"
              onClick={() => anadir(pieza)}
              title="Añadir al canvas"
              style={{ padding: '6px 8px' }}
            >
              <Plus size={15} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}