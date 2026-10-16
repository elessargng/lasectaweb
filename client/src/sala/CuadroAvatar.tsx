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
const CuadroAvatar = ({ titulo, junto, imagen, contenido, pie, vacio = false, pieFuera }: CuadroAvatarProps) => (
  <div className="relative w-[var(--sala-avatar,10rem)]">
    {titulo && (
      <div className="mb-1 text-center leading-none">
        <span aria-hidden="true" className="text-xs font-semibold uppercase tracking-wide text-theme-main">
          {titulo}
        </span>
        {/* Pegados al rótulo, sin quitarle sitio (si no caben, se salen por la derecha) */}
        {junto && <JuntoAlTexto>{junto}</JuntoAlTexto>}
      </div>
    )}
    <div
      className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded ${
        vacio ? 'border border-dashed border-outline-ghost p-2' : 'border border-theme-main bg-surface'
      }`}
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
