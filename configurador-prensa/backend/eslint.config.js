// ============================================================
// eslint.config.js (backend) — configuración de ESLint 9 (flat config)
//
// ESLint 9 ya no usa .eslintrc: todo se define en un array de
// "config objects" exportados. Reglas recomendadas de JavaScript
// + variables globales de Node y de los tests (Vitest).
// ============================================================

const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier'); // apaga reglas de estilo que chocan con Prettier

module.exports = [
  // Reglas recomendadas (solo JS, sin plugins extra)
  js.configs.recommended,

  // Prettier: desactiva las reglas de formato de ESLint
  prettier,

  {
    name: 'configurador-prensa-backend',
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Entorno Node 18+
        ...globals.node,
        // Variables globales de Vitest (describe, it, expect, ...)
        ...globals.vitest,
      },
    },
    rules: {
      // Ajustes ergonómicos sobre lo recomendado
      'no-console': 'off', // el backend loguea en consola a propósito
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  {
    // Los archivos de test en ESM (.mjs) necesitan sourceType module
    name: 'configurador-prensa-backend-mjs',
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },

  {
    // Build files: 'requires' de dependencias dev usados en los propios
    // archivos de configuración
    ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
  },
];