import { useEffect, useRef } from 'react';
import { oirNivelVoz } from './nivelVoz';

/**
 * Quien habla, encima del marco del retrato (sala-habla en sala.css): un aro
 * morado nítido cuyo halo crece con el volumen de su voz, una onda que sale de
 * él y, en la esquina, unas barras de volumen. Aparece y se va fundiéndose. Con
 * «reducir movimiento», sin onda y sin vaivén. Decorativo: el lector no lo
 * anuncia.
 *
 * El volumen no pasa por React (cambia muchas veces por segundo): va directo a
 * la variable --nivel del elemento.
 */
const BordeHabla = ({ id, activo }: { id?: string; activo: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !id || !activo) return;
    const quitar = oirNivelVoz(id, (nivel) => el.style.setProperty('--nivel', nivel.toFixed(3)));
    return () => {
      quitar();
      el.style.setProperty('--nivel', '0');
    };
  }, [id, activo]);

  return (
    <div ref={ref} aria-hidden="true" data-activo={activo} className="sala-habla pointer-events-none absolute inset-0 z-[2] rounded-[3px]">
      <span className="sala-habla-barras">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
};

export default BordeHabla;
