// ============================================================
// vite.config.js — configuración de Vite (bundler + dev server)
//
// Lo más importante ES el bloque `server.proxy`: en desarrollo
// redirige las peticiones a /api y /socket.io hacia el backend
// (http://localhost:4000). Así el frontend puede usar rutas
// relativas ("/api/pieces") y no hace falta CORS en dev.
// ============================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Configuración usada también por Vitest (clave `test`)
export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5173, // puerto del dev server
    proxy: {
      // Peticiones REST → backend
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // WebSocket (Socket.io) → backend
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true, // habilita el upgrade a WebSocket en el proxy
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false, // desactiva sourcemaps en producción (más ligero)
    rollupOptions: {
      output: {
        // Separamos librerías pesadas en chunks propios → mejor caché y
        // evita el aviso de "chunk > 500 kB" con Three.js
        manualChunks: {
          three: ['three'],
          'socket-io': ['socket.io-client'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },

  test: {
    environment: 'jsdom', // simula un navegador para @testing-library
    globals: true, // describe/it/expect globales (sin importar)
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});