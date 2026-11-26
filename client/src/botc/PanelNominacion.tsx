import { Minus, Plus } from 'lucide-react';
import { hacenFalta } from './avisosSala';
import { botonPrincipal, botonSecundario } from './estilos';
import { ID_CUENTA_ATRAS, ID_REINICIAR } from './ids';

/** Los votos que hacen falta, y cómo cambiarlos. */
export interface VotosNominacion {
  necesarios: number;
  porDefecto: number;
  /** Como mucho, tantos como asientos. */
  maximo: number;
  /** null: volver a los de por defecto. */
  onCambiar: (votos: number | null) => void;
}

/** Lo que toca al acabar la votación (ver useNominacion): marcar, desmarcar (empate) o cerrar. */
export type TrasVotacion = 'marca' | 'desmarcar' | 'cerrar';

/** Lo que toca, dicho: se ve encima de los botones y es la descripción del que toca. */
const TEXTO_TRAS_VOTACION: Record<TrasVotacion, string> = {
  marca: 'Llega a los votos: márcalo.',
  desmarcar: 'Empata con la marca: desmarca.',
  cerrar: 'No llega a los votos: cierra.',
};
const ID_TRAS_VOTACION = 'sala-nominacion-toca';

interface PanelNominacionProps {
  /** El nominado lleva ya la calavera. */
  marcado: boolean;
  /** Es la expulsión de un viajero: no hay calavera (si sale, muere solo). */
  expulsion: boolean;
  /** Se puede arrancar la cuenta atrás (no, si ya se está votando o se ha votado). */
  puedeCuentaAtras: boolean;
  /** Los votos que hacen falta (si el servidor deja cambiarlos). */
  votos: VotosNominacion | null;
  /** Quién lleva ahora la calavera y con cuántos votos (para ver empates), o null. */
  marcaActual: string | null;
  /** Votación secreta (Organ Grinder): se recuerda que los jugadores no ven los votos. */
  secreta: boolean;
  /** Acabada la votación, lo que toca (su botón, en dorado); null mientras no. */
  toca: TrasVotacion | null;
  /** Quitar la calavera a quien la lleve (sale si alguien la lleva). */
  onDesmarcar: (() => void) | null;
  onCuentaAtras: () => void;
  /** Reiniciar la cuenta atrás o la votación en marcha (sale solo mientras lo están). */
  onReiniciar: (() => void) | null;
  onMarca: () => void;
  onCerrar: () => void;
}

/**
 * En el centro de la plaza, para el narrador: lo que se puede hacer con la nominación
 * abierta. Acabada la votación, el botón de lo que toca va en dorado y los demás en azul.
 */
const PanelNominacion = ({
  marcado,
  expulsion,
  puedeCuentaAtras,
  votos,
  marcaActual,
  toca,
  onDesmarcar,
  onCuentaAtras,
  onReiniciar,
  onMarca,
  onCerrar,
  secreta,
}: PanelNominacionProps) => {
  const estilo = (boton: TrasVotacion) => (toca === boton ? botonPrincipal : botonSecundario);
  const descripcion = (boton: TrasVotacion) => (toca === boton ? ID_TRAS_VOTACION : undefined);
  return (
    <div role="group" aria-label={expulsion ? 'Expulsión' : 'Nominación'} className="flex flex-col gap-2">
      {expulsion && (
        <p className="max-w-56 text-center text-sm text-on-surface-muted">
          Expulsión de un viajero: si sale, muere al terminar la votación. Los muertos votan sin gastar su voto.
        </p>
      )}
      {secreta && (
        <p className="max-w-56 text-center text-sm text-on-surface-muted">
          Votación secreta (<span lang="en">Organ Grinder</span>): los jugadores no ven los votos ni las manos de los demás.
        </p>
      )}
      {marcaActual && <p className="max-w-56 text-center text-sm text-on-surface-muted">Marca actual: {marcaActual}</p>}
      {votos && <VotosNecesarios {...votos} />}
      {puedeCuentaAtras && (
        <button id={ID_CUENTA_ATRAS} type="button" onClick={onCuentaAtras} className={`${botonPrincipal} w-full`}>
          Cuenta atrás
        </button>
      )}
      {onReiniciar && (
        <button id={ID_REINICIAR} type="button" onClick={onReiniciar} className={`${botonSecundario} w-full`}>
          Reiniciar
        </button>
      )}
      {toca && (
        <p id={ID_TRAS_VOTACION} className="max-w-56 text-center text-sm font-semibold text-gold-bright">
          {TEXTO_TRAS_VOTACION[toca]}
        </p>
      )}
      {/* Interruptor: pone o quita la calavera al nominado (y cierra la nominación); pulsado si la lleva */}
      {!expulsion && (
        <button
          type="button"
          onClick={onMarca}
          aria-pressed={marcado}
          aria-describedby={descripcion('marca')}
          className={`${estilo('marca')} w-full ${marcado ? 'bg-theme-main text-background' : ''}`}
        >
          Marca
        </button>
      )}
      {onDesmarcar && (
        <button type="button" onClick={onDesmarcar} aria-describedby={descripcion('desmarcar')} className={`${estilo('desmarcar')} w-full`}>
          Desmarcar
        </button>
      )}
      <button type="button" onClick={onCerrar} aria-describedby={descripcion('cerrar')} className={`${estilo('cerrar')} w-full`}>
        Cerrar
      </button>
    </div>
  );
};

/**
 * Los votos que hacen falta, con − y + para cambiarlos y un botón para volver a
 * los de por defecto. Los botones no desaparecen (no se pierde el foco): si no
 * hacen nada, van desactivados. El cambio se anuncia a todos (avisosSala).
 */
const VotosNecesarios = ({ necesarios, porDefecto, maximo, onCambiar }: VotosNominacion) => {
  const cambiar = (votos: number) => onCambiar(votos === porDefecto ? null : votos);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Un voto menos"
          aria-disabled={necesarios <= 1}
          onClick={() => necesarios > 1 && cambiar(necesarios - 1)}
          className={`${botonSecundario} px-2 py-1 aria-disabled:opacity-40`}
        >
          <Minus size={16} />
        </button>
        <p className="min-w-36 text-center font-semibold">{hacenFalta(necesarios)}</p>
        <button
          type="button"
          aria-label="Un voto más"
          aria-disabled={necesarios >= maximo}
          onClick={() => necesarios < maximo && cambiar(necesarios + 1)}
          className={`${botonSecundario} px-2 py-1 aria-disabled:opacity-40`}
        >
          <Plus size={16} />
        </button>
      </div>
      <button
        type="button"
        aria-disabled={necesarios === porDefecto}
        onClick={() => necesarios !== porDefecto && onCambiar(null)}
        className="text-xs text-on-surface-muted underline aria-disabled:no-underline aria-disabled:opacity-60"
      >
        Por defecto: {porDefecto}
      </button>
    </div>
  );
};

export default PanelNominacion;
