import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Ladrón: el voto de quien lleva su recordatorio resta. */
const regla: ReglaPersonaje = {
  personaje: 'thief',
  multiplicaVoto: (_ctx, jugador) => (tieneRecordatorio(jugador, 'thief') ? -1 : 1),
};

export const ladron: DefinicionPersonaje = { regla };
