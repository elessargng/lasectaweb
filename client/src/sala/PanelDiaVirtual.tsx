import { useRef, useState } from 'react';
import { botonPrincipal, botonSecundario } from './estilos';
import type { SalaEstado, SalaResultado } from './useSala';

interface PanelDiaVirtualProps {
  estado: SalaEstado;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
}

/** Cómo se llama cada momento del día del narrador virtual. */
const ETAPAS: Partial<Record<string, string>> = {
  privados: 'Privados',
  puestaEnComun: 'Puesta en común',
  nominaciones: 'Nominaciones',
};

/** Lo que dice el turno de la nominación a quien le toca. */
const TU_TURNO: Record<string, string> = {
  acusacion: 'Tienes la palabra: acusa y, al acabar, pulsa «Defensa».',
  defensa: 'Tienes la palabra: defiéndete y, al acabar, pulsa «Voto».',
};

/**
 * En el centro de la mesa, con narrador virtual, de día: en qué momento está y lo
 * que le toca a cada jugador. Quien nomina, «Defensa» (pasa la palabra al
 * nominado); el nominado, «Voto» (empieza la votación); los demás, «Listo» para la
 * noche (o «Seguir nominando» para dejar de estarlo), con cuántos lo están ya.
 * Lo que es de uno («Tienes la palabra…») se anuncia; el turno de los demás, no (lo
 * dice la voz del narrador). Al usar un botón que desaparece, el foco va al panel.
 */
const PanelDiaVirtual = ({ estado, pedir, onError }: PanelDiaVirtualProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const narrador = estado.narradorVirtual;
  const etapa = narrador ? ETAPAS[narrador.etapa] : undefined;
  if (!narrador || !etapa) return null;
  const puede = (accion: string) => estado.acciones.includes(accion);
  const sentados = estado.asientos.filter((a) => a.ocupante).length;
  const miTurno = (puede('jugador:defensa') && 'acusacion') || (puede('jugador:voto') && 'defensa') || null;

  // Sin `disabled` mientras responde: el foco no se pierde
  const usar = async (accion: string) => {
    if (pidiendo) return;
    setPidiendo(true);
    const r = await pedir(accion);
    setPidiendo(false);
    if (!r.ok) onError(r.error);
    else panelRef.current?.focus();
  };

  return (
    <div ref={panelRef} tabIndex={-1} role="group" aria-labelledby="sala-dia-virtual-titulo" className="flex flex-col items-center gap-3 focus:outline-none">
      <p id="sala-dia-virtual-titulo" className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-muted">
        {etapa}
      </p>
      <p aria-live="polite" className="text-center text-sm">
        {miTurno && TU_TURNO[miTurno]}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {puede('jugador:defensa') && (
          <button type="button" onClick={() => void usar('jugador:defensa')} aria-disabled={pidiendo} className={botonPrincipal}>
            Defensa
          </button>
        )}
        {puede('jugador:voto') && (
          <button type="button" onClick={() => void usar('jugador:voto')} aria-disabled={pidiendo} className={botonPrincipal}>
            Voto
          </button>
        )}
        {puede('jugador:listo') && (
          <button type="button" onClick={() => void usar('jugador:listo')} aria-disabled={pidiendo} className={botonSecundario}>
            Listo
          </button>
        )}
        {puede('jugador:seguirNominando') && (
          <button type="button" onClick={() => void usar('jugador:seguirNominando')} aria-disabled={pidiendo} className={botonSecundario}>
            Seguir nominando
          </button>
        )}
      </div>
      {narrador.etapa === 'nominaciones' && (
        <p className="text-xs text-on-surface-muted">
          Listos para la noche: {narrador.listos.length} de {sentados}
        </p>
      )}
    </div>
  );
};

export default PanelDiaVirtual;
