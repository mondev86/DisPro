// ============================================================
// src/api.js — cliente HTTP para el backend (fetch plano, sin axios)
//
// Todas las llamadas a la API pasan por aquí. Si el usuario se ha
// logueado (hay token en el store), se añade automáticamente el
// header Authorization: Bearer <token>.
// ============================================================

// Base de la API. En Vite se puede sobreescribir con VITE_API_URL.
// Si está vacío, usamos rutas relativas (el proxy de Vite las reenvía).
const BASE_URL = import.meta.env.VITE_API_URL || '';

// Leemos el token del localStorage (mismo patrón que el store)
function obtenerToken() {
  return localStorage.getItem('prensa_token') || '';
}

/**
 * Función genérica de petición HTTP.
 * @param {string} path - ruta del endpoint (p.ej. '/api/pieces')
 * @param {object} opciones - { method, body } sobreescrituras
 */
async function peticion(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = obtenerToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Parseamos el JSON (puede ser un error { error, details })
  const datos = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = datos.details?.join(', ') || datos.error || `Error ${res.status}`;
    throw new Error(msg);
  }
  return datos;
}

// ------------------------------------------------------------
// Catálogo de piezas
// ------------------------------------------------------------
export const getPiezas = () => peticion('/api/pieces');

// ------------------------------------------------------------
// Diseños (máquinas)
// ------------------------------------------------------------
export const getDisenos = () => peticion('/api/machines');

// Guardar diseño: { sessionId, name, pieces:[{pieceId,cantidad,transform}] }
export const guardarDiseno = (diseno) =>
  peticion('/api/machines', { method: 'POST', body: diseno });

// Obtener un diseño por id + su BOM
export const getDiseno = (id) => peticion(`/api/machines/${id}`);
export const getBom = (id) => peticion(`/api/machines/${id}/bom`);

// URL de descarga del BOM en CSV (se abre/usa como enlace de descarga)
export const getBomCsvUrl = (id) => `${BASE_URL}/api/machines/${id}/bom.csv`;

// ------------------------------------------------------------
// Autenticación (opcional)
// ------------------------------------------------------------
export const registrar = (user) => peticion('/auth/register', { method: 'POST', body: user });
export const iniciarSesion = (user) => peticion('/auth/login', { method: 'POST', body: user });