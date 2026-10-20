import { IconoLuna, IconoPergamino, IconoSol } from './IconosJuego';
import { nombreFase } from './avisosSala';
import MenuDesplegable from './MenuDesplegable';
import type { SalaFase } from './useSala';

/** A dónde vuelve la máquina del tiempo (como el servidor, SalaService.faseAnterior): «la noche 1», «el día 1», «la preparación». */
function nombreFaseAnterior({ momento, numero }: SalaFase): string | null {
  if (momento === 'preparacion') return null;
  if (momento === 'dia') return `la noche ${numero}`;
  return numero <= 1 ? 'la preparación' : `el día ${numero - 1}`;
}

interface FasePartidaProps {
  fase: SalaFase;
  /**
   * Narradores: la máquina del tiempo, volver a la fase anterior (si se han
   * precipitado). Con ella, la fase es un botón que la despliega; sin ella, solo se ve.
   */
  onVolverAtras?: () => Promise<boolean>;
}

/**
 * En la cabecera, a la vista de todos: en qué momento está la partida
 * («Preparación», «Noche 2», «Día 2»), con un icono que no se lee. Los cambios
 * se anuncian aparte (avisosSala). El jugador despertado vuelve a abrir su
 * información de noche desde la luna de su ficha (Mesa).
 *
 * Para el narrador es además un botón con la máquina del tiempo: «Volver a la
 * noche 2» (o al día, o a la preparación). Al elegirla, el foco vuelve al botón,
 * que ya dice la fase nueva.
 */
const FasePartida = ({ fase, onVolverAtras }: FasePartidaProps) => {
  const Icono = fase.momento === 'noche' ? IconoLuna : fase.momento === 'dia' ? IconoSol : IconoPergamino;
  // Una pastilla con filo de latón: de día, dorada; de noche, del morado del grimorio
  const clases = `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1 font-ui text-sm font-semibold tracking-wide text-on-surface-bright shadow-[inset_0_1px_0_rgba(212,175,106,0.15)] ${
    fase.momento === 'dia'
      ? 'border-gold/60 bg-gold-deep/25'
      : fase.momento === 'noche'
        ? 'border-grimorio-bright/50 bg-grimorio/35'
        : 'border-gold/35 bg-background/50'
  }`;
  const contenido = (
    <>
      <Icono size={16} className={fase.momento === 'noche' ? 'text-grimorio-bright' : 'text-gold-bright'} />
      {nombreFase(fase)}
    </>
  );
  const destino = nombreFaseAnterior(fase);
  // (tabIndex -1: si se vuelve a la preparación el botón desaparece, y el foco viene aquí)
  if (!onVolverAtras || !destino) {
    return (
      <p id="sala-fase" tabIndex={-1} className={`${clases} focus:outline-none`}>
        {contenido}
      </p>
    );
  }
  return (
    <MenuDesplegable
      id="sala-fase-menu"
      boton={contenido}
      descripcion="Máquina del tiempo"
      botonClassName={`${clases} cursor-pointer hover:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main`}
      opciones={[
        {
          id: 'volverAtras',
          etiqueta: `Volver a ${destino}`,
          elegir: async () => {
            const ok = await onVolverAtras();
            // A la preparación, la fase deja de ser un botón (no hay a dónde volver): el foco, a ella
            if (ok && destino === 'la preparación') window.setTimeout(() => document.getElementById('sala-fase')?.focus(), 0);
            // false: el menú se cierra y el foco vuelve a la fase, que ya dice la nueva
            return false;
          },
        },
      ]}
    />
  );
};

export default FasePartida;
