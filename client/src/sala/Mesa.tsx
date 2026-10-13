import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Asiento from './Asiento';
import { botonPrincipal, botonSecundario } from './estilos';
import { idNombreAsiento } from './ids';
import type { SalaEstado, SalaResultado } from './useSala';

/** Límites de asientos; el servidor tiene los mismos y es quien los hace cumplir. */
const ASIENTOS_MAX = 20;

interface MesaProps {
  estado: SalaEstado;
  /** Mostrar en el centro los botones para añadir y eliminar asientos. */
  editando: boolean;
  /** Pide una acción a la sala (ver `useSala`). */
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** Dejar de editar los asientos. */
  onTerminar: () => void;
}

/**
 * Dónde va el asiento `i` de `total`: en un círculo, el primero a las 12 y
 * siguiendo como las agujas del reloj, así que el último queda hacia las 11.
 * El centro del cuadro se separa del borde de la mesa medio cuadro (--sala-avatar).
 */
function posicion(i: number, total: number): CSSProperties {
  const angulo = (2 * Math.PI * i) / total;
  const x = Math.sin(angulo).toFixed(4);
  const y = (-Math.cos(angulo)).toFixed(4);
  const radio = '(50% - var(--sala-avatar, 10rem) / 2)';
  return { left: `calc(50% + ${x} * ${radio})`, top: `calc(50% + ${y} * ${radio})` };
}

const textoAsientos = (n: number) => (n === 1 ? '1 asiento' : `${n} asientos`);

/**
 * La mesa: los asientos de la partida en círculo, del tamaño de avatar que cada
 * uno ha elegido. En modo edición (solo narradores), en el centro, los botones
 * para añadir un asiento al final del círculo o eliminar el último.
 *
 * Cada asiento (ver Asiento) es libre u ocupado, con su botón para sentarse o
 * levantarse. Para el lector, los asientos son una lista ordenada. Al añadir o
 * quitar asientos se anuncia cuántos quedan: el foco sigue en el botón.
 */
const Mesa = ({ estado, editando, pedir, onError, onTerminar }: MesaProps) => {
  const anadirRef = useRef<HTMLButtonElement>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const { asientos, participantes, yo, acciones } = estado;
  const total = asientos.length;
  const puedeSentarse = acciones.includes('sala:sentarse');
  const puedeLevantarse = acciones.includes('sala:levantarse');

  // Al sentarse o levantarse el botón desaparece: el foco va al nombre del
  // asiento («Asiento 3: Ana (tú)» / «Asiento 3, libre») cuando llegue el cambio.
  const focoAsientoRef = useRef<{ asientoId: string; sentado: boolean } | null>(null);
  useEffect(() => {
    const pendiente = focoAsientoRef.current;
    if (!pendiente) return;
    const asiento = asientos.find((a) => a.id === pendiente.asientoId);
    if (asiento && (asiento.ocupante === yo) !== pendiente.sentado) return; // aún no ha llegado
    focoAsientoRef.current = null;
    document.getElementById(idNombreAsiento(pendiente.asientoId))?.focus();
  });

  const ocuparOLevantar = async (asientoId: string, sentarse: boolean) => {
    focoAsientoRef.current = { asientoId, sentado: sentarse };
    const r = await pedir(sentarse ? 'sala:sentarse' : 'sala:levantarse', { asientoId });
    if (!r.ok) {
      focoAsientoRef.current = null;
      onError(r.error);
    }
  };

  const cambiar = async (cambio: 'añadir' | 'quitar') => {
    if (pidiendo) return;
    setPidiendo(true);
    const r = await pedir('narrador:asientos', { cambio });
    setPidiendo(false);
    if (!r.ok) onError(r.error);
  };

  // Sin `disabled` (tiraría el foco al body): se marcan y no hacen nada.
  const sinMas = total >= ASIENTOS_MAX;
  const sinAsientos = total === 0;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[calc(100vh-8rem)]">
      {total > 0 ? (
        <ol aria-label="Asientos">
          {asientos.map((a, i) => {
            const ocupante = a.ocupante ? (participantes.find((p) => p.id === a.ocupante) ?? null) : null;
            return (
              <li key={a.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={posicion(i, total)}>
                <Asiento
                  id={a.id}
                  numero={i + 1}
                  ocupante={ocupante}
                  esYo={a.ocupante === yo}
                  puedeSentarse={puedeSentarse}
                  puedeLevantarse={puedeLevantarse && a.ocupante === yo}
                  onSentarse={() => ocuparOLevantar(a.id, true)}
                  onLevantarse={() => ocuparOLevantar(a.id, false)}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        !editando && (
          <p className="absolute inset-0 flex items-center justify-center text-on-surface-muted">
            La mesa no tiene asientos.
          </p>
        )
      )}

      {editando && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded border border-outline-ghost bg-surface/90 p-4">
          <p aria-live="polite" className="text-sm text-on-surface-muted">
            {textoAsientos(total)}
          </p>
          <button
            ref={anadirRef}
            type="button"
            onClick={() => !sinMas && cambiar('añadir')}
            aria-disabled={sinMas || pidiendo}
            className={`${botonPrincipal} w-full`}
          >
            Añadir asiento
          </button>
          <button
            type="button"
            onClick={() => !sinAsientos && cambiar('quitar')}
            aria-disabled={sinAsientos || pidiendo}
            className={`${botonPrincipal} w-full`}
          >
            Eliminar asiento
          </button>
          <button type="button" onClick={onTerminar} className={`${botonSecundario} w-full`}>
            Terminar
          </button>
        </div>
      )}
    </div>
  );
};

export default Mesa;
