// ============================================================
// src/middleware/validate.js — middleware genérico de validación
//
// Uso: router.post('/', validate(createMachineSchema), handler)
//
// Valida el `body` (u otra parte de la petición indicada por
// `source`) contra un esquema Zod. Si falla, responde 400 con la
// lista de errores y NO deja pasar la petición.
// ============================================================

/**
 * Crea un middleware de Express que valida una parte de la request.
 * @param {object} schema - Esquema Zod compilado
 * @param {'body'|'query'|'params'} source - qué parte de la petición validar
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    // safeParse NO lanza excepción: devuelve { success, data, error }
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      // Extraemos mensajes legibles: "campo: mensaje"
      const errores = result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`
      );
      return res.status(400).json({ error: 'Datos de entrada no válidos', details: errores });
    }

    // Reemplazamos la parte validada por los datos "limpios"
    // (Zod aplica .default() y .trim() aquí si estuvieran definidos)
    req[source] = result.data;
    next();
  };
};

module.exports = { validate };