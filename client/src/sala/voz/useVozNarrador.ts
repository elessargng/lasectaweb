import { useEffect, useState, useSyncExternalStore } from 'react';
import { crearVozNarrador } from '.';

/**
 * La voz del narrador virtual para la sala: la neuronal se activa o se desactiva
 * según la preferencia, y se puede consultar en qué está (para la pestaña que la activa).
 */
export function useVozNarrador(neuronal: boolean) {
  const [voz] = useState(crearVozNarrador);
  const estado = useSyncExternalStore(voz.suscribir, voz.consultar);

  useEffect(() => {
    void voz.usarNeuronal(neuronal);
  }, [voz, neuronal]);

  // Al salir de la sala, nada sigue sonando
  useEffect(() => () => voz.callar(), [voz]);

  return { voz, estado };
}
