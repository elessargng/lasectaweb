import type { ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import { SenalaDosJugadores } from '../partida/habilidades/SenalaDosJugadores';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/** El Bibliotecario: sin forasteros en juego (ni quien pueda registrar como forastero), «cero». */
class Bibliotecario extends SenalaDosJugadores {
  constructor() {
    super('librarian', 'Outsider', 'outsider');
  }

  protected ninguno(ctx: ContextoNoche): boolean {
    return !ctx.plaza().some((a) => ctx.percepcion(a).esForastero().includes(true));
  }
}
const deNoche = new Bibliotecario();

export const bibliotecario: DefinicionPersonaje = { deNoche };
