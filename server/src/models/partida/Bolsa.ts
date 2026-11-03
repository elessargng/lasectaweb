import type { Distribucion } from '../compartido/partida';
import type { PersonajeDeGuion } from '../guiones';
import { barajar, type Azar } from './azar';
import { repartoPara } from './distribucion';
import { identidadDe } from './Grimorio';
import type { Jugador } from './Jugador';

/** Los que van en la bolsa para repartir (también viajeros, de cualquier guion: no cuentan para el reparto por tipos). */
export const TIPOS_EN_BOLSA: readonly string[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller'];
/** Los tipos que cuentan para el reparto (sin viajeros). */
const TIPOS_REPARTO = ['townsfolk', 'outsider', 'minion', 'demon'] as const;
/** Fichas de un mismo personaje como mucho en la bolsa (con el Pope, o si es repetible). */
export const MAX_REPETIDOS = 5;
const ERROR_REPETIDOS = 'Solo con el Pope puede haber aldeanos o forasteros repetidos.';

/**
 * Lo que un personaje cambia de la bolsa: datos, no código. Cada personaje que la
 * cambia lo declara en su archivo de models/personajes (ver PODERES_BOLSA).
 */
export interface PoderBolsa {
  /**
   * Forasteros de más o de menos (los aldeanos compensan). Con una sola opción se
   * aplica sola; con varias, elige el narrador. 'libre': cualquier número.
   */
  forasteros?: number[] | 'libre';
  /** 'ninguno': en la bolsa no va ningún esbirro y sus huecos son del bien (aldeanos o forasteros). */
  esbirros?: 'ninguno';
  /** No va en la bolsa: si sale, en su lugar va un aldeano y el narrador pone a mano su ficha. */
  noVa?: true;
  /** Lo que cambia en una partida teensy (5 o 6 jugadores). */
  teensy?: Omit<PoderBolsa, 'teensy'>;
}

/** El poder sobre la bolsa de un personaje, si lo tiene. */
export type PoderDe = (personajeId: string) => PoderBolsa | undefined;

/** Las partidas de 5 o 6 jugadores. */
export const esTeensy = (jugadores: number) => jugadores === 5 || jugadores === 6;

/**
 * La firma de un reparto: cuántos jugadores y cuántos de cada tipo («7:5/0/1/1»).
 * Es lo que se guarda al darlo por bueno a mano: si cambia, vuelve a avisar.
 */
export const firmaDelReparto = (cuentas: Record<string, number>, jugadores: number) =>
  `${jugadores}:${TIPOS_REPARTO.map((t) => cuentas[t] ?? 0).join('/')}`;

/** Lo que hace falta de cada personaje para sortearlo. */
export interface PersonajeParaBolsa {
  id: string;
  tipo: string;
}

/** La bolsa sorteada: lo que va, lo que ha salido y no va (con el tipo que falta: el suyo) y los tipos de los que no hay bastantes. */
export interface BolsaAlAzar<P extends PersonajeParaBolsa = PersonajeParaBolsa> {
  personajes: string[];
  fuera: { personaje: P; falta: string }[];
  escasos: string[];
}

/**
 * Lo que se sabe del reparto, para pintarlo (solo el narrador): con la bolsa (el
 * diálogo de la bolsa) y con lo que se cuenta en el recuadro del reparto.
 */
export interface EstadoReparto {
  /** Con lo que hay en la bolsa: lo que toca de cada tipo y lo que no cuadra. */
  bolsa: { ajustado: Distribucion; problemas: string[] };
  /** Lo que hay en juego (si ya hay personajes en la plaza, por quien es cada uno de verdad) o, si no, la bolsa. */
  cuenta: {
    donde: 'bolsa' | 'juego';
    /** Cuántos hay de cada tipo (townsfolk, outsider, minion, demon, traveller). */
    cuentas: Record<string, number>;
    ajustado: Distribucion;
    /** Lo que no cuadra, solo con el reparto completo (vacío mientras faltan). */
    problemas: string[];
    firma: string;
    /** Hay que avisar: en la preparación, no cuadra y no se ha dado por bueno. */
    aviso: boolean;
  };
}

/** Lo que la bolsa necesita saber de la partida. */
export interface EntornoBolsa {
  /** Los jugadores de la plaza, en orden. */
  plaza(): readonly Jugador[];
  esViajero(personajeId: string): boolean;
  /** Un personaje del guion (o del catálogo). */
  personaje(id: string): PersonajeDeGuion | undefined;
  /** Los personajes del guion (sin viajeros ni NPCs). */
  personajes(): readonly PersonajeDeGuion[];
  /** Los NPCs en juego (el Centinela cambia la bolsa). */
  npcs(): readonly string[];
  /** Lo que cambia cada personaje de la bolsa (ver PoderBolsa). */
  poderDe: PoderDe;
  /** El Pope está en juego: los aldeanos y forasteros pueden ir repetidos en la bolsa. */
  popeEnJuego(): boolean;
  /** Lo que hacen las reglas con el reparto (el Revolutionary: ver personajes/revolucionario.ts). */
  reglas(jugadores: Jugador[], personajes: string[]): string[];
  /** Pone en la ficha del asiento el personaje que le ha tocado (ver Grimorio.repartir). */
  darPersonaje(jugadorId: string, personaje: string | null): void;
  /** El azar con el que se reparte y se llena al azar. */
  azar: Azar;
}

/** Cuántos de cada tipo, con los esbirros ya pasados al bien si alguno lo pide. */
interface Cuentas {
  aldeanos: number;
  forasteros: number;
  esbirros: number;
  demonios: number;
}

/**
 * La bolsa de la partida: los personajes que el narrador mete para repartir (en el
 * orden en que se metieron), sus reglas (cuántos de cada tipo tocan con los
 * personajes que la cambian, qué no cuadra, sortearla) y el reparto de sus fichas
 * entre los asientos. No sabe de ningún personaje: cada uno trae su PoderBolsa. No
 * comprueba permisos.
 */
export class Bolsa {
  private personajes: string[] = [];
  /** El reparto dado por bueno a mano (ver estado: aviso). */
  private setupAceptadoActual: string | null = null;

  constructor(private readonly entorno: EntornoBolsa) {}

  // --- Las fichas

  fichas(): string[] {
    return [...this.personajes];
  }

  contiene(personajeId: string): boolean {
    return this.personajes.includes(personajeId);
  }

  /** Los viajeros metidos en la bolsa: se reparten con los demás, pero no cuentan para el reparto por tipos. */
  viajeros(): number {
    return this.personajes.filter((id) => this.entorno.esViajero(id)).length;
  }

  /**
   * El narrador mete en la bolsa un personaje del guion (de los que van en ella:
   * ver TIPOS_EN_BOLSA), o lo saca si ya estaba. No se limita cuántos: lo decide
   * él. Devuelve el error, si lo hay.
   */
  meterOSacar(personajeId: string): string | null {
    const personaje = this.entorno.personaje(personajeId);
    if (!personaje) return 'Ese personaje no está en el guion.';
    if (!TIPOS_EN_BOLSA.includes(personaje.tipo)) return 'En la bolsa solo van aldeanos, forasteros, esbirros, demonios y viajeros.';
    this.personajes = this.contiene(personaje.id)
      ? this.personajes.filter((id) => id !== personaje.id)
      : [...this.personajes, personaje.id];
    return null;
  }

  /**
   * Cuántas fichas de un personaje hay en la bolsa (0 lo saca): quita las de más o
   * añade las que falten, donde estaba la primera (o al final). Más de una, solo si
   * puede repetirse (ver puedeRepetirse). Devuelve el error, si lo hay.
   */
  ponerEnBolsa(personajeId: string, cantidad: number): string | null {
    const personaje = this.entorno.personaje(personajeId);
    if (!personaje || !TIPOS_EN_BOLSA.includes(personaje.tipo)) return 'Ese personaje no va en la bolsa.';
    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > MAX_REPETIDOS) return 'Cantidad desconocida.';
    if (cantidad > 1 && !this.puedeRepetirse(personaje)) return ERROR_REPETIDOS;
    const otros = this.personajes.filter((id) => id !== personaje.id);
    const primera = this.personajes.indexOf(personaje.id);
    const suyas = Array.from({ length: cantidad }, () => personaje.id);
    const donde = primera < 0 ? otros.length : this.personajes.slice(0, primera).filter((id) => id !== personaje.id).length;
    this.personajes = [...otros.slice(0, donde), ...suyas, ...otros.slice(donde)];
    return null;
  }

  /**
   * Llena la bolsa de una vez: sustituye sus aldeanos, forasteros, esbirros y
   * demonios por estos, que tienen que ser del guion y no viajeros; los viajeros se
   * quedan. Repetidos, solo los que pueden. Devuelve el error, si lo hay.
   */
  llenar(personajes: readonly string[]): string | null {
    const vistos = new Set<string>();
    for (const id of personajes) {
      const personaje = this.entorno.personaje(id);
      if (!personaje || personaje.tipo === 'traveller' || !TIPOS_EN_BOLSA.includes(personaje.tipo)) {
        return 'En la bolsa al azar solo van aldeanos, forasteros, esbirros y demonios del guion.';
      }
      if (vistos.has(id) && !this.puedeRepetirse(personaje)) return ERROR_REPETIDOS;
      vistos.add(id);
    }
    this.personajes = [...this.personajes.filter((id) => this.entorno.esViajero(id)), ...personajes];
    return null;
  }

  /**
   * Llena la bolsa al azar con los personajes del guion (ver sortear) y la llena
   * (los viajeros se quedan). Sin reparto (menos de 5 jugadores), un error.
   */
  llenarAlAzar(): { error: string } | BolsaAlAzar<PersonajeDeGuion> {
    const sorteo = this.sortear(this.entorno.personajes(), this.distribucion(), this.entorno.npcs(), this.entorno.azar);
    if (!sorteo) return { error: 'No hay reparto para tan pocos jugadores.' };
    const error = this.llenar(sorteo.personajes);
    return error ? { error } : sorteo;
  }

  /** Vacía la bolsa entera (también los viajeros). */
  vaciar(): void {
    this.personajes = [];
  }

  /** Otra partida: la bolsa vacía y sin reparto aceptado. */
  olvidar(): void {
    this.vaciar();
    this.setupAceptadoActual = null;
  }

  /**
   * Si un personaje puede ir repetido en la bolsa: los repetibles («bag-duplicate»,
   * como el Village Idiot), siempre; los aldeanos y forasteros, con el Pope en juego.
   */
  private puedeRepetirse(personaje: PersonajeDeGuion): boolean {
    return !!personaje.repetible || ((personaje.tipo === 'townsfolk' || personaje.tipo === 'outsider') && this.entorno.popeEnJuego());
  }

  // --- El reparto entre los asientos

  setupAceptado(): string | null {
    return this.setupAceptadoActual;
  }

  aceptarSetup(firma: string | null): void {
    this.setupAceptadoActual = firma;
  }

  /**
   * Si en un asiento hay un viajero puesto a mano (de verdad: un Aprendiz con la
   * ficha de un aldeano sigue siendo viajero): ese asiento no entra en el
   * reparto. Uno que esté en la bolsa no cuenta (salió del reparto, y al repartir
   * otra vez puede tocarle a otro).
   */
  llevaViajero(jugador: Jugador): boolean {
    const id = identidadDe(jugador);
    return !!id && this.entorno.esViajero(id) && !this.contiene(id);
  }

  /**
   * El reparto de la partida: los jugadores (asientos, sin los viajeros: los
   * puestos a mano y los de la bolsa) y cuántos de cada tipo (ver repartoPara).
   */
  distribucion(): Distribucion {
    const plaza = this.entorno.plaza();
    const viajeros = plaza.filter((a) => this.llevaViajero(a)).length + this.viajeros();
    const jugadores = Math.max(0, plaza.length - viajeros);
    const reparto = repartoPara(jugadores);
    // Los muertos con sudario (público; la muerte pendiente aún no cuenta). Un viajero
    // de la bolsa aún sin repartir está vivo
    const muertos = plaza.filter((a) => a.muerto);
    const viajerosMuertos = muertos.filter((a) => {
      const id = identidadDe(a);
      return !!id && this.entorno.esViajero(id);
    }).length;
    return {
      jugadores,
      jugadoresVivos: Math.max(0, jugadores - (muertos.length - viajerosMuertos)),
      viajeros,
      viajerosVivos: Math.max(0, viajeros - viajerosMuertos),
      aldeanos: reparto?.aldeanos ?? null,
      forasteros: reparto?.forasteros ?? null,
      esbirros: reparto?.esbirros ?? null,
      demonios: reparto?.demonios ?? null,
    };
  }

  /** Cuántos personajes hay que meter en la bolsa: uno por asiento sin viajero puesto a mano (los de la bolsa, también). */
  fichasParaRepartir(): number {
    return this.entorno.plaza().filter((a) => !this.llevaViajero(a)).length;
  }

  /**
   * Reparte al azar los personajes de la bolsa (también sus viajeros) entre los
   * asientos que no llevan un viajero puesto a mano (tiene que haber tantos como
   * asientos; no lo comprueba). El alineamiento vuelve a ser el de su tipo. La
   * bolsa se queda como estaba.
   */
  repartir(): void {
    const jugadores = this.entorno.plaza().filter((a) => !this.llevaViajero(a));
    const personajes = this.entorno.reglas(jugadores, barajar(this.personajes, this.entorno.azar));
    jugadores.forEach((a, i) => this.entorno.darPersonaje(a.id, personajes[i] ?? null));
  }

  // --- Las reglas

  /** Si un personaje no va en la bolsa (el Borracho, la Marioneta). */
  noVa(personajeId: string): boolean {
    return !!this.entorno.poderDe(personajeId)?.noVa;
  }

  /**
   * Lo que toca de cada tipo con los personajes presentes (en la bolsa, en juego o
   * NPCs): sin esbirros si alguno lo pide, y los forasteros de los que los cambian
   * sin dejar elegir (una sola opción) ya puestos, con los aldeanos compensando.
   * Los que dejan elegir no lo cambian. Sin reparto (menos de 5), el mismo.
   */
  ajustar(distribucion: Distribucion, presentes: readonly string[]): Distribucion {
    const base = this.conPoderes(distribucion, presentes);
    if (!base) return distribucion;
    const { aldeanos, forasteros, esbirros } = base.cuentas;
    let desvio = 0;
    for (const { forasteros: opciones } of base.poderes) {
      if (Array.isArray(opciones) && opciones.length === 1) desvio += opciones[0];
    }
    // Sin pasarse: ni forasteros por debajo de 0 ni aldeanos por debajo de 0
    const ajuste = Math.max(-forasteros, Math.min(aldeanos, desvio));
    return { ...distribucion, aldeanos: aldeanos - ajuste, forasteros: forasteros + ajuste, esbirros };
  }

  /**
   * Lo que no cuadra del reparto, en frases cortas («Forasteros: 2; deberían ser
   * 0 o 1»); vacío si cuadra. `cuentas`: cuántos hay de cada tipo (townsfolk,
   * outsider, minion, demon); `presentes`: los personajes en juego (o en la
   * bolsa) y los NPCs, por sus poderes sobre la bolsa. Sin reparto (menos de 5
   * jugadores), nada.
   */
  problemas(cuentas: Record<string, number>, distribucion: Distribucion, presentes: readonly string[]): string[] {
    const base = this.conPoderes(distribucion, presentes);
    if (!base) return [];
    const { aldeanos, forasteros, esbirros, demonios } = base.cuentas;
    const posibles = forasterosPosibles(base);
    const hay = (tipo: string) => cuentas[tipo] ?? 0;

    const lista: string[] = [];
    if (hay('minion') !== esbirros) lista.push(`Esbirros: ${hay('minion')}; deberían ser ${esbirros}`);
    if (hay('demon') !== demonios) lista.push(`Demonios: ${hay('demon')}; deberían ser ${demonios}`);
    const buenos = aldeanos + forasteros;
    if (posibles === 'libre') {
      if (hay('townsfolk') + hay('outsider') !== buenos) {
        lista.push(`Aldeanos y forasteros: ${hay('townsfolk') + hay('outsider')}; deberían ser ${buenos} entre los dos`);
      }
      return lista;
    }
    if (!posibles.includes(hay('outsider'))) {
      lista.push(`Forasteros: ${hay('outsider')}; deberían ser ${enumerar(posibles)}`);
    }
    if (hay('townsfolk') + hay('outsider') !== buenos) {
      lista.push(`Aldeanos: ${hay('townsfolk')}; deberían ser ${enumerar(posibles.map((f) => buenos - f).reverse())}`);
    }
    return lista;
  }

  /**
   * Qué no cuadra del reparto en juego que delate a alguien que no es lo que cree:
   * los forasteros (el Borracho cree ser un aldeano) y los esbirros (la Marioneta
   * cree ser buena). Sin reparto, nada.
   */
  descuadres(cuentas: Record<string, number>, distribucion: Distribucion, presentes: readonly string[]): { forasteros: boolean; esbirros: boolean } {
    const base = this.conPoderes(distribucion, presentes);
    if (!base) return { forasteros: false, esbirros: false };
    const posibles = forasterosPosibles(base);
    return {
      forasteros: posibles !== 'libre' && !posibles.includes(cuentas.outsider ?? 0),
      esbirros: (cuentas.minion ?? 0) < base.cuentas.esbirros,
    };
  }

  /**
   * Sortea una bolsa con estos personajes, como se hace a mano: primero los
   * demonios, luego los esbirros (los que toquen con los demonios elegidos: puede
   * que ninguno), luego los forasteros y por último los aldeanos. Así los poderes de
   * los ya elegidos (y de los NPCs) se cuentan al elegir lo siguiente (ver ajustar).
   * Los que no van en la bolsa (noVa), si salen, no van: en su lugar, un aldeano
   * más. No toca la bolsa. Sin reparto (menos de 5 jugadores), null.
   */
  sortear<P extends PersonajeParaBolsa>(
    personajes: readonly P[],
    distribucion: Distribucion,
    npcs: readonly string[],
    azar: Azar,
  ): BolsaAlAzar<P> | null {
    if (!this.conPoderes(distribucion, [])) return null;

    const escasos = new Set<string>();
    const elegir = (tipo: string, cuantos: number) => {
      const candidatos = personajes.filter((p) => p.tipo === tipo);
      if (candidatos.length < cuantos) escasos.add(tipo);
      return barajar(candidatos, azar).slice(0, cuantos);
    };
    const ids = (lista: P[]) => lista.map((p) => p.id);

    const demonios = elegir('demon', distribucion.demonios ?? 0);
    const conDemonios = this.ajustar(distribucion, [...ids(demonios), ...npcs]);
    const malos = [...demonios, ...elegir('minion', conDemonios.esbirros ?? 0)];
    // Con los malos ya elegidos (y los NPCs, como el Centinela), los forasteros y aldeanos que tocan
    const ajustado = this.ajustar(distribucion, [...ids(malos), ...npcs]);
    const elegidos = [...malos, ...elegir('outsider', ajustado.forasteros ?? 0)];
    const fuera = elegidos.filter((p) => this.noVa(p.id)).map((p) => ({ personaje: p, falta: p.tipo }));
    // Un aldeano más por cada uno que no va
    const buenos = elegir('townsfolk', (ajustado.aldeanos ?? 0) + fuera.length);

    return {
      personajes: ids([...elegidos.filter((p) => !this.noVa(p.id)), ...buenos]),
      fuera,
      escasos: [...escasos],
    };
  }

  /**
   * Lo que se sabe del reparto, para el narrador: con la bolsa y con lo que se
   * cuenta (lo que hay en juego, por quien es cada uno de verdad, en cuanto hay
   * personajes en la plaza; si no, la bolsa). Solo en la preparación se avisa de lo
   * que no cuadra: luego el juego cambia personajes y ya no tiene por qué cuadrar.
   */
  estado(enPreparacion: boolean): EstadoReparto {
    const distribucion = this.distribucion();
    const npcs = this.entorno.npcs();
    const enBolsa = this.fichas();
    const enPlaza = this.entorno.plaza().some((a) => a.personaje);
    const ids = enPlaza ? this.identidades() : enBolsa;
    const cuentas = this.contar(ids);
    // Solo con el reparto completo (mientras se prepara, siempre faltaría algo)
    const completo = TIPOS_REPARTO.reduce((n, tipo) => n + (cuentas[tipo] ?? 0), 0) === distribucion.jugadores;
    const problemas = completo ? this.problemas(cuentas, distribucion, [...ids, ...npcs]) : [];
    const firma = firmaDelReparto(cuentas, distribucion.jugadores);
    return {
      bolsa: {
        ajustado: this.ajustar(distribucion, [...enBolsa, ...npcs]),
        problemas: this.problemas(this.contar(enBolsa), distribucion, [...enBolsa, ...npcs]),
      },
      cuenta: {
        donde: enPlaza ? 'juego' : 'bolsa',
        cuentas,
        ajustado: this.ajustar(distribucion, [...ids, ...npcs]),
        problemas,
        firma,
        aviso: enPreparacion && problemas.length > 0 && firma !== this.setupAceptadoActual,
      },
    };
  }

  /**
   * Con todos los personajes ya puestos, si el reparto no cuadra lo más seguro es
   * que alguien no sea lo que cree: los del guion que no van en la bolsa (el
   * Borracho, si faltan forasteros; la Marioneta, si faltan esbirros o forasteros).
   */
  probables(): string[] {
    const ids = this.identidades();
    const cuentas = this.contar(ids);
    const distribucion = this.distribucion();
    const repartidos = TIPOS_REPARTO.reduce((n, tipo) => n + (cuentas[tipo] ?? 0), 0);
    if (repartidos === 0 || repartidos !== distribucion.jugadores) return [];
    const descuadre = this.descuadres(cuentas, distribucion, [...ids, ...this.entorno.npcs()]);
    return this.entorno
      .personajes()
      .filter((p) => this.noVa(p.id) && (p.tipo === 'outsider' ? descuadre.forasteros : descuadre.forasteros || descuadre.esbirros))
      .map((p) => p.id);
  }

  /** Quién es de verdad cada asiento de la plaza (por su «Is The …» o su ficha). */
  private identidades(): string[] {
    return this.entorno.plaza().flatMap((a) => identidadDe(a) ?? []);
  }

  /** Cuántos hay de cada tipo. */
  private contar(ids: readonly string[]): Record<string, number> {
    const cuentas: Record<string, number> = {};
    for (const id of ids) {
      const tipo = this.entorno.personaje(id)?.tipo;
      if (tipo) cuentas[tipo] = (cuentas[tipo] ?? 0) + 1;
    }
    return cuentas;
  }

  /**
   * El reparto sin los ajustes de forasteros y los poderes de los presentes (sin
   * repetir), los de teensy ya aplicados. Sin reparto (menos de 5), null.
   */
  private conPoderes(distribucion: Distribucion, presentes: readonly string[]): { cuentas: Cuentas; poderes: PoderBolsa[] } | null {
    const { jugadores, aldeanos, forasteros, esbirros, demonios } = distribucion;
    if (aldeanos === null || forasteros === null || esbirros === null || demonios === null) return null;
    const poderes = [...new Set(presentes)].flatMap((id) => {
      const poder = this.entorno.poderDe(id);
      if (!poder) return [];
      return [esTeensy(jugadores) && poder.teensy ? { ...poder, ...poder.teensy } : poder];
    });
    const sinEsbirros = poderes.some((p) => p.esbirros === 'ninguno');
    return {
      cuentas: { aldeanos: aldeanos + (sinEsbirros ? esbirros : 0), forasteros, esbirros: sinEsbirros ? 0 : esbirros, demonios },
      poderes,
    };
  }
}

/** Cuántos forasteros puede haber con esos poderes (de menos a más), o 'libre'. */
function forasterosPosibles({ cuentas, poderes }: { cuentas: Cuentas; poderes: PoderBolsa[] }): number[] | 'libre' {
  // Los forasteros que puede haber de más o de menos: la suma de lo de cada personaje
  let desvios = new Set([0]);
  for (const { forasteros: opciones } of poderes) {
    if (!opciones) continue;
    if (opciones === 'libre') return 'libre';
    desvios = new Set([...desvios].flatMap((d) => opciones.map((o) => d + o)));
  }
  return [...desvios]
    .map((d) => cuentas.forasteros + d)
    .filter((f) => f >= 0 && f <= cuentas.aldeanos + cuentas.forasteros)
    .sort((a, b) => a - b);
}

/** «0», «0 o 1», «0, 1 o 2». */
const enumerar = (numeros: number[]) =>
  numeros.length <= 1 ? String(numeros[0] ?? 0) : `${numeros.slice(0, -1).join(', ')} o ${numeros[numeros.length - 1]}`;
