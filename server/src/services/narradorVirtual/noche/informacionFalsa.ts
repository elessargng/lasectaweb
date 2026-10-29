import { FICHAS_DESPERTAR, type SalaEnvioDespertar } from '../../../contrato/sala';
import type { PersonajeDeGuion } from '../../../types/guiones';
import { ficha, numero, type ContextoNoche, type HabilidadNocturna } from '../../partida/habilidades/HabilidadNocturna';

/** Los números en fichas, por orden (cero, uno…). */
const FICHAS_NUMERO = FICHAS_DESPERTAR.slice(FICHAS_DESPERTAR.indexOf('cero'), FICHAS_DESPERTAR.indexOf('cinco') + 1);

/** El número de un mensaje (su ficha o, más de cinco, su texto), o null si no lo es. */
export function numeroDe(envio: SalaEnvioDespertar): number | null {
  const enFicha = envio.ficha ? FICHAS_NUMERO.indexOf(envio.ficha) : -1;
  if (enFicha >= 0) return enFicha;
  return envio.ficha === 'personalizado' && envio.texto && /^\d+$/.test(envio.texto) ? Number(envio.texto) : null;
}

/**
 * Las informaciones falsas con la forma de la verdadera, para quien está droison:
 * el «Sí» por el «No» (y al revés), los otros números que puede dar su habilidad,
 * u otros personajes del tipo que enseña con los mismos jugadores. Vacío si no se
 * sabe inventar ninguna (entonces va la verdadera). Cuál se da, lo decide el narrador.
 */
export function informacionesFalsas({
  verdadera,
  habilidad,
  ctx,
  personajes,
}: {
  verdadera: SalaEnvioDespertar;
  habilidad: HabilidadNocturna;
  ctx: ContextoNoche;
  /** Los del guion: de entre ellos sale el personaje falso. */
  personajes: readonly PersonajeDeGuion[];
}): SalaEnvioDespertar[] {
  if (verdadera.ficha === 'si' || verdadera.ficha === 'no') return [ficha(verdadera.ficha === 'si' ? 'no' : 'si')];

  const n = numeroDe(verdadera);
  if (n !== null) {
    const maximo = habilidad.maximoNumero?.(ctx);
    if (maximo === undefined) return [];
    return Array.from({ length: maximo + 1 }, (_, i) => i)
      .filter((i) => i !== n)
      .map(numero);
  }

  if (verdadera.tarjeta === 'esteJugadorEs' && verdadera.personajes.length === 1) {
    const [real] = verdadera.personajes;
    return personajes
      .filter((p) => p.id !== real && p.tipo !== 'traveller' && (habilidad.tipoEnsenado ? p.tipo === habilidad.tipoEnsenado : p.tipo !== 'desconocido'))
      .map((p) => ({ ...verdadera, personajes: [p.id] }));
  }
  return [];
}
