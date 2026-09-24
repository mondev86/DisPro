// ============================================================
// src/toast.js — mini-sistema de notificaciones toast
//
// Store global (Zustand) con un array de notificaciones. `notificar`
// inserta una y la elimina sola a los 3,5 s. App.jsx renderiza la
// pila `.toasts` en la esquina superior derecha.
// ============================================================

import { create } from 'zustand';

let contador = 0;

export const useToasts = create((set) => ({
  lista: [],
  notificar: (mensaje, tipo = 'ok') =>
    set((estado) => {
      const id = ++contador;
      setTimeout(() => {
        useToasts.setState((s) => ({ lista: s.lista.filter((n) => n.id !== id) }));
      }, 3500);
      return { lista: [...estado.lista, { id, mensaje, tipo }] };
    }),
  quitar: (id) => set((estado) => ({ lista: estado.lista.filter((n) => n.id !== id) })),
}));

export const notificar = (mensaje, tipo) => useToasts.getState().notificar(mensaje, tipo);