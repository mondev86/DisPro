// ============================================================
// src/middleware/error.js — manejo de errores global
//
// Dos piezas:
//   1. notFound → 404 para rutas inexistentes (se registra DESPUÉS
//      de todas las rutas reales).
//   2. errorHandler → 500 genérico (se registra el ULTIMO). Todo
//      error que escape de un `next(err)` acaba aquí.
// ============================================================

/**
 * 404 para cualquier ruta no definida.
 * (Express cae aquí cuando ninguna ruta anterior hizo match)
 */
function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

/**
 * Error handler genérico. Express lo identifica porque firma 4 argumentos.
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} _next - obligatorio (firma de 4 args); no se usa
 */
function errorHandler(err, req, res, _next) {
  // Muestra la stack en consola para depurar
  console.error('[ERROR]', err);

  const status = err.status || 500;
  res.status(status).json({
    error: 'Error interno del servidor',
    // Solo devolvemos el mensaje detallado en desarrollo
    message: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
}

module.exports = { notFound, errorHandler };