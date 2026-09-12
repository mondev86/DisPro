// ============================================================
// src/__tests__/Outliner.smoke.test.jsx — smoke test del outliner
//
// Verifica que el árbol:
//   1. agrupa las piezas por categoría del catálogo
//   2. muestra una fila por pieza colocada
//   3. un clic selecciona la pieza en el store (se sincroniza con
//      el canvas y el panel vía `seleccion`)
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';

import Outliner from '../components/Outliner.jsx';
import { useStore } from '../store/useStore.js';

const FICHA = (id, name) => ({ id: `${id}`, name, category: 'Tubos', priceEur: 4, weightKg: 2 });
const FICHA_RODAMIENTO = { id: 'rod01', name: 'Rodamiento 6204', category: 'Rodamientos', priceEur: 5, weightKg: 0.2 };

describe('Outliner (smoke test)', () => {
  beforeEach(() => {
    cleanup();
    useStore.setState({
      catalogo: [],
      piezasDiseno: [],
      seleccion: null,
    });
  });

  it('agrupa las piezas por categoría y muestra una fila por pieza', () => {
    useStore.setState({
      catalogo: [FICHA('tubo1', 'Tubo 30x30'), FICHA('tubo2', 'Tubo 40x40'), FICHA_RODAMIENTO],
      piezasDiseno: [
        {
          key: 'p-1',
          pieceId: 'tubo1',
          nombre: 'Tubo 30x30',
          geometria: { tipo: 'box', color: '#ccc', size: [0.03, 0.03, 1] },
          cantidad: 1,
          transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        },
        {
          key: 'p-2',
          pieceId: 'no-existe', // no está en el catálogo → "Sin categoría"
          nombre: 'Pieza remota',
          geometria: { tipo: 'box', color: '#888', size: [0.1, 0.1, 0.1] },
          cantidad: 1,
          transform: { position: [1, 1, 1], rotation: [0, 0, 0], scale: [1, 1, 1] },
        },
      ],
    });

    render(<Outliner />);

    // Categorías visibles (agrupación)
    expect(screen.getByText('Tubos')).toBeInTheDocument();
    expect(screen.getByText('Sin categoría')).toBeInTheDocument();

    // Filas de pieza
    const filas = within(screen.getByTestId('outliner')).getAllByRole('button');
    expect(filas).toHaveLength(2);
  });

  it('un clic en una fila selecciona la pieza en el store', () => {
    useStore.setState({
      piezasDiseno: [
        {
          key: 'p-1',
          pieceId: 'tubo1',
          nombre: 'Tubo 30x30',
          geometria: { tipo: 'box', color: '#ccc', size: [1, 1, 1] },
          cantidad: 1,
          transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        },
      ],
    });

    render(<Outliner />);

    fireEvent.click(screen.getByText('Tubo 30x30'));
    expect(useStore.getState().seleccion).toBe('p-1');
  });
});