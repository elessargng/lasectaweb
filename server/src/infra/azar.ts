import { randomInt } from 'crypto';
import type { Azar } from '../models/partida/azar';

const PASOS = 2 ** 48;

/** El azar de verdad de la sala, el de crypto (ver models/partida/azar). */
export const azarSeguro: Azar = () => randomInt(PASOS) / PASOS;
