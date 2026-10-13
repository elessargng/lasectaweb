import CuadroAvatar from './CuadroAvatar';
import { idNombreNarrador } from './ids';
import type { SalaParticipante } from './useSala';

interface CuadroNarradorProps {
  narrador: SalaParticipante;
  esYo: boolean;
}

/**
 * El cuadro de un narrador: su avatar con «Narrador» encima y su nombre debajo.
 * El rótulo de encima no se lee; el nombre lleva «Narrador:» oculto en pantalla,
 * así se oye todo junto («Narrador: Ana») y es lo que lee al llevarle el foco.
 */
const CuadroNarrador = ({ narrador, esYo }: CuadroNarradorProps) => (
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
);

export default CuadroNarrador;
