// ============================================================
// src/pages/Disenos.jsx — lista de diseños guardados
//
// Carga GET /api/machines y muestra las tarjetas con:
//   - nombre, versión, piezas y total del BOM
//   - botón "Ver BOM" → GET /api/machines/:id/bom en un desplegable
// ============================================================

import { useEffect, useState } from 'react';
import { getDisenos, getBom, getBomCsvUrl } from '../api';

export default function Disenos() {
  const [disenos, setDisenos] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [bomVisible, setBomVisible] = useState(null); // id del diseño con BOM abierto
  const [bomDatos, setBomDatos] = useState(null);

  // 1. Cargar lista de diseños al montar
  useEffect(() => {
    getDisenos()
      .then((datos) => setDisenos(datos.machines || []))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  // 2. Abrir/cerrar el BOM de un diseño
  const alternarBom = async (diseno) => {
    if (bomVisible === diseno.id) {
      setBomVisible(null);
      setBomDatos(null);
      return;
    }
    try {
      const datos = await getBom(diseno.id);
      setBomDatos(datos);
      setBomVisible(diseno.id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (cargando) return <div className="panel"><p>Cargando diseños…</p></div>;

  return (
    <main className="pagina">
      <h2>Diseños guardados</h2>
      {error && <p className="error">{error}</p>}

      {disenos.length === 0 ? (
        <p className="muted">
          Todavía no hay diseños. Vuelve al configurador, coloca piezas y pulsa
          "Guardar diseño".
        </p>
      ) : (
        <div className="lista-disenos">
          {disenos.map((d) => (
            <div className="card-diseno" key={d.id}>
              <div className="card-diseno-info">
                <strong>{d.name}</strong>
                <small className="muted">
                  v{d.version} · {new Date(d.updatedAt).toLocaleString()} · BOM {d.bomTotal} €
                </small>
              </div>
              <button className="btn" onClick={() => alternarBom(d)}>
                {bomVisible === d.id ? 'Cerrar BOM' : 'Ver BOM'}
              </button>
              <a className="btn ghost" href={getBomCsvUrl(d.id)} title="Descargar BOM en CSV">
                ⬇ CSV
              </a>

              {/* BOM expandible */}
              {bomVisible === d.id && bomDatos && (
                <div className="tabla-bom">
                  <h3>BOM — {bomDatos.machine.name} (v{bomDatos.version})</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Cant.</th>
                        <th>Pieza</th>
                        <th>Material</th>
                        <th>€/u</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomDatos.items.map((item) => (
                        <tr key={item.pieceId}>
                          <td>{item.quantity}</td>
                          <td>{item.name}</td>
                          <td>{item.material}</td>
                          <td>{item.unitPrice.toFixed(2)}</td>
                          <td>{item.lineTotal.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="4">TOTAL</td>
                        <td>{bomDatos.total.toFixed(2)} €</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}