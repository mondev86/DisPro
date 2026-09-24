// ============================================================
// src/components/Outliner.jsx — árbol de piezas colocadas (paso 3)
//
// Muestra el diseño como un "outliner" (lista jerárquica agrupada por
// categoría), igual que el panel de capas de Blender/Illustrator:
//
//   Diseño
//   ├─ Tubos estructurales (3)
//   │    ● Tubo 30x30        (−0.5, 0.8, 0.2)
//   │    ● Tubo 30x30        ( 0.9, 1.0, −0.3)   ← seleccionada
//   ├─ Rodamientos (1)
//   │    ● Rodamiento 6204   ( 0.0, 0.9, 0.0)
//
// Utilidades:
//   - Hacer clic en una fila → se selecciona en el canvas (mismo store
//     `seleccion` que PanelParametros y el gizmo, así que todos se
//     sincronizan).
//   - Agrupar por categoría viene del catálogo (piezaId → categories);
//     si la pieza llegó por WebSocket y el catálogo aún no la tiene,
//     cae en "Sin categoría" para no romper el árbol.
//   - Los <details> dejan plegar/desplegar cada categoría.
// ============================================================

import { useMemo } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Outliner() {
  // El outliner solo LEE el store (y selecciona); no modifica la geometría.
  const { piezasDiseno, catalogo, seleccion, seleccionarPieza, eliminarPieza } = useStore();

  // Categoría de una pieza colocada: se busca su ficha en el catálogo
  // por identificador de catálogo (pieceId). Fallback seguro.
  const categoriaDe = (pieza) => {
    const ficha = catalogo.find((c) => c.id === pieza.pieceId);
    return ficha?.category || 'Sin categoría';
  };

  // Agrupar manteniendo el orden de colocación (piezasDiseno se append)
  const grupos = useMemo(() => {
    const orden = [];
    const porCategoria = new Map();
    for (const pieza of piezasDiseno) {
      const categoria = categoriaDe(pieza);
      if (!porCategoria.has(categoria)) {
        porCategoria.set(categoria, []);
        orden.push(categoria);
      }
      porCategoria.get(categoria).push(pieza);
    }
    return orden.map((categoria) => ({
      categoria,
      piezas: porCategoria.get(categoria),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piezasDiseno, catalogo]);

  // Título de fila: nombre + ordinal dentro de su categoría (para
  // distinguir dos copias de la misma pieza del catálogo).
  const etiqueta = (pieza, indice, total) => {
    if (total === 1) return pieza.nombre;
    return `${pieza.nombre} #${indice + 1}`;
  };

  return (
    <section className="panel outliner custom-scrollbar" data-testid="outliner">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        <FolderOpen size={14} style={{ display: 'inline', color: 'var(--acento)', verticalAlign: 'middle' }} /> Diseño
      </h2>
      <p className="muted">
        {piezasDiseno.length} {piezasDiseno.length === 1 ? 'pieza colocada' : 'piezas colocadas'} · clic para
        seleccionar
      </p>

      {grupos.length === 0 ? (
        <p className="muted">Aún no hay piezas. Usa "Añadir" en el catálogo.</p>
      ) : (
        <div className="arbol">
          {grupos.map(({ categoria, piezas }) => (
            <details key={categoria} open>
              <summary>
                {categoria}
                <span className="badge-cat">{piezas.length}</span>
              </summary>
              <ul className="arbol-lista">
                {piezas.map((pieza, i) => (
                  <li key={pieza.key}>
                    <button
                      type="button"
                      className={`fila-pieza${pieza.key === seleccion ? ' activa' : ''}`}
                      onClick={() => seleccionarPieza(pieza.key)}
                      title={pieza.key}
                    >
                      <span
                        className="punto"
                        style={{ background: pieza.geometria?.color || '#888' }}
                      />
                      <span className="nombre">{etiqueta(pieza, i, piezas.length)}</span>
                      <span className="muted pos">
                        {pieza.transform.position
                          .map((v) => Number(v).toFixed(1))
                          .join(', ')}
                      </span>
                      {/* Borrado rápido de la pieza seleccionada/fila */}
                      <span
                        className="btn-papelera"
                        aria-label={`Eliminar ${pieza.nombre}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          eliminarPieza(pieza.key);
                        }}
                      >
                        <Trash2 size={13} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}