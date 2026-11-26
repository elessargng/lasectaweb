import { useEffect, useState, useSyncExternalStore } from 'react';
import { crearVozNarrador } from '.';

/**
 * La voz del narrador virtual para la sala: la neuronal elegida (`vozNeuronal`;
 * null, la del navegador) según las preferencias, y en qué está (para la pestaña que la activa).
 */
export function useVozNarrador(vozNeuronal: string | null) {
  const [voz] = useState(crearVozNarrador);
  const estado = useSyncExternalStore(voz.suscribir, voz.consultar);

  useEffect(() => {
    void voz.usarNeuronal(vozNeuronal);
  }, [voz, vozNeuronal]);

  // Al salir de la sala, nada sigue sonando
  useEffect(() => () => voz.callar(), [voz]);

  return { voz, estado };
}
