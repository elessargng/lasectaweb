import { droison, lleva, tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * Bufón (Fool): sano, la primera vez que iba a morir (de lo que sea) no muere y
 * gasta su habilidad: se le pone su «No Ability», que es lo que recuerda que ya la gastó.
 */
const regla: ReglaPersonaje = {
  personaje: 'fool',
  alterarObjetivo: (ctx, jugador, base) =>
    lleva(ctx, jugador, 'fool') && !droison(ctx, jugador) && !tieneRecordatorio(jugador, 'fool', /^no ability$/i)
      ? {
          recibe: (accion) =>
            accion.efecto === 'matar' ? [{ a: null, gasta: { asiento: jugador.id, personaje: 'fool', texto: 'No Ability' } }] : base.recibe(accion),
        }
      : base,
};

export const bufon: DefinicionPersonaje = { regla };
