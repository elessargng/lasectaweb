import { useRef, useState } from 'react';
import { botonPrincipal, botonSecundario } from './estilos';
import type { AccionesNarradorVirtual, SalaDto, TurnoVirtual } from './useSala';

interface PanelDiaVirtualProps {
  estado: SalaDto;
  /** Lo que pide en su turno (ver AccionesNarradorVirtual). */
  turno: AccionesNarradorVirtual['turno'];
  onError: (mensaje: string) => void;
}

/** Lo que dice el turno de la nominación a quien le toca. */
const TU_TURNO: Record<string, string> = {
  acusacion: 'Tienes la palabra: acusa y, al acabar, pulsa «Defensa».',
  defensa: 'Tienes la palabra: defiéndete y, al acabar, pulsa «Empezar votación».',
};

/**
 * En el centro de la plaza, con narrador virtual, en las nominaciones (los privados
 * y la puesta en común ya los dice el reloj): lo que le toca a cada jugador. Quien
 * nomina, «Defensa» (pasa la palabra al nominado); el nominado, «Empezar votación»;
 * sin nominación en curso, «Listo» para la noche (o «Seguir nominando» para dejar
 * de estarlo), con cuántos lo están ya.
 * Lo que es de uno («Tienes la palabra…») se anuncia; el turno de los demás, no (lo
 * dice la voz del narrador). Al usar un botón que desaparece, el foco va al panel.
 */
const PanelDiaVirtual = ({ estado, turno, onError }: PanelDiaVirtualProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const narrador = estado.narradorVirtual;
  if (narrador?.etapa !== 'nominaciones') return null;
  const puede = (t: TurnoVirtual) => estado.acciones.includes(`narradorVirtual:${t}`);
  const sentados = estado.plaza.filter((a) => a.participanteId).length;
  const miTurno = (puede('defensa') && 'acusacion') || (puede('voto') && 'defensa') || null;

  // Sin `disabled` mientras responde: el foco no se pierde
  const usar = async (t: TurnoVirtual) => {
    if (pidiendo) return;
    setPidiendo(true);
    const r = await turno(t);
    setPidiendo(false);
    if (!r.ok) onError(r.error);
    else panelRef.current?.focus();
  };

  return (
    <div ref={panelRef} tabIndex={-1} role="group" aria-labelledby="sala-dia-virtual-titulo" className="flex flex-col items-center gap-3 focus:outline-none">
      <p id="sala-dia-virtual-titulo" className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-muted">
        Nominaciones
      </p>
      <p aria-live="polite" className="text-center text-sm">
        {miTurno && TU_TURNO[miTurno]}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {puede('defensa') && (
          <button type="button" onClick={() => void usar('defensa')} aria-disabled={pidiendo} className={botonPrincipal}>
            Defensa
          </button>
        )}
        {puede('voto') && (
          <button type="button" onClick={() => void usar('voto')} aria-disabled={pidiendo} className={botonPrincipal}>
            Empezar votación
          </button>
        )}
        {puede('listo') && (
          <button type="button" onClick={() => void usar('listo')} aria-disabled={pidiendo} className={botonSecundario}>
            Listo
          </button>
        )}
        {puede('seguirNominando') && (
          <button type="button" onClick={() => void usar('seguirNominando')} aria-disabled={pidiendo} className={botonSecundario}>
            Seguir nominando
          </button>
        )}
      </div>
      <p className="text-xs text-on-surface-muted">
        Listos para la noche: {narrador.listos.length} de {sentados}
      </p>
    </div>
  );
};

export default PanelDiaVirtual;
