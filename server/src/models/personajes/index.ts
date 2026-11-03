import type { PoderBolsa } from '../partida/Bolsa';
import { aeronauta } from './aeronauta';
import { artista } from './artista';
import { baron } from './baron';
import { borracho } from './borracho';
import { centinela } from './centinela';
import type { DeclaracionDia } from './DeclaracionDia';
import { ermitano } from './ermitano';
import { exterminador } from './exterminador';
import { fangGu } from './fangGu';
import { kazali } from './kazali';
import { lordOfTyphon } from './lordOfTyphon';
import { marioneta } from './marioneta';
import { padrino } from './padrino';
import { patoso } from './patoso';
import { vigormortis } from './vigormortis';
import { xaan } from './xaan';

/**
 * Las declaraciones del día con narrador virtual. Un personaje nuevo con la suya
 * es un archivo más y una línea aquí: las acciones de la sala (`jugador:<id>`) y el
 * servicio del narrador virtual las recorren sin saber de ninguna.
 */
export const DECLARACIONES_DIA: readonly DeclaracionDia[] = [exterminador, patoso, artista].flatMap((p) => p.deDia ?? []);

/**
 * Lo que cambia cada personaje de la bolsa, por su id (ver partida/Bolsa). Un
 * personaje nuevo que la cambie es un archivo más y una línea aquí: el poder viaja
 * con el guion y la bolsa lo aplica sin saber de ninguno.
 */
export const PODERES_BOLSA: ReadonlyMap<string, PoderBolsa> = new Map(
  [baron, centinela, vigormortis, fangGu, aeronauta, ermitano, padrino, xaan, kazali, lordOfTyphon, borracho, marioneta]
    .flatMap((p) => p.bolsa ?? [])
    .map(({ personaje, ...poder }) => [personaje, poder]),
);
