import type {
  FichaDespertar,
  SalaAlineamiento,
  SalaAsiento,
  SalaAvisoHabilidad,
  SalaEleccionDespertar,
  SalaEnvioDespertar,
  SalaOpcionDespertar,
  SalaRegistro,
  TarjetaDespertar,
} from '../../../contrato/sala';
import { tieneRecordatorio, type ContextoReglas } from '../reglas/ReglaPersonaje';

/** Lo que una habilidad puede consultar de la partida: lo mismo que las reglas. Tampoco cambia la sala: responde. */
export type ContextoNoche = ContextoReglas;

/** Lo que cambia en la partida al hacerse una habilidad (lo aplica DespertarGuiado). */
export interface Efectos {
  /** Recordatorios del personaje de la habilidad que se ponen (cada uno, único en la mesa). */
  recordatorios: { asiento: string; texto: string }[];
  /** Quien muere esta noche (queda pendiente, como «Matar de noche»), o null. */
  muere: string | null;
  /** El demonio se ha elegido a sí mismo: el narrador dice quién es el nuevo. */
  nuevoImp: boolean;
  /** Se le envía el grimorio (el Espía). */
  grimorio: boolean;
}

/**
 * Lo que dice una habilidad, al preparar el despertar o cuando el jugador ya ha elegido:
 * - listo: se hace solo. Se manda la primera opción (sin ninguna, nada) y se aplican los efectos;
 * - falta: falta algo en el grimorio (los avisos dicen qué);
 * - revisar: el narrador elige entre las opciones o las cambia; los efectos los pone él.
 */
export interface Resultado {
  estado: 'listo' | 'falta' | 'revisar';
  avisos: SalaAvisoHabilidad[];
  opciones: SalaOpcionDespertar[];
  efectos: Efectos;
}

/**
 * La habilidad de noche de un personaje: cómo se le despierta. Si elige
 * (`eleccion`), primero se le pide que elija y luego `alElegir` dice qué pasa; si
 * no, `preparar` ya dice lo que se le manda. Un personaje nuevo es una habilidad
 * más en index.ts.
 */
export interface HabilidadNocturna {
  /** El personaje (id del catálogo). */
  personaje: string;
  /** Lo que elige, o null si no elige. */
  eleccion: SalaEleccionDespertar | null;
  /** Despierta aunque muera esta noche (el Ravenkeeper). */
  despiertaAlMorir: boolean;
  preparar(ctx: ContextoNoche, asiento: SalaAsiento): Resultado;
  alElegir(ctx: ContextoNoche, asiento: SalaAsiento, elegidos: SalaAsiento[]): Resultado;
}

// Lo que se manda

export const ficha = (f: FichaDespertar): SalaEnvioDespertar => ({
  ficha: f,
  tarjeta: null,
  jugadores: [],
  personajes: [],
  texto: null,
  alineamiento: null,
});

export const tarjeta = (
  t: TarjetaDespertar,
  { jugadores = [], personajes = [], alineamiento = null }: { jugadores?: string[]; personajes?: string[]; alineamiento?: SalaAlineamiento | null } = {},
): SalaEnvioDespertar => ({ ficha: null, tarjeta: t, jugadores, personajes, texto: null, alineamiento });

/** El «Entendido» con que se contesta a quien elige. */
export const OK = ficha('entendido');

const NUMEROS: FichaDespertar[] = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco'];
/** Un número: su ficha hasta el cinco; más, escrito. */
export const numero = (n: number): SalaEnvioDespertar => (n < NUMEROS.length ? ficha(NUMEROS[n]) : { ...ficha('personalizado'), texto: String(n) });

// Los resultados

export const sinEfectos = (): Efectos => ({ recordatorios: [], muere: null, nuevoImp: false, grimorio: false });

export const listo = (envio: SalaEnvioDespertar | null, efectos: Efectos = sinEfectos(), avisos: SalaAvisoHabilidad[] = []): Resultado => ({
  estado: 'listo',
  avisos,
  opciones: envio ? [{ envio, registros: [] }] : [],
  efectos,
});

export const falta = (avisos: SalaAvisoHabilidad[]): Resultado => ({ estado: 'falta', avisos, opciones: [], efectos: sinEfectos() });

export const revisar = (opciones: SalaOpcionDespertar[], avisos: SalaAvisoHabilidad[]): Resultado => ({
  estado: 'revisar',
  avisos,
  opciones,
  efectos: sinEfectos(),
});

// Lo que se consulta

/** Si está envenenado (el recordatorio del Envenenador) o borracho (es el Borracho de verdad); null si está sano. */
export function droison(ctx: ContextoNoche, asiento: SalaAsiento): 'envenenado' | 'borracho' | null {
  if (ctx.identidad(asiento) === 'drunk') return 'borracho';
  if (tieneRecordatorio(asiento, 'poisoner', /^poisoned$/i)) return 'envenenado';
  return null;
}

/** Puede registrar como otra cosa: un Espía o una Reclusa sanos. */
export const dudoso = (ctx: ContextoNoche, asiento: SalaAsiento): boolean =>
  ['spy', 'recluse'].includes(ctx.identidad(asiento) ?? '') && !droison(ctx, asiento);

