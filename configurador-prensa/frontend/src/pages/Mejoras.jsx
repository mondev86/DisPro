// ============================================================
// src/pages/Mejoras.jsx — pestaña "Mejoras del Proyecto"
//
// Panel resumen de la hoja de ruta README-MEJORAS.md: qué se ha
// implementado en este rediseño, paleta funcional y estado de cada
// mejora (hecha / pendiente). Autocontenido, sin dependencias de red.
// ============================================================

import { CheckCircle2, Circle, Rocket, Scale, Coins, Boxes, Table2, Camera, Eraser } from 'lucide-react';

const MEJORAS = [
  {
    id: 'cockpit',
    nombre: 'Cockpit de ingeniería en modo oscuro',
    detalle: 'Todo el panel con la paleta slate + acentos funcionales (README-MEJORAS).',
    hecho: true,
    icono: <Rocket size={15} />,
  },
  {
    id: 'telemetria',
    nombre: 'Telemetría en vivo',
    detalle: 'Masa total (kg), coste BOM (€) y centro de masas [X, Y, Z] en la cabecera.',
    hecho: true,
    icono: <Scale size={15} />,
  },
  {
    id: 'cog',
    nombre: 'Centro de masas en el canvas',
    detalle: 'Marcador ámbar con línea de proyección al suelo, actualizado en tiempo real.',
    hecho: true,
    icono: <Boxes size={15} />,
  },
  {
    id: 'filtros',
    nombre: 'Catálogo con filtros',
    detalle: 'Búsqueda por texto (nombre/material) y chips por categoría funcional.',
    hecho: true,
    icono: <Eraser size={15} />,
  },
  {
    id: 'ergonomia',
    nombre: 'Validador ergonómico (35°–50°)',
    detalle: 'Al tocar asientos/respaldos muestra la inclinación, verde si está en rango.',
    hecho: true,
    icono: <Circle size={15} />,
  },
  {
    id: 'bom',
    nombre: 'Diseños & BOM con exportación CSV',
    detalle: 'Tabla del BOM expandible por diseño y descarga CSV de materiales.',
    hecho: true,
    icono: <Table2 size={15} />,
  },
  {
    id: 'snapshot',
    nombre: 'Captura PNG en alta resolución',
    detalle: 'Botón sobre el canvas que descarga una imagen 2x como PNG.',
    hecho: true,
    icono: <Camera size={15} />,
  },
  {
    id: 'siguientes',
    nombre: 'Próximos pasos sugeridos',
    detalle: 'Modelos GLTF reales, simulación de cargas, perfiles de usuario y equipos.',
    hecho: false,
    icono: <Coins size={15} />,
  },
];

export default function Mejoras() {
  const hechas = MEJORAS.filter((m) => m.hecho);
  const pendientes = MEJORAS.filter((m) => !m.hecho);

  return (
    <main className="pagina custom-scrollbar">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Rocket size={16} style={{ color: 'var(--acento)' }} /> Mejoras del Proyecto
      </h2>
      <p className="muted">
        Estado del rediseño según <code>README-MEJORAS.md</code>. El color de cada
        tarjeta es la métrica que representa (masa, coste o centro de masas).
      </p>

      <h3 className="text-sm font-semibold mt-4 mb-2 text-slate-300">
        Implementadas ({hechas.length}/{MEJORAS.length})
      </h3>
      <div className="lista-disenos">
        {hechas.map((m) => (
          <div className="card-diseno" key={m.id}>
            <CheckCircle2 size={18} style={{ color: 'var(--bom)' }} />
            <div className="card-diseno-info">
              <strong>{m.nombre}</strong>
              <small className="muted">{m.detalle}</small>
            </div>
            <span className="chip activo">hecha</span>
          </div>
        ))}
      </div>

      {pendientes.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mt-4 mb-2 text-slate-300">Pendientes</h3>
          <div className="lista-disenos">
            {pendientes.map((m) => (
              <div className="card-diseno" key={m.id}>
                <Circle size={18} style={{ color: 'var(--muted)' }} />
                <div className="card-diseno-info">
                  <strong>{m.nombre}</strong>
                  <small className="muted">{m.detalle}</small>
                </div>
                <span className="chip">próximo</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}