import type { VideoTrack } from 'livekit-client';
import { useEffect, useRef } from 'react';

/**
 * La cámara de alguien en su cuadro, llenándolo. Sin sonido (el audio va
 * aparte) y fuera del árbol de accesibilidad: quién es lo dice el nombre del
 * cuadro. La propia se ve en espejo, como en un espejo de verdad.
 */
const VideoPista = ({ pista, espejo = false }: { pista: VideoTrack; espejo?: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pista.attach(el);
    return () => {
      pista.detach(el);
    };
  }, [pista]);
  return (
    <video
      ref={ref}
      aria-hidden="true"
      muted
      autoPlay
      playsInline
      className={`h-full w-full object-cover ${espejo ? '-scale-x-100' : ''}`}
    />
  );
};

export default VideoPista;
