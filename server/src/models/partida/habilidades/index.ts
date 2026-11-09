import type { HabilidadNocturna } from './HabilidadNocturna';
import type { DefinicionPersonaje } from '../../personajes/DefinicionPersonaje';
import { demonios, esbirros } from './malvados';
import { adivina } from '../../personajes/adivina';
import { bibliotecario } from '../../personajes/bibliotecario';
import { camarera } from '../../personajes/camarera';
import { chef } from '../../personajes/chef';
import { cuervero } from '../../personajes/cuervero';
import { empatico } from '../../personajes/empatico';
import { enterrador } from '../../personajes/enterrador';
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

/** Las de noche de esos personajes, en ese orden. */
const deNoche = (...personajes: DefinicionPersonaje[]): HabilidadNocturna[] => personajes.flatMap((p) => p.deNoche ?? []);

/**
 * Todas las habilidades de noche hechas, una por personaje (Esbirros y Demonios,
 * la información de los malvados, como dos más). Un personaje nuevo con la suya es
 * un archivo más y una línea aquí (ver models/personajes).
 */
const HABILIDADES: readonly HabilidadNocturna[] = [
  esbirros,
  demonios,
  ...deNoche(
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
    enterrador,
    espia,
    mujerEscarlata,
    relojero,
    camarera,
    sabio,
  ),
];

/**
 * Las habilidades de noche de un guion: las de los personajes que trae (venga de
 * un predeterminado o de un JSON: solo cuenta su lista), y la información de los
 * malvados. Los personajes sin la suya hecha se despiertan a mano.
 */
export function habilidadesDelGuion(personajes: readonly string[]): ReadonlyMap<string, HabilidadNocturna> {
  const enGuion = new Set(personajes);
  return new Map(HABILIDADES.filter((h) => h === esbirros || h === demonios || enGuion.has(h.personaje)).map((h) => [h.personaje, h]));
}
