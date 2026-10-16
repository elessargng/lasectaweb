import { JuntoAlTexto } from './BotonesContacto';
import type { ReactNode } from 'react';
import { getAvatarUrl } from '../utils/api';

interface CuadroAvatarProps {
  /** Rótulo encima del cuadro («Narrador»). Solo visual: quien lo use lo dice en el pie para el lector. */
  titulo?: string;
  /** Algo junto al rótulo (botones); este sí se lee. */
  junto?: ReactNode;
  /** Ruta del avatar; sin él, el cuadro queda vacío. */
  imagen?: string | null;
  /** Sustituye a la imagen (un aviso, y más adelante la cámara del usuario). */
  contenido?: ReactNode;
  /** Debajo del cuadro, normalmente el nombre. */
  pie?: ReactNode;
  /** Cuadro sin nadie: borde discontinuo. */
  vacio?: boolean;
  /** Jugador muerto: su avatar o su cámara, en escala de grises. */
  apagado?: boolean;
  /**
   * El pie va fuera de la caja del componente, que mide solo el cuadro, para
   * colocarlo por su centro (asientos de la mesa): encima (jugadores, porque
   * debajo van las fichas) o debajo. Sin esto, va debajo dentro de la caja.
   */
  pieFuera?: 'arriba' | 'abajo';
}

/**
 * El cuadro de un participante en la sala: título opcional, el cuadro (avatar o
 * contenido) y un pie. Su lado es la variable CSS --sala-avatar, que fija la
 * sala con la preferencia de cada usuario (Preferencias > Interfaz).
 *
 * La imagen no se lee (alt vacío): el pie dice de quién es.
 */
const CuadroAvatar = ({ titulo, junto, imagen, contenido, pie, vacio = false, apagado = false, pieFuera }: CuadroAvatarProps) => (
  <div className="relative w-[var(--sala-avatar,10rem)]">
    {titulo && (
      <div className="mb-1 text-center leading-none">
        <span aria-hidden="true" className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-gold [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          {titulo}
        </span>
        {/* Pegados al rótulo, sin quitarle sitio (si no caben, se salen por la derecha) */}
        {junto && <JuntoAlTexto>{junto}</JuntoAlTexto>}
      </div>
    )}
    {/* Un marco de retrato con doble filo de latón (sala-retrato); vacío, discontinuo */}
    <div
      data-vacio={vacio}
      className={`sala-retrato flex aspect-square w-full items-center justify-center overflow-hidden rounded-[3px] [&_img]:transition-[filter] [&_img]:duration-700 [&_video]:transition-[filter] [&_video]:duration-700 motion-reduce:[&_img]:transition-none motion-reduce:[&_video]:transition-none ${
        vacio ? 'p-2' : ''
      } ${apagado ? '[&_img]:grayscale [&_video]:grayscale' : ''}`}
    >
      {contenido ?? (imagen && <img src={getAvatarUrl(imagen)} alt="" className="h-full w-full object-cover" />)}
    </div>
    {pieFuera ? (
      <div className={`absolute left-0 w-full ${pieFuera === 'arriba' ? 'bottom-full' : 'top-full'}`}>{pie}</div>
    ) : (
      pie
    )}
  </div>
);

export default CuadroAvatar;
