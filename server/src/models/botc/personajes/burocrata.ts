import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Burócrata: el voto de quien lleva su recordatorio vale por tres. */
const regla: ReglaPersonaje = {
  personaje: 'bureaucrat',
  multiplicaVoto: (_ctx, jugador) => (tieneRecordatorio(jugador, 'bureaucrat') ? 3 : 1),
};

export const burocrata: DefinicionPersonaje = { regla };
