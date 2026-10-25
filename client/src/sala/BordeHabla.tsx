import { useEffect, useState } from 'react';
import ElectricBorder from '../components/ElectricBorder';
import { useMenosMovimiento } from './useMenosMovimiento';

/** El morado de la sala (--color-grimorio-bright): quien habla. */
const MORADO = '#a596e6';

/**
 * Segundos que sigue montado tras dejar de hablar: se apaga fundiéndose y, si
 * vuelve a hablar enseguida (las pausas entre frases), no se crea otro WebGL.
 */
const ESPERA_MS = 4000;

/**
 * Quien habla: un borde eléctrico (el ElectricBorder de React Bits) encima del
 * marco del retrato. Se monta solo al hablar, porque cada borde es un WebGL y
 * Chrome no deja tener muchos. No responde al ratón. Con «reducir movimiento»,
 * quieto. Decorativo: el lector no lo anuncia (tampoco lo hacía el aro de antes).
 */
const BordeHabla = ({ activo }: { activo: boolean }) => {
  const [montado, setMontado] = useState(activo);
  if (activo && !montado) setMontado(true);
  useEffect(() => {
    if (activo) return;
    const t = window.setTimeout(() => setMontado(false), ESPERA_MS);
    return () => window.clearTimeout(t);
  }, [activo]);
  const quieto = useMenosMovimiento();

  if (!montado) return null;
  return (
    <ElectricBorder
      active={activo}
      color={MORADO}
      borderRadius={3}
      offset={1}
      thickness={1.2}
      chaos={0.4}
      spread={0.5}
      strands={3}
      glow={0.7}
      intensity={0.9}
      arcs={quieto ? 0 : 1}
      speed={quieto ? 0 : 1}
      interactive={false}
      className="pointer-events-none z-[2]"
      style={{ position: 'absolute', inset: 0 }}
    />
  );
};

export default BordeHabla;
