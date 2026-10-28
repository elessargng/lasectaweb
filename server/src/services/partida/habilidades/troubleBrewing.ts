import type { SalaAsiento, SalaAvisoHabilidad, SalaOpcionDespertar, SalaRegistro } from '../../../contrato/sala';
import { tieneRecordatorio } from '../reglas/ReglaPersonaje';
import {
  alineamientosPosibles,
  conRecordatorio,
  droison,
  dudoso,
  EligeYMarca,
  EligeYSabe,
  ficha,
  listo,
  numero,
  OK,
  pideRecordatorio,
  RecibeInformacion,
  revisar,
  segunRegistros,
  sinEfectos,
  tarjeta,
  tipoDe,
  vecinosVivos,
  type ContextoNoche,
  type Efectos,
  type HabilidadNocturna,
  type Resultado,
} from './HabilidadNocturna';

/** Las habilidades de noche de Trouble Brewing. */

/** «Este jugador es» con quien es de verdad; si puede registrar como otro, el narrador lo revisa. */
function esteJugadorEs(ctx: ContextoNoche, jugadores: SalaAsiento[], quien: SalaAsiento) {
  const id = ctx.identidad(quien);
  const avisos: SalaAvisoHabilidad[] = dudoso(ctx, quien) ? [{ tipo: 'registro', asiento: quien.id }] : [];
  const opciones: SalaOpcionDespertar[] = id
    ? [{ envio: tarjeta('esteJugadorEs', { jugadores: jugadores.map((a) => a.id), personajes: [id] }), registros: [] }]
    : [];
  return { opciones, avisos };
}

// Eligen y cambian el estado de otro

export const envenenador = new EligeYMarca('poisoner', 'Poisoned', { puedeElegirse: true });
export const monje = new EligeYMarca('monk', 'Safe', { puedeElegirse: false });
export const mayordomo = new EligeYMarca('butler', 'Master', { puedeElegirse: false });

/** Protegido del demonio esta noche: con el «Safe» del Monje o un Soldado sano. */
const protegido = (ctx: ContextoNoche, asiento: SalaAsiento) =>
  tieneRecordatorio(asiento, 'monk', /^safe$/i) || (ctx.identidad(asiento) === 'soldier' && !droison(ctx, asiento));

/**
 * El Imp: el elegido muere (su «Dead» y la muerte pendiente), salvo que esté
 * protegido. Al Alcalde la muerte le puede rebotar: lo decide el narrador. Si se
 * elige a sí mismo, muere y el narrador dice quién es el nuevo Imp.
 */
export class Imp extends EligeYMarca {
  constructor() {
    super('imp', 'Dead', { puedeElegirse: true });
  }

  protected marcar(ctx: ContextoNoche, asiento: SalaAsiento, elegido: SalaAsiento, avisos: SalaAvisoHabilidad[]): Resultado {
    const muere: Efectos = { ...sinEfectos(), recordatorios: [{ asiento: elegido.id, texto: this.recordatorio }], muere: elegido.id };
    if (elegido.id === asiento.id) return listo(OK, { ...muere, nuevoImp: true }, avisos);
    if (elegido.muerto) return listo(OK, sinEfectos(), avisos);
    if (protegido(ctx, elegido)) return listo(OK, sinEfectos(), [...avisos, { tipo: 'protegido', asiento: elegido.id }]);
    if (ctx.identidad(elegido) === 'mayor' && !droison(ctx, elegido)) {
      return revisar([{ envio: OK, registros: [] }], [...avisos, { tipo: 'alcalde', asiento: elegido.id }]);
    }
    return listo(OK, muere, avisos);
  }
}
export const imp = new Imp();

// Eligen y reciben información

/** La Adivina: «Sí» si alguno de los dos es el demonio (o lleva su «Red Herring»). La Reclusa puede registrar como demonio. */
class Adivina extends EligeYSabe {
  constructor() {
    super('fortuneteller', 2);
  }

  protected requisitos(ctx: ContextoNoche) {
    return pideRecordatorio(ctx, this.personaje, 'Red Herring');
  }

  protected saber(ctx: ContextoNoche, _asiento: SalaAsiento, elegidos: SalaAsiento[]) {
    const posibles = (a: SalaAsiento): SalaRegistro[] => (ctx.identidad(a) === 'recluse' && dudoso(ctx, a) ? ['noDemonio', 'demonio'] : []);
    const opciones = segunRegistros(ctx, elegidos, posibles, (registro) => {
      const demonio = (a: SalaAsiento) => {
        const r = registro(a);
        return r ? r === 'demonio' : tipoDe(ctx, a) === 'demon';
      };
      const si = elegidos.some((a) => demonio(a) || tieneRecordatorio(a, this.personaje, /^red herring$/i));
      return ficha(si ? 'si' : 'no');
    });
    return { opciones };
  }
}
export const adivina = new Adivina();

/** El Ravenkeeper: si muere esta noche, elige a un jugador y sabe quién es. */
class Cuervero extends EligeYSabe {
  constructor() {
    super('ravenkeeper', 1);
    this.despiertaAlMorir = true;
  }

  protected requisitos(_ctx: ContextoNoche, asiento: SalaAsiento): SalaAvisoHabilidad[] {
    return asiento.muertePendiente ? [] : [{ tipo: 'noMuere' }];
  }

