import { artista } from './artista';
import type { DeclaracionDia } from './DeclaracionDia';
import { exterminador } from './exterminador';
import { patoso } from './patoso';

/**
 * Las declaraciones del día con narrador virtual. Un personaje nuevo con la suya
 * es un archivo más y una línea aquí: las acciones de la sala (`jugador:<id>`) y el
 * servicio del narrador virtual las recorren sin saber de ninguna.
 */
export const DECLARACIONES_DIA: readonly DeclaracionDia[] = [exterminador, patoso, artista];
