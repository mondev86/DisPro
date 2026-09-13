// ============================================================
// src/__tests__/VistasCamara.smoke.test.jsx — smoke test de vistas (paso 7)
//
// VistasCamara es un desacople total: solo importa `registroVistas`
// (nada de three). Verificamos:
//   1. se renderizan los 6 botones de vista
//   2. un clic publica el código de vista en el registro
//   3. el registro permite darse de baja (Canvas3D lo hace al desmontar)
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import VistasCamara from '../components/VistasCamara.jsx';
import { aplicarVista, registrarAplicadorVista } from '../components/registroVistas';

describe('VistasCamara (paso 7)', () => {
  it('renderiza un botón por vista estándar', () => {
    cleanup();
    render(<VistasCamara />);
    const botones = screen.getAllByRole('button');
    expect(botones.length).toBe(6);
  });

  it('un clic publica el código de la vista en el registro', () => {
    cleanup();
    const spy = vi.fn();
    const quitar = registrarAplicadorVista(spy);
    render(<VistasCamara />);

    fireEvent.click(screen.getByText('Frente'));
    expect(spy).toHaveBeenCalledWith('frente');

    fireEvent.click(screen.getByText('Arriba'));
    expect(spy).toHaveBeenCalledWith('arriba');

    quitar(); // sin appliers → un clic posterior no lanza nada
    spy.mockClear();
    fireEvent.click(screen.getByText('Arriba'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('aplicarVista con un código desconocido no rompe', () => {
    expect(() => aplicarVista('no-existe')).not.toThrow();
  });
});