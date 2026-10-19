import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getAvatarUrl } from '../utils/api';

const MENOS_MOVIMIENTO = '(prefers-reduced-motion: reduce)';

/** Si el sistema pide menos movimiento (y se entera si cambia). */
function useMenosMovimiento(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(MENOS_MOVIMIENTO);
      consulta.addEventListener('change', avisar);
      return () => consulta.removeEventListener('change', avisar);
    },
    () => window.matchMedia(MENOS_MOVIMIENTO).matches,
  );
}

/** Un GIF (subido, o recién elegido y aún sin subir): puede estar animado. */
const esGif = (avatar: string) => /\.gif$/i.test(avatar) || avatar.startsWith('data:image/gif');

/** El primer fotograma de un GIF, quieto, en un canvas que ocupa lo mismo que la imagen. */
const GifQuieto = ({ src, className }: { src: string; className: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const imagen = new Image();
    imagen.onload = () => {
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = imagen.naturalWidth;
      canvas.height = imagen.naturalHeight;
      canvas.getContext('2d')?.drawImage(imagen, 0, 0);
    };
    imagen.src = src;
    return () => {
      imagen.onload = null;
    };
  }, [src]);
  return <canvas ref={ref} aria-hidden="true" className={className} />;
};

/**
 * La imagen de un avatar (decorativa: el nombre va al lado). Los GIF animados se
 * mueven, salvo si el sistema pide menos movimiento: entonces se ve su primer
 * fotograma, quieto (un GIF no se puede parar con CSS).
 */
const ImagenAvatar = ({ avatar, className = 'h-full w-full object-cover' }: { avatar: string | null | undefined; className?: string }) => {
  const menosMovimiento = useMenosMovimiento();
  const src = getAvatarUrl(avatar);
  if (avatar && menosMovimiento && esGif(avatar)) return <GifQuieto src={src} className={className} />;
  return <img src={src} alt="" className={className} />;
};

export default ImagenAvatar;
