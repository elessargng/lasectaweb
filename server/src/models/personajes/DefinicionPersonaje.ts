import type { HabilidadNocturna } from '../partida/habilidades/HabilidadNocturna';
import type { DeclaracionDia } from './DeclaracionDia';
import type { ReglaPersonaje } from './ReglaPersonaje';

/**
 * Todo lo de un personaje, en su archivo: lo que cambia de las reglas de la
 * partida, su habilidad de noche y su declaración del día. Las listas (Reglas,
 * habilidades/index.ts por guion, DECLARACIONES_DIA) toman de cada uno lo suyo.
 */
export interface DefinicionPersonaje {
  regla?: ReglaPersonaje;
  deNoche?: HabilidadNocturna;
  deDia?: DeclaracionDia;
}
