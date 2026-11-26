import { vivoEnJuego, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** Leviatán: si se ejecuta a más de un bueno, gana el mal (cada bueno ejecutado lleva su recordatorio). */
const regla: ReglaPersonaje = {
  personaje: 'leviathan',
  alEjecutar: (ctx, ejecutado) =>
    ctx.alineamiento(ejecutado) === 'bueno' && vivoEnJuego(ctx, 'leviathan', ejecutado)
      ? { texto: 'Good Player Executed', unico: false }
      : null,
};

export const leviatan: DefinicionPersonaje = { regla };
