// ============================================================
// src/__tests__/Plantillas.smoke.test.jsx — plantillas base (paso 8)
//
// Verifica:
//   1. la definición de plantillas (existe al menos una)
//   2. `cargarPlantilla` resuelve por nombre contra el catálogo, crea
//      instancias únicas, selecciona la primera y registra historial
//   3. las piezas sin ficha en el catálogo se ignoran
//   4. el selector renderiza las opciones y carga al elegir (con confirm)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { PLANTILLAS } from '../plantillas';
import { useStore } from '../store/useStore';
import SelectorPlantillas from '../components/SelectorPlantillas.jsx';

const FICHA = (id, nombre) => ({
  id,
  name: nombre,
  geometry: { tipo: 'box', color: '#4c6ef5', size: [0.04, 0.04, 3] },
});

describe('Plantillas base (paso 8)', () => {
  beforeEach(() => {
    cleanup();
    useStore.setState({
      piezasDiseno: [],
      seleccion: null,
      historialPasado: [],
      historialFuturo: [],
      historialUltimo: 0,
      historialAbierto: false,
    });
  });

  it('existen plantillas definidas con slugs únicos', () => {
    expect(PLANTILLAS.length).toBeGreaterThan(0);
    const slugs = new Set(PLANTILLAS.map((t) => t.slug));
    expect(slugs.size).toBe(PLANTILLAS.length);
  });

  it('cargarPlantilla crea las piezas por nombre y selecciona la primera', () => {
    // Catálogo con UNA ficha repetida (Tubo 60): en la plantilla prensa_clasica
    // hay 8 entradas con ese nombre; el resto (chipas, guías…) no tiene ficha
    // y se ignora.
    useStore.setState({ catalogo: [FICHA('id-1', 'Tubo cuadrado 60x60x3 (3 m)')] });
    const p1 = PLANTILLAS.find((t) => t.slug === 'prensa_clasica');

    useStore.getState().cargarPlantilla(p1);
    const estado = useStore.getState();
    expect(estado.piezasDiseno).toHaveLength(8);
    expect(estado.piezasDiseno[0].pieceId).toBe('id-1');
    expect(estado.piezasDiseno[0].nombre).toBe('Tubo cuadrado 60x60x3 (3 m)');
    expect(estado.seleccion).toBe(estado.piezasDiseno[0].key);
    expect(estado.piezasDiseno[0].transform.position).toEqual([0.36, 1.4, -0.5]);

    // Registra historial → deshacer deja el diseño vacío
    useStore.getState().deshacer();
    expect(useStore.getState().piezasDiseno).toHaveLength(0);
  });

  it('cargarPlantilla con catálogo vacío es un no-op', () => {
    useStore.setState({ catalogo: [] });
    useStore.getState().cargarPlantilla(PLANTILLAS[0]);
    expect(useStore.getState().piezasDiseno).toHaveLength(0);
  });

  it('el selector renderiza las opciones y carga al elegir', () => {
    useStore.setState({ catalogo: [FICHA('id-1', 'Tubo cuadrado 60x60x3 (3 m)')] });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SelectorPlantillas />);

    const select = screen.getByRole('combobox');
    expect(select.querySelectorAll('option').length).toBe(PLANTILLAS.length + 1); // + "Elegir…"

    fireEvent.change(select, { target: { value: 'prensa_clasica' } });
    expect(useStore.getState().piezasDiseno.length).toBeGreaterThan(0);
    confirmSpy.mockRestore();
  });

  it('el selector pide confirmación si ya hay piezas', () => {
    useStore.setState({
      catalogo: [FICHA('id-1', 'Tubo cuadrado 60x60x3 (3 m)')],
      piezasDiseno: [FICHA('x', 'cualquiera')],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SelectorPlantillas />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'prensa_clasica' } });
    expect(confirmSpy).toHaveBeenCalled();
    expect(useStore.getState().piezasDiseno).toHaveLength(1); // no se reemplazó
    confirmSpy.mockRestore();
  });
});