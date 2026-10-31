import type { HabilidadNocturna } from './HabilidadNocturna';
import { demonios, esbirros } from './malvados';
import { adivina } from '../../personajes/adivina';
import { bibliotecario } from '../../personajes/bibliotecario';
import { camarera } from '../../personajes/camarera';
import { chef } from '../../personajes/chef';
import { cuervero } from '../../personajes/cuervero';
import { empatico } from '../../personajes/empatico';
import { enterradorDeNoche } from '../../personajes/enterrador';
import { envenenador } from '../../personajes/envenenador';
import { espia } from '../../personajes/espia';
import { imp } from '../../personajes/imp';
import { investigador } from '../../personajes/investigador';
import { lavandera } from '../../personajes/lavandera';
import { mayordomo } from '../../personajes/mayordomo';
import { monje } from '../../personajes/monje';
import { mujerEscarlata } from '../../personajes/mujerEscarlata';
import { relojero } from '../../personajes/relojero';
import { sabio } from '../../personajes/sabio';

/** Las habilidades de noche de Trouble Brewing. */
const TROUBLE_BREWING: readonly HabilidadNocturna[] = [
  esbirros,
  demonios,
  envenenador,
  monje,
  mayordomo,
  imp,
  adivina,
  cuervero,
  lavandera,
  bibliotecario,
  investigador,
  chef,
  empatico,
  enterradorDeNoche,
  espia,
  mujerEscarlata,
];

/**
 * Las de No Greater Joy (para 5 o 6 jugadores): las de Trouble Brewing que trae y
 * las del Relojero, la Camarera y el Sabio. El Artista y el Patoso actúan de día
 * (ver models/personajes/DeclaracionDia); el Borracho y el Barón, al preparar.
 */
const NO_GREATER_JOY: readonly HabilidadNocturna[] = [esbirros, demonios, imp, mujerEscarlata, investigador, empatico, relojero, camarera, sabio];

/**
 * Las habilidades de noche de cada guion, por su id de predeterminado. Solo
 * Trouble Brewing y No Greater Joy, de momento: en otros guiones hay personajes que
 * cambian las reglas (el Vortox, la Marioneta…) y se despierta a mano. Un guion
 * nuevo es una entrada más; cada habilidad está en el archivo de su personaje
 * (models/personajes).
 */
const POR_EDICION: Record<string, readonly HabilidadNocturna[]> = {
  troublebrewing: TROUBLE_BREWING,
  nogreaterjoy: NO_GREATER_JOY,
};

/** Las habilidades de noche de un guion (por su edición), por personaje; ninguna si no las tiene. */
export function habilidadesDelGuion(edicion: string | null): ReadonlyMap<string, HabilidadNocturna> {
  return new Map((edicion ? (POR_EDICION[edicion] ?? []) : []).map((h) => [h.personaje, h]));
}
