import {
  conRecordatorio,
  esteJugadorEs,
  numero,
  pideRecordatorio,
  RecibeInformacion,
  tipoDe,
  type ContextoNoche,
} from './HabilidadNocturna';

/**
 * La Lavandera, el Bibliotecario y el Investigador: dos jugadores, uno de ellos es
 * el personaje que se dice. El narrador los señala antes con sus recordatorios (el
 * correcto y «Wrong»).
 */
export class SenalaDosJugadores extends RecibeInformacion {
  constructor(
    personaje: string,
    /** El texto de su recordatorio del correcto (en el original). */
    private readonly correcto: string,
    /** El tipo del personaje que enseña. */
    private readonly tipo: string,
  ) {
    super(personaje);
    this.tipoEnsenado = tipo;
  }

  /** No hay nadie de ese tipo en juego (ni quien pueda registrar como él): se le dice «cero». */
  protected ninguno(_ctx: ContextoNoche): boolean {
    return false;
  }

  protected requisitos(ctx: ContextoNoche) {
    if (this.ninguno(ctx)) return [];
    return [...pideRecordatorio(ctx, this.personaje, this.correcto), ...pideRecordatorio(ctx, this.personaje, 'Wrong')];
  }

  protected informacion(ctx: ContextoNoche) {
    if (this.ninguno(ctx)) return { opciones: [{ envio: numero(0), registros: [] }] };
    const bueno = conRecordatorio(ctx, this.personaje, this.correcto)!;
    const malo = conRecordatorio(ctx, this.personaje, 'Wrong')!;
    // En el orden de la plaza: que no se sepa cuál es
    const jugadores = ctx.plaza().filter((a) => a.id === bueno.id || a.id === malo.id);
    const info = esteJugadorEs(ctx, jugadores, bueno);
    // Si no es de ese tipo (el Espía, la Reclusa…), qué personaje enseñar lo decide el narrador
    return tipoDe(ctx, bueno) === this.tipo ? info : { opciones: [], avisos: info.avisos };
  }
}
