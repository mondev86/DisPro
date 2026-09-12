// ============================================================
// src/main.jsx — PUNTO DE ENTRADA del frontend
//
// Monta la aplicación React sobre el <div id="root"> del index.html
// y añade el enrutador (react-router) para las páginas de la SPA.
// Nota: no se importa React porque con el transform JSX de Vite
// no hace falta (solo ReactDOM).
// ============================================================

import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import './index.css'; // estilos globales de la app

// BrowserRouter habilita rutas limpias: / y /designs
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);