import { ClipboardList, Moon, Sun } from 'lucide-react';
import { nombreFase } from './avisosSala';
import type { SalaFase } from './useSala';

/**
 * En la cabecera, a la vista de todos: en qué momento está la partida
 * («Preparación», «Noche 2», «Día 2»), con un icono que no se lee. Los cambios
 * se anuncian aparte (avisosSala).
 */
const FasePartida = ({ fase }: { fase: SalaFase }) => {
  const Icono = fase.momento === 'noche' ? Moon : fase.momento === 'dia' ? Sun : ClipboardList;
  return (
    <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-outline-ghost px-3 py-1 text-sm font-semibold text-white">
      <Icono size={16} className={fase.momento === 'dia' ? 'text-amber-300' : 'text-theme-main'} />
      {nombreFase(fase)}
    </p>
  );
};

export default FasePartida;
