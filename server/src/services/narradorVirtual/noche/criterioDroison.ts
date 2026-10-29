import type { SalaEnvioDespertar } from '../../../contrato/sala';
import type { SalaService } from '../../SalaService';
import type { Opcion, RasgoOpcion } from '../estrategias/EstrategiaNarrador';
import { describirEnvio } from '../grimorio';
import { tipoReal, vivo } from '../mesaDeJuego';
import { cronicaNueva, type Cronica } from '../final/cronica';
import { numeroDe } from './informacionFalsa';

/**
 * Cómo da la información un narrador a un rol de información envenenado o
 * borracho. Puede mentir, y la costumbre es que la mentira sea creíble, sirva al
 * mal y no deje la partida sin solución:
 * - si la verdad no le cuesta nada al mal (un 0, un «No»…), decirla a menudo
 *   esconde el veneno;
 * - si la verdad destapa a un malvado, casi nunca;
 * - según cómo vaya la partida: si va ganando el mal, algo más de verdad (que el
 *   bien no se hunda);
 * - coherente con lo que ya se le dijo: a lo mismo, lo mismo;
 * - de las mentiras, las creíbles (un número a un paso de la verdad), las que
 *   confirman el farol de un malvado y las que inculpan a un bueno.
 */

/** Lo que se le ha dado a cada uno droison (para ser coherente), por `asiento:personaje`. */
export interface RecuerdosNarrador {
  droison: Map<string, { verdadera: SalaEnvioDespertar; dada: SalaEnvioDespertar }>;
  /** Lo que ha pasado en la partida, para contarlo al revelar el grimorio. */
  cronica: Cronica;
}

export const recuerdosNuevos = (): RecuerdosNarrador => ({ droison: new Map(), cronica: cronicaNueva() });

const clave = (asiento: string, personaje: string) => `${asiento}:${personaje}`;

const forma = (e: SalaEnvioDespertar) => JSON.stringify([e.ficha, e.tarjeta, e.jugadores, e.personajes, e.texto]);
export const mismoEnvio = (a: SalaEnvioDespertar, b: SalaEnvioDespertar) => forma(a) === forma(b);

const tipoMalvado = (sala: SalaService, personaje: string) => ['minion', 'demon'].includes(sala.personaje(personaje)?.tipo ?? '');

/** Si una información señala al mal: un número mayor que cero, un «Sí», o enseña a un esbirro o un demonio. */
export function destapaAlMal(sala: SalaService, envio: SalaEnvioDespertar): boolean {
  const n = numeroDe(envio);
  if (n !== null) return n > 0;
  if (envio.ficha === 'si' || envio.ficha === 'no') return envio.ficha === 'si';
  return envio.personajes.some((p) => tipoMalvado(sala, p));
}

/** Cómo va el mal: los malvados vivos sobre los vivos, menos los del principio (positivo: va ganando). */
export function ventajaDelMal(sala: SalaService): number {
  const jugadores = sala.asientos().filter((a) => tipoReal(sala, a) !== 'traveller');
  const malvado = (a: (typeof jugadores)[number]) => sala.alineamientoEfectivo(a) === 'malvado';
  const vivos = jugadores.filter(vivo);
  if (!vivos.length || !jugadores.length) return 0;
  return vivos.filter(malvado).length / vivos.length - jugadores.filter(malvado).length / jugadores.length;
}

const entre = (min: number, max: number, x: number) => Math.min(max, Math.max(min, x));

/** La probabilidad de decirle la verdad a quien está droison. */
export function probabilidadVerdad(sala: SalaService, asiento: string, personaje: string, verdadera: SalaEnvioDespertar, recuerdos: RecuerdosNarrador): number {
  // A lo mismo que otra noche, lo mismo: si entonces fue la verdad, otra vez; si fue mentira, otra vez mentira
  const antes = recuerdos.droison.get(clave(asiento, personaje));
  if (antes && mismoEnvio(antes.verdadera, verdadera)) return mismoEnvio(antes.dada, verdadera) ? 0.95 : 0.05;
  const ventaja = ventajaDelMal(sala);
  return destapaAlMal(sala, verdadera) ? entre(0.05, 0.4, 0.05 + Math.max(0, ventaja) * 2) : entre(0.3, 0.7, 0.5 + ventaja);
}

/** Las informaciones falsas como opciones, con sus rasgos y lo que pesan al azar. */
export function opcionesFalsas(
  sala: SalaService,
  asiento: string,
  personaje: string,
  verdadera: SalaEnvioDespertar,
  falsas: SalaEnvioDespertar[],
  recuerdos: RecuerdosNarrador,
): Opcion<SalaEnvioDespertar>[] {
  const antes = recuerdos.droison.get(clave(asiento, personaje));
  const n = numeroDe(verdadera);
  const asientos = sala.asientos();
  return falsas.map((f, i) => {
    const rasgos: RasgoOpcion[] = [];
    let peso = 1;
    // La misma mentira que otra noche, a lo mismo
    if (antes && mismoEnvio(antes.verdadera, verdadera) && mismoEnvio(antes.dada, f)) {
      rasgos.push('verosimil');
      peso *= 20;
    }
    const m = numeroDe(f);
    if (n !== null && m !== null && Math.abs(m - n) === 1) {
      rasgos.push('verosimil');
      peso *= 3;
    }
    const [ensenado] = f.personajes;
    const jugadores = f.jugadores.flatMap((id) => asientos.find((a) => a.id === id) ?? []);
    if (ensenado && jugadores.some((a) => sala.alineamientoEfectivo(a) === 'malvado' && a.farolEnUso === ensenado)) {
      rasgos.push('confirmaFarol');
      peso *= 6;
    }
    if (ensenado && tipoMalvado(sala, ensenado) && jugadores.some((a) => sala.alineamientoEfectivo(a) !== 'malvado')) {
      rasgos.push('inculpaABueno');
      peso *= 2;
    }
    return { clave: `f${i + 1}`, descripcion: describirEnvio(sala, f), valor: f, peso, ...(rasgos.length ? { rasgos: [...new Set(rasgos)] } : {}) };
  });
}

/** Apunta lo que se le ha dado (para ser coherente las noches siguientes). */
export function recordarDroison(recuerdos: RecuerdosNarrador, asiento: string, personaje: string, verdadera: SalaEnvioDespertar, dada: SalaEnvioDespertar): void {
  recuerdos.droison.set(clave(asiento, personaje), { verdadera, dada });
  if (!mismoEnvio(verdadera, dada)) recuerdos.cronica.falsas.add(asiento);
}
