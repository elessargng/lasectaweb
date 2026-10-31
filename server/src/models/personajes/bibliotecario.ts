import type { ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import { SenalaDosJugadores } from '../partida/habilidades/SenalaDosJugadores';

/** El Bibliotecario: sin forasteros en juego (ni quien pueda registrar como forastero), «cero». */
class Bibliotecario extends SenalaDosJugadores {
  constructor() {
    super('librarian', 'Outsider', 'outsider');
  }

  protected ninguno(ctx: ContextoNoche): boolean {
    return !ctx.plaza().some((a) => ctx.percepcion(a).esForastero().includes(true));
  }
}
export const bibliotecario = new Bibliotecario();