  protected saber(ctx: ContextoNoche, _asiento: SalaAsiento, [elegido]: SalaAsiento[]) {
    return esteJugadorEs(ctx, [elegido], elegido);
  }
}
export const cuervero = new Cuervero();

// No eligen y reciben información

/**
 * La Lavandera, el Bibliotecario y el Investigador: dos jugadores, uno de ellos es
 * el personaje que se dice. El narrador los señala antes con sus recordatorios (el
 * correcto y «Wrong»).
 */
class SenalaDosJugadores extends RecibeInformacion {
  constructor(
    personaje: string,
    /** El texto de su recordatorio del correcto (en el original). */
    private readonly correcto: string,
    /** El tipo del personaje que enseña. */
    private readonly tipo: string,
  ) {
    super(personaje);
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
    // En el orden de la mesa: que no se sepa cuál es
    const jugadores = ctx.mesa().filter((a) => a === bueno || a === malo);
    const info = esteJugadorEs(ctx, jugadores, bueno);
    // Si no es de ese tipo (el Espía, la Reclusa…), qué personaje enseñar lo decide el narrador
    return tipoDe(ctx, bueno) === this.tipo ? info : { opciones: [], avisos: info.avisos };
  }
}

export const lavandera = new SenalaDosJugadores('washerwoman', 'Townsfolk', 'townsfolk');
export const investigador = new SenalaDosJugadores('investigator', 'Minion', 'minion');

/** El Bibliotecario: sin forasteros en juego, «cero» (salvo con un Espía, que puede registrar como forastero). */
class Bibliotecario extends SenalaDosJugadores {
  constructor() {
    super('librarian', 'Outsider', 'outsider');
  }

  protected ninguno(ctx: ContextoNoche): boolean {
    return !ctx.mesa().some((a) => tipoDe(ctx, a) === 'outsider' || (ctx.identidad(a) === 'spy' && dudoso(ctx, a)));
  }
}
export const bibliotecario = new Bibliotecario();

/** El Chef: cuántas parejas de malvados se sientan juntos. */
class Chef extends RecibeInformacion {
  constructor() {
    super('chef');
  }

  protected informacion(ctx: ContextoNoche) {
    const mesa = ctx.mesa();
    const opciones = segunRegistros(ctx, mesa, (a) => alineamientosPosibles(ctx, a), (registro) => {
      const malvado = (a: SalaAsiento) => (registro(a) ?? ctx.alineamiento(a)) === 'malvado';
      const parejas = mesa.length < 2 ? 0 : mesa.filter((a, i) => malvado(a) && malvado(mesa[(i + 1) % mesa.length])).length;
      // Con dos, la pareja se cuenta una vez
      return numero(mesa.length === 2 ? Math.min(parejas, 1) : parejas);
    });
    return { opciones };
  }
}
export const chef = new Chef();

/** El Empático: cuántos de sus dos vecinos vivos son malvados. */
class Empatico extends RecibeInformacion {
  constructor() {
    super('empath');
  }

  protected informacion(ctx: ContextoNoche, asiento: SalaAsiento) {
    const vecinos = vecinosVivos(ctx, asiento);
    const opciones = segunRegistros(ctx, vecinos, (a) => alineamientosPosibles(ctx, a), (registro) =>
      numero(vecinos.filter((a) => (registro(a) ?? ctx.alineamiento(a)) === 'malvado').length),
    );
    return { opciones };
  }
}
export const empatico = new Empatico();

/** El Enterrador: quién era el ejecutado hoy (el que lleva su «Die Today»). */
class Enterrador extends RecibeInformacion {
  constructor() {
    super('undertaker');
  }

  protected requisitos(ctx: ContextoNoche) {
    return pideRecordatorio(ctx, this.personaje, 'Die Today');
  }

  protected informacion(ctx: ContextoNoche) {
    const ejecutado = conRecordatorio(ctx, this.personaje, 'Die Today')!;
    return esteJugadorEs(ctx, [ejecutado], ejecutado);
  }
}
export const enterrador = new Enterrador();

/** El Espía: ve el grimorio. */
class Espia extends RecibeInformacion {
  constructor() {
    super('spy');
  }

  protected informacion() {
    return { opciones: [], efectos: { ...sinEfectos(), grimorio: true } };
  }
}
export const espia = new Espia();

/** La Mujer Escarlata: con su «Is The Demon», es el nuevo Imp. */
class MujerEscarlata extends RecibeInformacion {
  constructor() {
    super('scarletwoman');
  }

  protected requisitos(_ctx: ContextoNoche, asiento: SalaAsiento) {
    return tieneRecordatorio(asiento, this.personaje, /^is the demon$/i) ? [] : [{ tipo: 'faltaRecordatorio' as const, personaje: this.personaje, texto: 'Is The Demon' }];
  }

  protected informacion() {
    return { opciones: [{ envio: tarjeta('tuEres', { personajes: ['imp'], alineamiento: 'malvado' }), registros: [] }] };
  }
}
export const mujerEscarlata = new MujerEscarlata();

export const HABILIDADES_TROUBLE_BREWING: readonly HabilidadNocturna[] = [
  envenenador,
  monje,
  mayordomo,
  imp,
  adivina,
  cuervero,
  lavandera,
  bibliotecario,
  investigador,
  chef,
  empatico,
  enterrador,
  espia,
  mujerEscarlata,
];
