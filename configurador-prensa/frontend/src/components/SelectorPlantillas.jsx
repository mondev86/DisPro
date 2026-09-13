// ============================================================
// src/components/SelectorPlantillas.jsx — selector de plantillas (paso 8)
//
// Un `<select>` en la barra del canvas. Al elegir una plantilla base,
// reemplaza el diseño actual (tras `confirm` si ya hay piezas). Cada
// carga queda registrada en el historial → Ctrl+Z la deshace.
// ============================================================

import { PLANTILLAS } from '../plantillas';
import { useStore } from '../store/useStore';

export default function SelectorPlantillas() {
  const piezasDiseno = useStore((s) => s.piezasDiseno);
  const cargarPlantilla = useStore((s) => s.cargarPlantilla);

  const alElegir = (e) => {
    const plantilla = PLANTILLAS.find((t) => t.slug === e.target.value);
    e.target.value = ''; // deja el select en "Elegir..."
    if (!plantilla) return;
    if (piezasDiseno.length > 0 && !window.confirm('La plantilla reemplazará el diseño actual. ¿Continuar?')) {
      return;
    }
    cargarPlantilla(plantilla);
  };

  return (
    <label className="selector-plantillas">
      <span className="muted">Plantilla:</span>
      <select defaultValue="" onChange={alElegir}>
        <option value="" disabled>
          Elegir…
        </option>
        {PLANTILLAS.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}