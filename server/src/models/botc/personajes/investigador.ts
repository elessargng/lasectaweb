import { SenalaDosJugadores } from '../partida/habilidades/SenalaDosJugadores';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** El Investigador: uno de dos jugadores es un esbirro (ver SenalaDosJugadores). */
const deNoche = new SenalaDosJugadores('investigator', 'Minion', 'minion');

export const investigador: DefinicionPersonaje = { deNoche };
