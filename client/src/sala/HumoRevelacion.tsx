import { useImperativeHandle, useRef, type Ref } from 'react';
import { createPortal } from 'react-dom';
import SplashCursor, { type SplashCursorHandle } from '../components/SplashCursor';
import type { SalaAlineamiento } from './useSala';

export interface HumoRevelacionHandle {
  /** Una bocanada de humo sobre el elemento (la ficha), del color de su bando. */
  soltar: (ancla: HTMLElement, alineamiento: SalaAlineamiento) => void;
}

/** El humo de cada bando: azul el bueno, rojo el malvado (el segundo, el de los bordes). */
const COLORES: Record<SalaAlineamiento, string[]> = {
  bueno: ['#3b82f6', '#93c5fd'],
  malvado: ['#dc2626', '#f87171'],
};

/**
 * Revelando el grimorio: al darse la vuelta una ficha suelta un humillo del color
 * de su bando, que sube y se deshace (el SplashCursor de React Bits, sin seguir al
 * ratón). Por encima de toda la pantalla y sin recibir el ratón; solo dibuja
 * mientras queda humo. Quien lo usa no lo monta si se pide menos movimiento.
 */
const HumoRevelacion = ({ ref }: { ref?: Ref<HumoRevelacionHandle> }) => {
  const humo = useRef<SplashCursorHandle>(null);
  useImperativeHandle(
    ref,
    () => ({
      soltar: (ancla, alineamiento) => {
        const r = ancla.getBoundingClientRect();
        humo.current?.splash(r.left + r.width / 2, r.top + r.height / 2, { colors: COLORES[alineamiento], rise: 0.15 });
      },
    }),
    [],
  );
  return createPortal(
    <SplashCursor
      ref={humo}
      followPointer={false}
      clickSplash={false}
      intro={false}
      rainbow={false}
      quality="medium"
      size={0.6}
      intensity={0.65}
      force={0.15}
      swirl={8}
      trail={1.6}
      momentum={0.9}
      shading={0}
      zIndex={30}
    />,
    document.body,
  );
};

export default HumoRevelacion;
