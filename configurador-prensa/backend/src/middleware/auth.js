// ============================================================
// src/middleware/auth.js — autenticación JWT
//
// Expone dos utilidades:
//   1. signToken(userId, email) → genera un token JWT firmado
//   2. auth  → middleware Express que valida el header
//              "Authorization: Bearer <token>" y deja el userId en req
//
// El token se expide en /auth/login y /auth/register y es válido
// 7 días. NUNCA guardamos la contraseña en el token.
// ============================================================

const jwt = require('jsonwebtoken');

// Leemos el secreto desde las variables de entorno
// (fallback solo para desarrollo local; en producción DEBE existir)
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_no_usar_en_produccion';

const TOKEN_EXPIRES_IN = '7d';

/**
 * Genera un JWT para un usuario.
 * @param {object} user - objeto con id y email
 * @returns {string} token firmado
 */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email }, // payload (sub = sujeto del token)
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

/**
 * Middleware de autenticación. Ejemplo de uso:
 *   router.post('/', auth, handler)
 * Si el token es válido, deja `req.userId` y `req.userEmail` para el handler.
 */
function auth(req, res, next) {
  // 1. Leer el header Authorization
  const header = req.headers.authorization || '';

  // Formato esperado: "Bearer eyJhbGciOi..."
  const [scheme, token] = header.split(' ');

  // 2. Si no viene o el formato es incorrecto → 401
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado: falta el token Bearer' });
  }

  // 3. Verificar la firma y la expiración
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub; // id del usuario (sub)
    req.userEmail = payload.email;
    return next();
  } catch {
    // Token inválido o caducado
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { signToken, auth };