/** Muerto, o muere esta noche. */
export const fuera = (asiento: SalaAsiento): boolean => asiento.muerto || asiento.muertePendiente;

/** El tipo de quien es de verdad el de un asiento. */
export const tipoDe = (ctx: ContextoNoche, asiento: SalaAsiento): string | undefined => {
  const id = ctx.identidad(asiento);
  return id ? ctx.personaje(id)?.tipo : undefined;
};

/** El asiento que lleva ese recordatorio (de ese personaje, por su texto en el original), o undefined. */
export const conRecordatorio = (ctx: ContextoNoche, personaje: string, texto: string): SalaAsiento | undefined =>
  ctx.mesa().find((a) => a.recordatorios.some((r) => r.personaje === personaje && r.texto.toLowerCase() === texto.toLowerCase()));

/** Si hace falta poner un recordatorio antes: el aviso, o ninguno. */
export const pideRecordatorio = (ctx: ContextoNoche, personaje: string, texto: string): SalaAvisoHabilidad[] =>
  conRecordatorio(ctx, personaje, texto) ? [] : [{ tipo: 'faltaRecordatorio', personaje, texto }];

/** Los vecinos vivos más cercanos, a cada lado (los asientos libres cuentan como jugadores). */
export function vecinosVivos(ctx: ContextoNoche, asiento: SalaAsiento): SalaAsiento[] {
  const vivos = ctx.mesa().filter((a) => a.id === asiento.id || !fuera(a));
  const i = vivos.findIndex((a) => a.id === asiento.id);
  const n = vivos.length;
  if (i < 0 || n < 2) return [];
  const [izquierda, derecha] = [vivos[(i - 1 + n) % n], vivos[(i + 1) % n]];
  return izquierda === derecha ? [izquierda] : [izquierda, derecha];
}

/** Cómo puede registrar cada uno en un alineamiento: el de verdad y, el Espía y la Reclusa, también el otro. */
export const alineamientosPosibles = (ctx: ContextoNoche, asiento: SalaAsiento): SalaRegistro[] => {
  if (!dudoso(ctx, asiento)) return [];
  const real = ctx.alineamiento(asiento) === 'malvado' ? 'malvado' : 'bueno';
  return [real, real === 'malvado' ? 'bueno' : 'malvado'];
};

/**
 * Las respuestas posibles según cómo registren los que pueden registrar como otra
 * cosa: se prueban todas las combinaciones (`posibles`, la primera es la de
 * verdad) y queda una opción por respuesta distinta, con cómo registra cada uno
 * para que salga. La primera es la de verdad. `calcular` recibe cómo registra
 * cada asiento (null: como es).
 */
export function segunRegistros(
  ctx: ContextoNoche,
  asientos: SalaAsiento[],
  posibles: (asiento: SalaAsiento) => SalaRegistro[],
  calcular: (registro: (asiento: SalaAsiento) => SalaRegistro | null) => SalaEnvioDespertar,
): SalaOpcionDespertar[] {
  const dudosos = [...new Map(asientos.filter((a) => posibles(a).length > 1).map((a) => [a.id, a])).values()];
  let combinaciones: Map<string, SalaRegistro>[] = [new Map()];
  for (const a of dudosos) {
    combinaciones = combinaciones.flatMap((c) => posibles(a).map((r) => new Map([...c, [a.id, r]])));
  }
  const opciones = new Map<string, SalaOpcionDespertar>();
  for (const c of combinaciones) {
    const envio = calcular((a) => c.get(a.id) ?? null);
    const clave = JSON.stringify(envio);
    if (!opciones.has(clave)) opciones.set(clave, { envio, registros: [...c].map(([asiento, como]) => ({ asiento, como })) });
  }
  return [...opciones.values()];
}

/**
 * La información que recibe quien despierta, según esté: droison, con varias
 * respuestas posibles o con alguien que puede registrar como otra cosa, la revisa
 * el narrador; si no, se manda sola.
 */
export function informar(
  ctx: ContextoNoche,
  asiento: SalaAsiento,
  info: { opciones: SalaOpcionDespertar[]; avisos?: SalaAvisoHabilidad[]; efectos?: Efectos },
  previos: SalaAvisoHabilidad[] = [],
): Resultado {
  const estaDroison = droison(ctx, asiento);
  // Con varias respuestas, quién puede registrar como otra cosa (una vez cada uno)
  const registran =
    info.opciones.length > 1
      ? [...new Set(info.opciones.flatMap((o) => o.registros.map((r) => r.asiento)))].map((id): SalaAvisoHabilidad => ({ tipo: 'registro', asiento: id }))
      : [];
  const avisos = [...previos, ...(estaDroison ? [{ tipo: estaDroison } as SalaAvisoHabilidad] : []), ...(info.avisos ?? []), ...registran];
  const dudas = avisos.some((a) => a.tipo === 'registro');
  if (estaDroison || dudas || (info.opciones.length !== 1 && !info.efectos)) return revisar(info.opciones, avisos);
  return { estado: 'listo', avisos, opciones: info.opciones, efectos: info.efectos ?? sinEfectos() };
}

