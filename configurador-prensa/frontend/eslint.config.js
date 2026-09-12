// ============================================================
// eslint.config.js (frontend) — ESLint 9 (flat config)
//
// Reglas recomendadas de JavaScript y React, optimizadas para
// Vite + React Refresh. Se combina con Prettier (que se encarga
// del formato).
// ============================================================

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  // Reglas JS recomendadas
  js.configs.recommended,

  // Apagamos reglas de estilo que gestiona Prettier
  prettier,

  {
    name: 'configurador-prensa-frontend',
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }, // habilita el parseo de JSX
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.vitest, // describe/it/expect en los tests
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // El uso de variables DENTRO de JSX cuenta como "uso real"
      // (sin esto, <MiComponente/> marcaba la importación como "sin usar")
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      // Reglas de los hooks de React (versión 5 expone las flat configs por separado)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Avisa si un componente exporta nombres que rompen React Refresh
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // El uso de console es normal durante el desarrollo
      'no-console': 'off',
    },
  },

  {
    // Ignoramos builds y dependencias
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];