import { useState } from 'react';
import Mano from './Mano';
import type { FormaMano } from './useSala';

interface ManoLevantadaProps {
  levantada: boolean;
  forma: FormaMano;
  /** Hay una nominación: la mano va grande, en el centro de la ficha, siempre como palma abierta, y aparece y desaparece sin más. */
  enNominacion: boolean;
  /** Las dos manos (la Banshee, que vota doble): la otra, en espejo. */
  dos?: boolean;
}

/**
 * La mano de un jugador sobre su ficha en la mesa. Fuera de las nominaciones, en
 * la esquina de arriba a la derecha (pegada a la ficha, para que se sepa de quién
 * es aunque estén juntas): al levantarla sube desde abajo con un balanceo, y al
 * bajarla baja antes de irse (sala.css; con menos movimiento, sin animación). En
 * una nominación, la palma abierta (se vota con la mano levantada) grande en el
 * centro, para que se vea quién la levanta, y sin animación. Solo visual: se
 * dice en el nombre de la ficha y en los avisos.
 */
const ManoLevantada = ({ levantada, forma, enNominacion, dos = false }: ManoLevantadaProps) => {
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
          <Mano forma="palma" className="w-1/2 -scale-x-100 drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]" />
          <Mano forma="palma" className="w-1/2 drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]" />
        </span>
      );
    }
    return (
      <Mano
        forma="palma"
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[78%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]"
      />
    );
  }

  return (
    <span
      // Sube al montarse (solo fuera de las nominaciones); al bajarla, baja y se quita
      className={`pointer-events-none absolute -right-[8%] -top-[12%] z-10 block w-[calc(var(--sala-ficha,4.5rem)*0.55)] ${
        bajando ? 'sala-mano-baja' : 'sala-mano-sube'
      }`}
      onAnimationEnd={() => bajando && setBajando(false)}
    >
      <Mano forma={forma} className="block w-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" />
      {/* La otra mano, en espejo, en la esquina de la izquierda de la ficha */}
      {dos && (
        <Mano
          forma={forma}
          className="absolute top-0 block w-full -scale-x-100 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)] [right:calc(var(--sala-ficha,4.5rem)*1.16-100%)]"
        />
      )}
    </span>
  );
};

export default ManoLevantada;
