// ============================================================
// src/routes/auth.js — autenticación
//
//   POST /auth/register → crea un usuario y devuelve { token, user }
//   POST /auth/login    → valida credenciales y devuelve { token, user }
//
// La contraseña se guarda SIEMPRE como hash bcrypt (nunca en claro).
// En producción, SSL/TLS protege la red; bcrypt protege la BD.
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { signToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validation/schemas');

const router = express.Router();

// Nº de rondas de salado bcrypt. 10 es un buen equilibrio
// seguridad/rendimiento (≈100ms por hash).
const BCRYPT_ROUNDS = 10;

// ------------------------------------------------------------
// POST /auth/register — alta de usuario
// ------------------------------------------------------------
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // 1. ¿Existe ya un usuario con ese email?
    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    // 2. Hash seguro de la contraseña
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 3. Crear el usuario en la BD
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name || null },
    });

    // 4. Expedir el JWT (esto es el "inicio de sesión" automático tras registrarse)
    const token = signToken(user);

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err); // pasamos el error al errorHandler global
  }
});

// ------------------------------------------------------------
// POST /auth/login — inicio de sesión
// ------------------------------------------------------------
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Buscar al usuario por email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Mensaje genérico a propósito: no revelamos si el email existe
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // 2. Comparar la contraseña con el hash guardado
    const valida = await bcrypt.compare(password, user.passwordHash);
    if (!valida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // 3. Expedir el token
    const token = signToken(user);

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;