import type { CSSProperties } from 'react';
import FichaRecordatorio, { TAMANO_RECORDATORIO } from './FichaRecordatorio';
import { describirRecordatorio, esRecordatorioTexto, textoRecordatorio, useFichas } from './fichas';
import type { SalaRecordatorio } from './useSala';

interface RecordatoriosFichaProps {
  recordatorios: SalaRecordatorio[];
  /** Dónde empiezan: junto a la ficha, hacia el centro de la mesa (lo calcula la mesa). */
  style: CSSProperties;
  /** Hacia el centro de la mesa (vector unitario): por ahí se apilan. */
  hacia: { x: number; y: number };
  /** Los que quien mira puede quitar (botón); los demás solo se ven. */
  puedeQuitar: (r: SalaRecordatorio) => boolean;
  onQuitar: (r: SalaRecordatorio) => void;
  /**
   * Quitar solo con el ratón: los botones no se leen ni se alcanzan con el
   * tabulador, porque quien los usa ya tiene otro sitio para quitarlos (y la
   * ficha ya dice qué recordatorios lleva).
   */
  soloRaton?: boolean;
}

/**
 * Las fichas recordatorio de una ficha: junto a ella, hacia el centro de la mesa,
 * una tras otra en esa dirección. Apiladas (solapadas) mientras no se pasa el
 * ratón ni el foco por ellas; entonces se separan para verlas todas.
 *
 * Las que se pueden quitar son botones («Quitar recordatorio…»); las demás solo
 * se ven (lo que llevan se lee con el nombre del asiento y en la ficha).
 */
const RecordatoriosFicha = ({ recordatorios, style, hacia, puedeQuitar, onQuitar, soloRaton = false }: RecordatoriosFichaProps) => {
  const { todosPorId } = useFichas();
  if (recordatorios.length === 0) return null;
  const n = recordatorios.length;
  return (
    <div
      className="pointer-events-auto absolute z-20 [--paso:0.3] focus-within:z-40 focus-within:[--paso:1.08] hover:z-40 hover:[--paso:1.08]"
      style={style}
    >
      {recordatorios.map((r, k) => {
        const personaje = todosPorId.get(r.personaje);
        const colocar: CSSProperties = {
          // El primero, encima de los demás
          zIndex: n - k,
          transform: `translate(-50%, -50%) translate(calc(${hacia.x * k} * var(--paso) * ${TAMANO_RECORDATORIO}), calc(${hacia.y * k} * var(--paso) * ${TAMANO_RECORDATORIO}))`,
        };
        // Con texto propio, el «personaje» de la ficha es el de su icono (si lo es)
        const libre = esRecordatorioTexto(r);
        const ficha = (
          <FichaRecordatorio
            personaje={libre ? (r.icono ? todosPorId.get(r.icono) : undefined) : personaje}
            texto={textoRecordatorio(r, personaje)}
            libre={libre}
            icono={r.icono}
          />
        );
        const clases = 'absolute left-0 top-0 block rounded-full transition-transform duration-150 motion-reduce:transition-none';
        return puedeQuitar(r) ? (
          <button
            key={r.id}
            type="button"
            onClick={() => onQuitar(r)}
            aria-label={soloRaton ? undefined : `Quitar recordatorio ${describirRecordatorio(r, personaje)}`}
            aria-hidden={soloRaton || undefined}
            tabIndex={soloRaton ? -1 : undefined}
            className={`${clases} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main`}
            style={colocar}
          >
            {ficha}
          </button>
        ) : (
          <span key={r.id} aria-hidden="true" className={clases} style={colocar}>
            {ficha}
          </span>
        );
      })}
    </div>
  );
};

export default RecordatoriosFicha;
