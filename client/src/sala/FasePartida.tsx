import { ClipboardList, Moon, Sun } from 'lucide-react';
import { nombreFase } from './avisosSala';
import type { SalaFase } from './useSala';

/**
 * En la cabecera, a la vista de todos: en qué momento está la partida
 * («Preparación», «Noche 2», «Día 2»), con un icono que no se lee. Los cambios
 * se anuncian aparte (avisosSala). Para un jugador con despertar (`onVerNoche`)
 * es un botón que abre su información de noche.
 */
const FasePartida = ({ fase, onVerNoche }: { fase: SalaFase; onVerNoche?: () => void }) => {
  const Icono = fase.momento === 'noche' ? Moon : fase.momento === 'dia' ? Sun : ClipboardList;
  const clases =
    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-outline-ghost px-3 py-1 text-sm font-semibold text-white';
  const contenido = (
    <>
      <Icono size={16} className={fase.momento === 'dia' ? 'text-amber-300' : 'text-theme-main'} />
      {nombreFase(fase)}
    </>
  );
  // Un jugador con despertar que ha cerrado su ventana la vuelve a abrir desde aquí
  if (onVerNoche) {
    return (
      <button
        type="button"
        onClick={onVerNoche}
        className={`${clases} hover:border-theme-main focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main`}
      >
        {contenido}
        <span className="sr-only">: ver tu información de noche</span>
      </button>
    );
  }
  return <p className={clases}>{contenido}</p>;
};

export default FasePartida;