// Las tres clases de habilidad

/** Lo común: quién despierta y qué hace falta antes. */
abstract class Habilidad implements HabilidadNocturna {
  eleccion: SalaEleccionDespertar | null = null;
  despiertaAlMorir = false;

  constructor(readonly personaje: string) {}

  /** Lo que tiene que estar en el grimorio antes de despertarlo (los avisos de lo que falta). */
  protected requisitos(_ctx: ContextoNoche, _asiento: SalaAsiento): SalaAvisoHabilidad[] {
    return [];
  }

  /** Muerto (o muere esta noche) ya no despierta, salvo quien despierta precisamente por morir. */
  protected muerto(asiento: SalaAsiento): boolean {
    return this.despiertaAlMorir ? asiento.muerto : fuera(asiento);
  }

  abstract preparar(ctx: ContextoNoche, asiento: SalaAsiento): Resultado;

  alElegir(_ctx: ContextoNoche, _asiento: SalaAsiento, _elegidos: SalaAsiento[]): Resultado {
    return falta([]);
  }
}

/** Para los que eligen: se les pide que elijan si está todo en el grimorio. */
abstract class Elige extends Habilidad {
  constructor(personaje: string, eleccion: SalaEleccionDespertar) {
    super(personaje);
    this.eleccion = eleccion;
  }

  preparar(ctx: ContextoNoche, asiento: SalaAsiento): Resultado {
    if (this.muerto(asiento)) return falta([{ tipo: 'muerto' }]);
    const faltan = this.requisitos(ctx, asiento);
    return faltan.length ? falta(faltan) : listo(null);
  }
}

/**
 * Elige a un jugador y eso le cambia el estado: se le pone el recordatorio (el
 * Envenenador, el Monje, el Mayordomo, el Imp) y a quien elige se le contesta
 * «Entendido». Droison, se le contesta igual (que no lo note) pero no se pone nada.
 */
export class EligeYMarca extends Elige {
  constructor(
    personaje: string,
    /** El texto (en el original) de su recordatorio. */
    protected readonly recordatorio: string,
    { puedeElegirse }: { puedeElegirse: boolean },
  ) {
    super(personaje, { cantidad: 1, puedeElegirse });
  }

  alElegir(ctx: ContextoNoche, asiento: SalaAsiento, [elegido]: SalaAsiento[]): Resultado {
    const avisos: SalaAvisoHabilidad[] = [{ tipo: 'elegido', asientos: [elegido.id] }];
    const estaDroison = droison(ctx, asiento);
    if (estaDroison) return listo(OK, sinEfectos(), [...avisos, { tipo: estaDroison }, { tipo: 'sinEfecto' }]);
    return this.marcar(ctx, asiento, elegido, avisos);
  }

  /** Lo que pasa con el elegido: su recordatorio. */
  protected marcar(_ctx: ContextoNoche, _asiento: SalaAsiento, elegido: SalaAsiento, avisos: SalaAvisoHabilidad[]): Resultado {
    return listo(OK, { ...sinEfectos(), recordatorios: [{ asiento: elegido.id, texto: this.recordatorio }] }, avisos);
  }
}

/** Elige y eso le da información (la Adivina, el Ravenkeeper). */
export abstract class EligeYSabe extends Elige {
  constructor(personaje: string, cantidad: number) {
    super(personaje, { cantidad, puedeElegirse: true });
  }

  alElegir(ctx: ContextoNoche, asiento: SalaAsiento, elegidos: SalaAsiento[]): Resultado {
    return informar(ctx, asiento, this.saber(ctx, asiento, elegidos), [{ tipo: 'elegido', asientos: elegidos.map((a) => a.id) }]);
  }

  /** Lo que sabe por los que ha elegido. */
  protected abstract saber(ctx: ContextoNoche, asiento: SalaAsiento, elegidos: SalaAsiento[]): { opciones: SalaOpcionDespertar[]; avisos?: SalaAvisoHabilidad[] };
}

/**
 * No elige: recibe información, que se calcula con lo que hay en la mesa. Si
 * falta algo en el grimorio, no se puede; droison, la revisa el narrador (con la
 * de verdad, si se puede calcular, como propuesta).
 */
export abstract class RecibeInformacion extends Habilidad {
  preparar(ctx: ContextoNoche, asiento: SalaAsiento): Resultado {
    if (this.muerto(asiento)) return falta([{ tipo: 'muerto' }]);
    const faltan = this.requisitos(ctx, asiento);
    if (faltan.length && !droison(ctx, asiento)) return falta(faltan);
    return informar(ctx, asiento, faltan.length ? { opciones: [], avisos: faltan } : this.informacion(ctx, asiento));
  }

  /** Lo que se le manda (las opciones; sin ninguna, nada) y lo que cambia (el grimorio del Espía). */
  protected abstract informacion(ctx: ContextoNoche, asiento: SalaAsiento): { opciones: SalaOpcionDespertar[]; avisos?: SalaAvisoHabilidad[]; efectos?: Efectos };
}
