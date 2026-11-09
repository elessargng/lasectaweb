import { useState } from 'react';
import { Eye } from 'lucide-react';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario } from './estilos';
import { IconoLuna } from './IconosJuego';
import type { Alineamiento, ResultadoAccion } from './useSala';

/** Por qué parece acabada la partida: gana un bando según el grimorio, o quedan dos vivos. */
export type FinPropuesto = Alineamiento | 'dosVivos';

const TEXTOS: Record<FinPropuesto, { titulo: string; texto: string }> = {
  dosVivos: {
    titulo: 'Quedan dos jugadores vivos',
    texto: 'La ejecución no lleva a la noche. Si la partida ha terminado, revela el grimorio; si sigue, ve a la noche.',
  },
  bueno: {
    titulo: 'Gana el bando bueno',
    texto: 'Según el grimorio, no queda ningún demonio vivo. Si la partida ha terminado, revela el grimorio; si sigue, ve a la noche.',
  },
  malvado: {
    titulo: 'Gana el bando malo',
    texto: 'Según el grimorio, la ejecución da la victoria al bando malo. Si la partida ha terminado, revela el grimorio; si sigue, ve a la noche.',
  },
};

interface DialogoFinalProps {
  fin: FinPropuesto;
  /** Ir a la noche (la partida sigue). */
  onNoche: () => Promise<ResultadoAccion>;
  /** Revelar el grimorio (la partida termina): abre su diálogo. */
  onRevelar: () => void;
  onCerrar: () => void;
}

/**
 * Tras una ejecución que deja la partida como acabada (dos vivos, o un bando que
 * parece ganar según el grimorio; el servidor no anochece solo): el narrador elige
 * si se va a la noche o se revela el grimorio. Al
 * abrirse se lee el título y la explicación; Escape lo cierra sin hacer nada (se
 * sigue de día y se puede elegir luego desde el menú del narrador).
 */
const DialogoFinal = ({ fin, onNoche, onRevelar, onCerrar }: DialogoFinalProps) => {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const ariaLive = useAriaLive('errores');

  const irANoche = async () => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    const r = await onNoche();
    if (r.ok) return onCerrar();
    setError(r.error);
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-final-titulo"
        describedBy="sala-final-texto"
        className="w-full max-w-md sala-cofre sala-cofre-esquinas p-6"
      >
        <h2 id="sala-final-titulo" className="mb-4 sala-cofre-titulo">
          {TEXTOS[fin].titulo}
        </h2>
        <p id="sala-final-texto" className="mb-4 text-sm text-on-surface-muted">
          {TEXTOS[fin].texto}
        </p>
        <div aria-live={ariaLive}>{error && <p className="mb-4 text-sm text-blood-pale">{error}</p>}</div>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => void irANoche()} aria-disabled={enviando} className={`${botonSecundario} flex items-center gap-2`}>
            <IconoLuna size={16} />
            Ir a la noche
          </button>
          <button type="button" onClick={onRevelar} className={`${botonPrincipal} flex items-center gap-2`}>
            <Eye size={16} />
            Revelar el grimorio
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default DialogoFinal;
