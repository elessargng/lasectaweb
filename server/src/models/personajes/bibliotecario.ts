import { dudoso, tipoDe, type ContextoNoche } from '../partida/habilidades/HabilidadNocturna';
import { SenalaDosJugadores } from '../partida/habilidades/SenalaDosJugadores';

/** El Bibliotecario: sin forasteros en juego, «cero» (salvo con un Espía, que puede registrar como forastero). */
class Bibliotecario extends SenalaDosJugadores {
  constructor() {
    super('librarian', 'Outsider', 'outsider');
  }

  protected ninguno(ctx: ContextoNoche): boolean {
    return !ctx.plaza().some((a) => tipoDe(ctx, a) === 'outsider' || (ctx.identidad(a) === 'spy' && dudoso(ctx, a)));
  }
}
export const bibliotecario = new Bibliotecario();
