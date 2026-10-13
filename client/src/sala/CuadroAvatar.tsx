import type { ReactNode } from 'react';
import { getAvatarUrl } from '../utils/api';

interface CuadroAvatarProps {
  /** Rótulo encima del cuadro («Narrador»). Solo visual: quien lo use lo dice en el pie para el lector. */
  titulo?: string;
  /** Ruta del avatar; sin él, el cuadro queda vacío. */
  imagen?: string | null;
  /** Sustituye a la imagen (un aviso, y más adelante la cámara del usuario). */
  contenido?: ReactNode;
  /** Debajo del cuadro, normalmente el nombre. */
  pie?: ReactNode;
  /** Cuadro sin nadie: borde discontinuo. */
  vacio?: boolean;
}

/**
 * El cuadro de un participante en la sala: título opcional, el cuadro (avatar o
 * contenido) y un pie. Su lado es la variable CSS --sala-avatar, que fija la
 * sala con la preferencia de cada usuario (Preferencias > Interfaz).
 *
 * La imagen no se lee (alt vacío): el pie dice de quién es.
 */
const CuadroAvatar = ({ titulo, imagen, contenido, pie, vacio = false }: CuadroAvatarProps) => (
  <div className="w-[var(--sala-avatar,10rem)]">
    {titulo && (
      <p aria-hidden="true" className="mb-1 truncate text-center text-xs font-semibold uppercase tracking-wide text-theme-main">
        {titulo}
      </p>
    )}
    <div
      className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded ${
        vacio ? 'border border-dashed border-outline-ghost p-2' : 'border border-theme-main bg-surface'
      }`}
    >
      {contenido ?? (imagen && <img src={getAvatarUrl(imagen)} alt="" className="h-full w-full object-cover" />)}
    </div>
    {pie}
  </div>
);

export default CuadroAvatar;
