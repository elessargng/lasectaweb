import { Camera } from 'lucide-react';
import type { Ritual } from '../../utils/ritualsApi';

/** Si el evento tiene fotos que puede ver quien mira. */
const tieneFotos = (ritual: Ritual) => (ritual.photos?.length ?? 0) > 0;

/**
 * El aviso de que hay fotos subidas del evento, dentro del botón que lo abre: la cámara
 * con su etiqueta al pasar el ratón (data-tip) y, para el lector, «, con fotos» al final
 * del nombre del botón.
 */
export const ConFotos = ({ ritual, className = '' }: { ritual: Ritual; className?: string }) =>
  tieneFotos(ritual) ? (
    <>
      <span aria-hidden="true" data-tip="Hay fotos del evento" className={`inline-flex shrink-0 text-theme-main ${className}`}>
        <Camera className="w-3.5 h-3.5" />
      </span>
      <span className="sr-only">, con fotos</span>
    </>
  ) : null;

export default ConFotos;
