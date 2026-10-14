import CuadroAvatar from './CuadroAvatar';
import { botonPrincipal } from './estilos';
import { idNombreNarrador } from './ids';
import type { SalaParticipante } from './useSala';

interface CuadroNarradorProps {
  narrador: SalaParticipante;
  esYo: boolean;
  /**
   * Visitantes: el botón sobre el retrato para pedir ver el grimorio, o
   * «solicitado» (desactivado) mientras el narrador responde.
   */
  grimorio?: { onSolicitar: () => void } | 'solicitado';
}

/**
 * El cuadro de un narrador: su avatar con «Narrador» encima y su nombre debajo.
 * El rótulo de encima no se lee; el nombre lleva «Narrador:» oculto en pantalla,
 * así se oye todo junto («Narrador: Ana») y es lo que lee al llevarle el foco.
 *
 * Un visitante puede pedirle ver su grimorio: el botón aparece sobre el retrato
 * al pasar el ratón o al llegarle el foco (en pantallas táctiles, siempre); para
 * el lector está siempre, justo después del nombre. Pedido, se queda como
 * «Grimorio solicitado» (desactivado) hasta que el narrador responde: así el
 * foco no se pierde y se sabe que está pedido.
 */
const CuadroNarrador = ({ narrador, esYo, grimorio }: CuadroNarradorProps) => (
  <div className="group relative">
    <CuadroAvatar
      titulo="Narrador"
      imagen={narrador.avatar}
      pie={
        <p id={idNombreNarrador(narrador.id)} tabIndex={-1} className="mt-2 text-center font-semibold break-words focus:outline-none">
          <span className="sr-only">Narrador: </span>
          {narrador.nombre}
          {esYo && ' (tú)'}
          {!narrador.conectado && <span className="font-normal text-on-surface-muted"> (desconectado)</span>}
        </p>
      }
    />
    {grimorio && (
      // Sobre el retrato (debajo del rótulo «Narrador»), centrado; solo el botón recibe el ratón
      <div className="pointer-events-none absolute inset-x-0 top-5 flex aspect-square items-center justify-center">
        <button
          type="button"
          onClick={grimorio === 'solicitado' ? undefined : grimorio.onSolicitar}
          aria-disabled={grimorio === 'solicitado'}
          className={`${botonPrincipal} pointer-events-auto px-3 py-1 text-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 motion-reduce:transition-none aria-disabled:cursor-default [@media(hover:none)]:opacity-100`}
        >
          {grimorio === 'solicitado' ? 'Grimorio solicitado' : 'Solicitar grimorio'}
        </button>
      </div>
    )}
  </div>
);

export default CuadroNarrador;
