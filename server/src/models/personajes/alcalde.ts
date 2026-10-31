import { sinRepetir } from './Objetivo';
import { droison, type ReglaPersonaje } from './ReglaPersonaje';

/** Con cuántos vivos gana el Alcalde si el día acaba sin ejecución. */
const VIVOS_ALCALDE = 3;

/**
 * Alcalde (Mayor): sano, si un demonio lo mata, la muerte puede rebotar a otro
 * jugador vivo (no al demonio): lo decide el narrador. Rebotada, a ese le llega
 * como a él (protegido, no muere nadie). Si el día acaba sin ejecución con tres
 * vivos (el demonio, uno), él vivo y sano, gana el bien.
 */
export const alcalde: ReglaPersonaje = {
  personaje: 'mayor',
  alterarObjetivo: (ctx, jugador, base) =>
    ctx.identidad(jugador) === 'mayor' && !droison(ctx, jugador)
      ? {
          recibe: (accion) => {
            if (accion.origen !== 'demonio' || accion.efecto !== 'matar' || accion.rebote) return base.recibe(accion);
            const otros = ctx
              .plaza()
              .filter((a) => a.id !== jugador.id && !a.muerto && !a.muertePendiente && ctx.identidad(a) !== accion.personaje);
            return sinRepetir([...base.recibe(accion), ...otros.flatMap((a) => ctx.objetivo(a).recibe({ ...accion, rebote: true }))]);
          },
        }
      : base,
  ganador: (ctx, { vivos, sinEjecucion, hayDemonio }) =>
    sinEjecucion && hayDemonio && vivos.length === VIVOS_ALCALDE && vivos.some((a) => ctx.identidad(a) === 'mayor' && !droison(ctx, a))
      ? 'bueno'
      : undefined,
};
