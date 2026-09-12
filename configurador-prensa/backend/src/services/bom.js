// ============================================================
// src/services/bom.js — lógica de cálculo del BOM
//
// BOM = Bill Of Materials (lista de materiales).
// A partir de la lista de piezas del diseño (con cantidades) y del
// catálogo, agrupa por pieza y calcula subtotales:
//
//   cantidad   = nº de unidades usadas
//   unitPrice  = precio unitario desde el catálogo
//   lineTotal  = unitPrice * cantidad
// ============================================================

/**
 * Calcula el BOM a partir de las piezas del diseño + catálogo.
 * @param {Array<{pieceId:string, cantidad:number}>} piezasDiseno
 * @param {Array<{id:string, priceEur:number}>} catalogo
 * @returns {Array<{pieceId:string, quantity:number, unitPrice:number, lineTotal:number}>}
 */
function computeBom(piezasDiseno, catalogo) {
  // Índice "id → pieza" para localizar los precios en O(1)
  const index = new Map(catalogo.map((p) => [p.id, p]));

  // Agrupamos cantidades por pieza (dos entradas de la misma pieza se suman)
  const agrupado = new Map();
  for (const p of piezasDiseno) {
    agrupado.set(p.pieceId, (agrupado.get(p.pieceId) || 0) + (p.cantidad || 1));
  }

  // Convertimos el mapa a filas de BOM
  const items = [];
  for (const [pieceId, quantity] of agrupado) {
    const pieza = index.get(pieceId);
    if (!pieza) continue; // pieza no encontrada → la omitimos

    const unitPrice = pieza.priceEur;
    items.push({
      pieceId,
      quantity,
      unitPrice,
      lineTotal: Number((unitPrice * quantity).toFixed(2)), // 2 decimales
    });
  }

  // Ordenamos por subtotal descendente (lo más caro primero)
  return items.sort((a, b) => b.lineTotal - a.lineTotal);
}

/**
 * Total del BOM (suma de subtotales).
 * @param {Array<{lineTotal:number}>} items
 * @returns {number}
 */
function bomTotal(items) {
  return Number(items.reduce((acc, item) => acc + item.lineTotal, 0).toFixed(2));
}

module.exports = { computeBom, bomTotal };