// ============================================================
// src/validation/schemas.js — esquemas de validación con Zod
//
// Cada esquema describe la forma que DEBE tener una petición.
// El middleware src/middleware/validate.js los usa para rechazar
// peticiones inválidas con un 400 ANTES de tocar la base de datos.
// ============================================================

const { z } = require('zod');

// ------------------------------------------------------------
// AUTH — registro y login
// ------------------------------------------------------------

// Registro: email válido + contraseña mínima + nombre opcional
const registerSchema = z.object({
  email: z.string().email('El email no es válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'El nombre es demasiado corto').max(80).optional(),
});

// Login: email + contraseña (solo comprobamos que estén presentes)
const loginSchema = z.object({
  email: z.string().email('El email no es válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// ------------------------------------------------------------
// PIECES — creación de una pieza del catálogo
// ------------------------------------------------------------

// geometria:
//   box      → { tipo:'box', color:'#hex', size:[w,h,d] }
//   cylinder → { tipo:'cylinder', color:'#hex', size:[radius,height,segments] }
const geometrySchema = z.object({
  tipo: z.enum(['box', 'cylinder']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe ser hexadecimal (#rrggbb)'),
  size: z.array(z.number()).min(3).max(3),
});

const createPieceSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9_]+$/, 'slug: solo minúsculas, números y _'),
  name: z.string().min(3),
  category: z.string().min(2),
  material: z.string().min(2),
  weightKg: z.number().nonnegative().default(0),
  priceEur: z.number().nonnegative().default(0),
  dimensions: z.record(z.any()).optional().default({}),
  geometry: geometrySchema,
});

// ------------------------------------------------------------
// MACHINES — guardar un diseño
// ------------------------------------------------------------

// Una pieza colocada en el diseño:
//   pieceId  → id del catálogo
//   cantidad → nº de unidades (para el BOM)
//   transform→ posición/rotación/escala en el canvas 3D
const transformSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
});

const designPieceSchema = z.object({
  pieceId: z.string().min(1),
  cantidad: z.number().int().positive().default(1),
  transform: transformSchema,
});

// Cuerpo del POST /api/machines
const createMachineSchema = z.object({
  sessionId: z.string().uuid('sessionId debe ser un UUID').optional(),
  name: z.string().min(3, 'El nombre del diseño debe tener al menos 3 caracteres'),
  pieces: z.array(designPieceSchema).min(1, 'El diseño debe contener al menos una pieza'),
});

module.exports = {
  registerSchema,
  loginSchema,
  createPieceSchema,
  createMachineSchema,
  transformSchema,
};