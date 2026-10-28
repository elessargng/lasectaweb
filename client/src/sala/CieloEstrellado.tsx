import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Galaxy from '../components/Galaxy';
import { propsGalaxy, type AjustesCielo } from './cielo';

/**
 * El cielo estrellado de la noche, detrás de toda la sala (encima del fondo y de
 * su velo de medianoche, ver sala.css): el Galaxy de React Bits, con estrellas
 * que parpadean y giran despacio, como las haya elegido cada uno (ver cielo.ts).
 * Entra y sale fundiéndose; sin noche, no se dibuja (y suelta el WebGL). No
 * responde al ratón ni a los clics, que son para la partida. Con «reducir
 * movimiento», las estrellas se quedan quietas (lo hace Galaxy). Decorativo:
 * fuera del árbol de accesibilidad.
 */
const CieloEstrellado = ({ activo, ajustes }: { activo: boolean; ajustes: AjustesCielo }) => {
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
      <Galaxy {...propsGalaxy(ajustes)} />
    </div>,
    document.body,
  );
};

export default CieloEstrellado;
