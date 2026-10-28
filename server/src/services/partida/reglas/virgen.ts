import { droison, lleva, tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';

/**
 * Virgen (Virgin): la primera vez que la nominan (viva, en su ficha o de verdad)
 * pierde la habilidad (su «No Ability») y, si quien nomina es de verdad un
 * aldeano, se le ejecuta al momento. Droison, o si es el Borracho que se cree
 * Virgen, la pierde igual pero no pasa nada. Un Espía sano puede registrar como
 * aldeano: lo decide el narrador.
 */
export const virgen: ReglaPersonaje = {
  personaje: 'virgin',
  alNominar: (ctx, nominador, nominado, { comoAldeano }) => {
    if (nominado.muerto || !lleva(ctx, nominado, 'virgin') || tieneRecordatorio(nominado, 'virgin', /^no ability$/i)) return null;
    const pierde = { recordatorio: { texto: 'No Ability', unico: false } };
    if (droison(ctx, nominado)) return { ...pierde, ejecutaAlNominador: false };
    const identidad = ctx.identidad(nominador);
    if (identidad === 'spy' && !droison(ctx, nominador)) {
      return comoAldeano === undefined ? { pregunta: 'comoAldeano' } : { ...pierde, ejecutaAlNominador: comoAldeano };
    }
    return { ...pierde, ejecutaAlNominador: !!identidad && ctx.personaje(identidad)?.tipo === 'townsfolk' };
  },
};
