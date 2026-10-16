import { IconoLuna, IconoPergamino, IconoSol } from './IconosJuego';
import { nombreFase } from './avisosSala';
import type { SalaFase } from './useSala';

/**
 * En la cabecera, a la vista de todos: en qué momento está la partida
 * («Preparación», «Noche 2», «Día 2»), con un icono que no se lee. Los cambios
 * se anuncian aparte (avisosSala). El jugador despertado vuelve a abrir su
 * información de noche desde la luna de su ficha (Mesa).
 */
const FasePartida = ({ fase }: { fase: SalaFase }) => {
  const Icono = fase.momento === 'noche' ? IconoLuna : fase.momento === 'dia' ? IconoSol : IconoPergamino;
  // Una pastilla con filo de latón: de día, dorada; de noche, del morado del grimorio
  const clases = `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1 font-ui text-sm font-semibold tracking-wide text-on-surface-bright shadow-[inset_0_1px_0_rgba(212,175,106,0.15)] ${
    fase.momento === 'dia'
      ? 'border-gold/60 bg-gold-deep/25'
      : fase.momento === 'noche'
        ? 'border-grimorio-bright/50 bg-grimorio/35'
        : 'border-gold/35 bg-background/50'
  }`;
  return (
    <p className={clases}>
      <Icono size={16} className={fase.momento === 'noche' ? 'text-grimorio-bright' : 'text-gold-bright'} />
      {nombreFase(fase)}
    </p>
  );
};

export default FasePartida;
