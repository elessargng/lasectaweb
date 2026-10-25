import { useState, type CSSProperties } from 'react';
import Mano from './Mano';
import type { EstiloMano } from './marcas';
import type { FormaMano } from './useSala';

interface ManoLevantadaProps {
  levantada: boolean;
  forma: FormaMano;
  /** Hay una nominación: la mano va grande, en el centro de la ficha, siempre como palma abierta, y aparece y desaparece sin más. */
  enNominacion: boolean;
  /** Las dos manos (la Banshee, que vota doble): la otra, en espejo. */
  dos?: boolean;
  /** El estilo de quien la levanta (su «skin»); sin él, el tuyo. */
  estilo?: string;
}

/**
 * Lado de la mano (fuera de las nominaciones), en proporción al del cuadro del
 * avatar o la cámara (--sala-avatar): así se ve igual de grande con cualquier
 * tamaño de cuadro. Con el cuadro por defecto (160 px) mide 88 px.
 */
const ESCALA_MANO = 0.55;
/**
 * Cuánto se sale de la esquina de arriba a la derecha del cuadro, en proporción a
 * la propia mano: la muñeca queda dentro del avatar y los dedos, fuera.
 */
const SALIDA_DERECHA = 0.28;
const SALIDA_ARRIBA = 0.25;

/**
 * La mano levantada de un jugador o del narrador. Fuera de las nominaciones, sale
 * de su avatar (o su cámara), por la esquina de arriba a la derecha; quien la usa
 * la pone en una caja del tamaño del cuadro. Al levantarla sube desde abajo con
 * un balanceo, y al bajarla baja antes de irse (sala.css; con menos movimiento,
 * sin animación). En una nominación, va sobre la ficha: la palma abierta (se vota
 * con la mano levantada) grande en el centro, para que se vea quién la levanta, y
 * sin animación. Solo visual: se dice en el nombre del asiento y en los avisos.
 */
const ManoLevantada = ({ levantada, forma, enNominacion, dos = false, estilo: estiloDe }: ManoLevantadaProps) => {
  // (Un estilo que no se conoce se pinta con el de por defecto)
  const estilo = estiloDe as EstiloMano | undefined;
  // Bajándola, la mano sigue un momento a la vista (la animación de bajar)
  const [bajando, setBajando] = useState(false);
  const [antes, setAntes] = useState(levantada);
  if (antes !== levantada) {
    setAntes(levantada);
    setBajando(!levantada && !enNominacion);
  }
  if (!levantada && !bajando) return null;

  if (enNominacion) {
    // Para votar, siempre la palma abierta, tenga la forma que tenga (las dos, una al lado de la otra)
    if (dos) {
      return (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-[96%] -translate-x-1/2 -translate-y-1/2 justify-center">
          <Mano estilo={estilo} forma="palma" className="w-1/2 -scale-x-100 drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]" />
          <Mano estilo={estilo} forma="palma" className="w-1/2 drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]" />
        </span>
      );
    }
    return (
      <Mano
        estilo={estilo}
        forma="palma"
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[78%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]"
      />
    );
  }

  return (
    <span
      // Sube al montarse (solo fuera de las nominaciones); al bajarla, baja y se quita
      className={`pointer-events-none absolute z-10 block w-[var(--sala-mano)] ${bajando ? 'sala-mano-baja' : 'sala-mano-sube'}`}
      style={
        {
          '--sala-mano': `calc(var(--sala-avatar, 10rem) * ${ESCALA_MANO})`,
          right: `calc(var(--sala-mano) * -${SALIDA_DERECHA})`,
          top: `calc(var(--sala-mano) * -${SALIDA_ARRIBA})`,
        } as CSSProperties
      }
      onAnimationEnd={() => bajando && setBajando(false)}
    >
      <Mano estilo={estilo} forma={forma} className="block w-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
      {/* La otra mano, en espejo, en la esquina de la izquierda del cuadro (saliéndose lo mismo) */}
      {dos && (
        <span
          className="absolute top-0 block w-full"
          // left = (1 − 2 · SALIDA_DERECHA) · mano − cuadro
          style={{ left: `calc(var(--sala-mano) * ${1 - 2 * SALIDA_DERECHA} - var(--sala-avatar, 10rem))` }}
        >
          <Mano estilo={estilo} forma={forma} className="block w-full -scale-x-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
        </span>
      )}
    </span>
  );
};

export default ManoLevantada;
