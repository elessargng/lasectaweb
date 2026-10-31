import { oTambien } from './Percepcion';
import { droison, type ReglaPersonaje } from './ReglaPersonaje';

/** Alcalde (Mayor): sano, si un demonio lo mata, la muerte puede rebotar a otro (lo decide el narrador). */
export const alcalde: ReglaPersonaje = {
  personaje: 'mayor',
  alterarAnteElDemonio: (ctx, jugador, base) =>
    ctx.identidad(jugador) === 'mayor' && !droison(ctx, jugador)
      ? { atacado: (ataque) => (ataque.efecto === 'matar' ? oTambien(base.atacado(ataque), ['rebota']) : base.atacado(ataque)) }
      : base,
};
