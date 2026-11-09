import { randomBytes } from 'crypto';
import type { Azar } from '../models/partida/azar';

/** 48 bits al azar entre 2^48: de 0 (incluido) a 1 (sin incluir). */
const PASOS = 2 ** 48;

/** El azar de verdad de la sala, el de crypto (ver models/partida/azar). */
export const azarSeguro: Azar = () => randomBytes(6).readUIntBE(0, 6) / PASOS;
