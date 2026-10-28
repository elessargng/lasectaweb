import { FICHAS_DESPERTAR, type SalaEnvioDespertar } from '../../../contrato/sala';
import type { PersonajeDeGuion } from '../../../types/guiones';
import { ficha, numero, type ContextoNoche, type HabilidadNocturna } from '../../partida/habilidades/HabilidadNocturna';

/** Los números en fichas, por orden (cero, uno…). */
const FICHAS_NUMERO = FICHAS_DESPERTAR.slice(FICHAS_DESPERTAR.indexOf('cero'), FICHAS_DESPERTAR.indexOf('cinco') + 1);

/** El número de un mensaje (su ficha o, más de cinco, su texto), o null si no lo es. */
function numeroDe(envio: SalaEnvioDespertar): number | null {
  const enFicha = envio.ficha ? FICHAS_NUMERO.indexOf(envio.ficha) : -1;
  if (enFicha >= 0) return enFicha;
  return envio.ficha === 'personalizado' && envio.texto && /^\d+$/.test(envio.texto) ? Number(envio.texto) : null;
}

/**
 * Una información falsa con la forma de la verdadera, para quien está droison: el
 * «Sí» por el «No» (y al revés), otro número de los que puede dar su habilidad, u
 * otro personaje del tipo que enseña con los mismos jugadores. Null si no se sabe
 * inventar una (entonces va la verdadera).
 */
export function informacionFalsa({
  verdadera,
  habilidad,
  ctx,
  personajes,
  elegirUno,
}: {
  verdadera: SalaEnvioDespertar;
  habilidad: HabilidadNocturna;
  ctx: ContextoNoche;
  /** Los del guion: de entre ellos sale el personaje falso. */
  personajes: readonly PersonajeDeGuion[];
  elegirUno: <T>(opciones: readonly T[]) => T;
}): SalaEnvioDespertar | null {
  if (verdadera.ficha === 'si' || verdadera.ficha === 'no') return ficha(verdadera.ficha === 'si' ? 'no' : 'si');

  const n = numeroDe(verdadera);
  if (n !== null) {
    const maximo = habilidad.maximoNumero?.(ctx);
    if (maximo === undefined) return null;
    const otros = Array.from({ length: maximo + 1 }, (_, i) => i).filter((i) => i !== n);
    return otros.length ? numero(elegirUno(otros)) : null;
  }

  if (verdadera.tarjeta === 'esteJugadorEs' && verdadera.personajes.length === 1) {
    const [real] = verdadera.personajes;
    const otros = personajes.filter(
      (p) => p.id !== real && p.tipo !== 'traveller' && (habilidad.tipoEnsenado ? p.tipo === habilidad.tipoEnsenado : p.tipo !== 'desconocido'),
    );
    return otros.length ? { ...verdadera, personajes: [elegirUno(otros).id] } : null;
  }
  return null;
}
