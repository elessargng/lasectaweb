import { IconoLuna, IconoPergamino, IconoSol } from './IconosJuego';
import { nombreFase } from './avisosSala';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import type { Fase } from './useSala';

/** A dónde vuelve «Volver atrás», la fase de antes del último cambio: «la noche 1», «el día 1», «la preparación». */
function nombreFaseAnterior({ momento, numero }: Fase): string | null {
  if (momento === 'preparacion') return null;
  if (momento === 'dia') return `la noche ${numero}`;
  return numero <= 1 ? 'la preparación' : `el día ${numero - 1}`;
}

interface FasePartidaProps {
  fase: Fase;
  /**
   * Narradores: la máquina del tiempo, volver a la partida como estaba justo antes
   * del último cambio de fase (si se han precipitado).
   */
  onVolverAtras?: () => Promise<boolean>;
  /** Narradores: deshacer lo último que cambió la partida, que es esto (en palabras: «la nominación»). */
  deshacer?: { paso: string; hacer: () => Promise<boolean> };
}

/**
 * En la cabecera, a la vista de todos: en qué momento está la partida
 * («Preparación», «Noche 2», «Día 2»), con un icono que no se lee. Los cambios
 * se anuncian aparte (avisosSala). El jugador despertado vuelve a abrir su
 * información de noche desde la luna de su ficha (Plaza).
 *
 * Para el narrador es además un botón con la máquina del tiempo: «Deshacer la
 * nominación» (lo último que cambió la partida) y «Volver a la noche 2» (o al día,
 * o a la preparación). Al elegir, el foco vuelve al botón, que ya dice la fase.
 */
const FasePartida = ({ fase, onVolverAtras, deshacer }: FasePartidaProps) => {
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
  const volver = onVolverAtras && destino ? onVolverAtras : null;
  if (!volver && !deshacer) {
    return (
      <p id="sala-fase" tabIndex={-1} className={`${clases} focus:outline-none`}>
        {contenido}
      </p>
    );
  }
  const opciones: OpcionMenu[] = [];
  if (deshacer) {
    opciones.push({
      id: 'deshacer',
      etiqueta: `Deshacer ${deshacer.paso}`,
      elegir: async () => {
        await deshacer.hacer();
        // El menú se cierra y el foco vuelve a la fase
        return false;
      },
    });
  }
  if (volver) {
    opciones.push({
      id: 'volverAtras',
      etiqueta: `Volver a ${destino}`,
      elegir: async () => {
        const ok = await volver();
        // A la preparación, la fase deja de ser un botón (no hay a dónde volver): el foco, a ella
        if (ok && destino === 'la preparación') window.setTimeout(() => document.getElementById('sala-fase')?.focus(), 0);
        // false: el menú se cierra y el foco vuelve a la fase, que ya dice la nueva
        return false;
      },
    });
  }
  return (
    <MenuDesplegable
      id="sala-fase-menu"
      boton={contenido}
      descripcion="Máquina del tiempo"
      ayuda="Máquina del tiempo: deshacer lo último o volver a antes de la fase"
      botonClassName={`${clases} cursor-pointer hover:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main`}
      opciones={opciones}
    />
  );
};

export default FasePartida;
