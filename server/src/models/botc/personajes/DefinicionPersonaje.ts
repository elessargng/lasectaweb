import type { PoderBolsa } from '../partida/Bolsa';
import type { HabilidadNocturna } from '../partida/habilidades/HabilidadNocturna';
import type { DeclaracionDia } from './DeclaracionDia';
import type { ReglaPersonaje } from './ReglaPersonaje';

/**
 * Todo lo de un personaje, en su archivo: lo que cambia de la bolsa, de las
 * reglas de la partida, su habilidad de noche y su declaración del día. Las
 * listas (PODERES_BOLSA, Reglas, HABILIDADES en habilidades/index.ts,
 * DECLARACIONES_DIA) toman de cada uno lo suyo.
 */
export interface DefinicionPersonaje {
  bolsa?: PoderBolsa & { personaje: string };
  regla?: ReglaPersonaje;
  deNoche?: HabilidadNocturna;
  deDia?: DeclaracionDia;
}
