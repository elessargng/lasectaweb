import { botonSecundario } from './estilos';
import type { Rango } from './preferencias';
import Interruptor from './Interruptor';

/** Cómo se lee cada unidad. */
const UNIDADES = { px: 'píxeles', '%': 'por ciento', s: 'segundos' };

interface DeslizadorProps {
  id: string;
  etiqueta: string;
  valor: number;
  rango: Rango;
  onCambiar: (valor: number) => void;
  /** Unidad del valor: píxeles (por defecto), porcentaje o segundos. */
  unidad?: 'px' | '%' | 's';
  /** Explicación del ajuste; el lector la oye como descripción. */
  ayuda?: string;
  /**
   * Casilla «Automático»: marcada, el valor lo decide la sala (`actual`) y el
   * deslizador se oculta; desmarcada, vuelve el valor elegido a mano.
   */
  automatico?: { activo: boolean; actual: number; explicacion: string; onCambiar: (activo: boolean) => void };
}

/**
 * Un ajuste numérico de las preferencias (en píxeles o en %): deslizador con su
 * etiqueta, el valor a la vista y un botón para volver al valor inicial; y, si
 * se pide, la casilla «Automático». Se aplica al momento. El lector oye el valor
 * en el propio deslizador («72 píxeles»).
 */
const Deslizador = ({ id, etiqueta, valor, rango, onCambiar, unidad = 'px', ayuda, automatico }: DeslizadorProps) => {
  const auto = automatico?.activo ?? false;
  return (
    <div className="flex flex-col gap-2">
      {/* Con automático, la etiqueta no apunta a ningún control: es el título del ajuste */}
      {auto ? (
        <p id={`${id}-titulo`} className="text-sm text-on-surface-muted">
          {etiqueta}
        </p>
      ) : (
        <label htmlFor={id} className="text-sm text-on-surface-muted">
          {etiqueta}
        </label>
      )}
      {automatico && (
        <Interruptor
          id={`${id}-auto`}
          activo={auto}
          onCambiar={automatico.onCambiar}
          describedBy={`${id}-auto-ayuda`}
          textoClassName="text-sm"
        >
          <span className="sr-only">{etiqueta}: </span>Automático
        </Interruptor>
      )}
      {automatico && (
        <p id={`${id}-auto-ayuda`} className="text-xs text-on-surface-muted">
          {auto ? `Ahora: ${automatico.actual} ${unidad}, ${automatico.explicacion}.` : `Desmárcalo para elegirlo tú.`}
        </p>
      )}
      {!auto && (
        <>
          <div className="flex items-center gap-4">
            <input
              id={id}
              type="range"
              min={rango.min}
              max={rango.max}
              step={rango.paso}
              value={valor}
              aria-valuetext={`${valor.toLocaleString('es')} ${UNIDADES[unidad]}`}
              aria-describedby={ayuda ? `${id}-ayuda` : undefined}
              onChange={(e) => onCambiar(Number(e.target.value))}
              className="flex-1 accent-theme-main"
            />
            <span aria-hidden="true" className="w-16 text-right text-sm tabular-nums">
              {valor.toLocaleString('es')} {unidad}
            </span>
          </div>
          {ayuda && (
            <p id={`${id}-ayuda`} className="text-xs text-on-surface-muted">
              {ayuda}
            </p>
          )}
          {/* Siempre visible: si desapareciera al pulsarlo, el foco se perdería */}
          <div>
            <button type="button" onClick={() => onCambiar(rango.defecto)} className={botonSecundario}>
              Volver al valor inicial
              <span className="sr-only"> de {etiqueta.toLocaleLowerCase('es')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Deslizador;
