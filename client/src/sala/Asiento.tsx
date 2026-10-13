import { Armchair } from 'lucide-react';
import CuadroAvatar from './CuadroAvatar';
import { botonPrincipal } from './estilos';
import { idNombreAsiento } from './ids';
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
  /** Mostrar «Levantarse» (es su asiento). */
  puedeLevantarse: boolean;
  onSentarse: () => void;
  onLevantarse: () => void;
}

/**
 * Un asiento de la mesa. Libre: «Asiento N» con una silla vacía. Ocupado: el
 * avatar y el nombre de quien se sienta.
 *
 * El botón (Sentarse o Levantarse) aparece al pasar el ratón o al llegarle el
 * foco con el teclado; en pantallas táctiles, sin ratón, se ve siempre. Para el
 * lector está siempre en su sitio, justo después del nombre del asiento.
 */
const Asiento = ({ id, numero, ocupante, esYo, puedeSentarse, puedeLevantarse, onSentarse, onLevantarse }: AsientoProps) => {
  const boton = ocupante
    ? puedeLevantarse && { texto: 'Levantarse', alPulsar: onLevantarse }
    : puedeSentarse && { texto: 'Sentarse', alPulsar: onSentarse };

  return (
    <div className="group relative">
      <CuadroAvatar
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
          <p id={idNombreAsiento(id)} tabIndex={-1} className="mt-1 text-center text-sm break-words focus:outline-none">
            {ocupante ? (
              <>
                <span className="sr-only">Asiento {numero}: </span>
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
      {boton && (
        // Encima del cuadro, centrado; solo el botón recibe el ratón
        <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-center justify-center">
          <button
            type="button"
            onClick={boton.alPulsar}
            className={`${botonPrincipal} pointer-events-auto px-3 py-1 text-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100`}
          >
            {boton.texto}
            <span className="sr-only"> {ocupante ? `del asiento ${numero}` : `en el asiento ${numero}`}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Asiento;
