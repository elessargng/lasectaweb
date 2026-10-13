import { Armchair } from 'lucide-react';
import CuadroAvatar from './CuadroAvatar';
import { botonPrincipal } from './estilos';
import { idNombreAsiento } from './ids';
import type { ReactNode } from 'react';
import type { SalaParticipante } from './useSala';

interface AsientoProps {
  id: string;
  /** Su número en la mesa (1 es el de las 12). */
  numero: number;
  /** Quien está sentado, o null si está libre. */
  ocupante: SalaParticipante | null;
  esYo: boolean;
  /** Mostrar «Sentarse» (libre y quien mira puede sentarse). */
  puedeSentarse: boolean;
  onSentarse: () => void;
  /** Asa para mover al jugador (narradores, editando asientos). */
  asa?: ReactNode;
  /** Destino provisional de un movimiento: se resalta. */
  destino?: boolean;
  /**
   * El nombre va debajo del cuadro (asientos de la mitad inferior de la mesa,
   * donde la ficha queda encima, hacia el centro); si no, encima.
   */
  nombreAbajo?: boolean;
}

/**
 * Un asiento de la mesa. Libre: «Asiento N» con una silla vacía. Ocupado: el
 * avatar y el nombre de quien se sienta. El nombre va por fuera del círculo, para
 * no chocar con la ficha, que va hacia el centro: encima del cuadro, o debajo en
 * los asientos de la mitad inferior.
 *
 * Libre, el botón «Sentarse» aparece al pasar el ratón o al llegarle el foco
 * con el teclado; en pantallas táctiles, sin ratón, se ve siempre. Para el
 * lector está siempre en su sitio, justo después del nombre del asiento.
 * Levantarse está en el menú del usuario.
 *
 * Editando asientos, los ocupados llevan un asa para mover al jugador; el
 * destino provisional del movimiento se resalta.
 */
const Asiento = ({ id, numero, ocupante, esYo, puedeSentarse, onSentarse, asa, destino = false, nombreAbajo = false }: AsientoProps) => {
  const sentarse = !ocupante && puedeSentarse;

  return (
    <div className={`group relative rounded ${destino ? 'ring-4 ring-theme-main ring-offset-2 ring-offset-background' : ''}`}>
      {asa}
      <CuadroAvatar
        pieFuera={nombreAbajo ? 'abajo' : 'arriba'}
        imagen={ocupante?.avatar}
        contenido={
          ocupante ? undefined : (
            // Fondo morado para que la silla se distinga del fondo negro de la sala
            <span className="flex h-full w-full items-center justify-center bg-theme-container/60">
              <Armchair className="h-1/2 w-1/2 text-theme-main" strokeWidth={1.5} />
            </span>
          )
        }
        pie={
          <p
            id={idNombreAsiento(id)}
            tabIndex={-1}
            className={`${nombreAbajo ? 'mt-1' : 'mb-1'} text-center text-sm break-words focus:outline-none`}
          >
            {ocupante ? (
              <>
                {/* Solo el número: «3, Ana» (la lista ya dice que son asientos) */}
                <span className="sr-only">{numero}, </span>
                <span className={ocupante.conectado ? 'font-semibold' : 'text-on-surface-muted'}>{ocupante.nombre}</span>
                {esYo && ' (tú)'}
                {!ocupante.conectado && <span className="text-on-surface-muted"> (desconectado)</span>}
              </>
            ) : (
              <>
                Asiento {numero}
                {/* La silla vacía no se lee: se dice aquí */}
                <span className="sr-only">, libre</span>
              </>
            )}
          </p>
        }
      />
      {sentarse && (
        // Encima del cuadro, centrado; solo el botón recibe el ratón
        <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-center justify-center">
          <button
            type="button"
            onClick={onSentarse}
            className={`${botonPrincipal} pointer-events-auto px-3 py-1 text-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100`}
          >
            Sentarse
            <span className="sr-only"> en el asiento {numero}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Asiento;
