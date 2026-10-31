import { SenalaDosJugadores } from '../partida/habilidades/SenalaDosJugadores';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** La Lavandera: uno de dos jugadores es un aldeano (ver SenalaDosJugadores). */
const deNoche = new SenalaDosJugadores('washerwoman', 'Townsfolk', 'townsfolk');

export const lavandera: DefinicionPersonaje = { deNoche };
