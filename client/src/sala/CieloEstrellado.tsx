import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Galaxy from '../components/Galaxy';

/** Blancas casi todas; alguna azulada y alguna dorada, como en un cielo de verdad. */
const COLORES = ['#ffffff', '#ffffff', '#c8dcff', '#ffd6a0'];

/**
 * El cielo estrellado de la noche, detrás de toda la sala (encima del fondo y de
 * su velo de medianoche, ver sala.css): el Galaxy de React Bits, con estrellas
 * que parpadean y giran despacio. Entra y sale fundiéndose; sin noche, no se
 * dibuja (y suelta el WebGL). No responde al ratón ni a los clics, que son para
 * la partida. Con «reducir movimiento», las estrellas se quedan quietas (lo hace
 * Galaxy). Decorativo: fuera del árbol de accesibilidad.
 */
const CieloEstrellado = ({ activo }: { activo: boolean }) => {
  // Sigue dibujando mientras se funde al salir (1 s), luego se para
  const [dibujando, setDibujando] = useState(activo);
  // Al llegar la noche, ya (durante el render, sin esperar a un efecto)
  if (activo && !dibujando) setDibujando(true);
  useEffect(() => {
    if (activo) return;
    const t = window.setTimeout(() => setDibujando(false), 1100);
    return () => window.clearTimeout(t);
  }, [activo]);

  if (!dibujando) return null;

  // En el body, fuera de las capas de la sala: así queda detrás de todo (y delante del velo)
  return createPortal(
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-1 transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
        activo ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <Galaxy
        transparent
        starColors={COLORES}
        density={1}
        starSpeed={0.15}
        speed={0.6}
        rotationSpeed={0.015}
        glowIntensity={0.3}
        twinkleIntensity={0.5}
        mouseInteraction={false}
        mouseRepulsion={false}
        clickWarp={false}
        intro={false}
      />
    </div>,
    document.body,
  );
};

export default CieloEstrellado;
