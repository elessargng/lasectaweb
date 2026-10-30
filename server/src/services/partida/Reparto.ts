import type { SalaAsiento, SalaDistribucion } from '../../contrato/sala';
import { barajar } from './azar';
import { Bolsa } from './Bolsa';
import { repartoPara } from './distribucion';
import { identidadDe } from './Grimorio';

/** Lo que el reparto necesita saber de la partida. */
export interface EntornoReparto {
  /** La mesa con sus fichas, en orden. */
  mesa(): SalaAsiento[];
  esViajero(personajeId: string): boolean;
  /** Lo que hacen las reglas con el reparto (el Revolutionary: ver reglas/revolucionario.ts). */
  reglas(asientos: SalaAsiento[], personajes: string[]): string[];
  /** Pone en la ficha del asiento el personaje que le ha tocado (ver Grimorio.repartir). */
  darPersonaje(asientoId: string, personaje: string | null): void;
}

/**
 * El reparto de personajes: la bolsa, cuántos de cada tipo tocan (la
 * distribución) y el reparto de la bolsa entre los asientos. No comprueba permisos.
 */
export class Reparto {
  /** Los personajes para repartir. */
  readonly bolsa: Bolsa;
  /** El reparto dado por bueno a mano (ver SalaEstado.setupAceptado). */
  private setupAceptadoActual: string | null = null;

  constructor(private readonly entorno: EntornoReparto) {
    this.bolsa = new Bolsa((id) => entorno.esViajero(id));
  }

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
  llevaViajero(asiento: SalaAsiento): boolean {
    const id = identidadDe(asiento);
    return !!id && this.entorno.esViajero(id) && !this.bolsa.contiene(id);
  }

  /**
   * El reparto de la partida: los jugadores (asientos, sin los viajeros: los
   * puestos a mano y los de la bolsa) y cuántos de cada tipo (ver repartoPara).
   */
  distribucion(): SalaDistribucion {
    const mesa = this.entorno.mesa();
    const viajeros = mesa.filter((a) => this.llevaViajero(a)).length + this.bolsa.viajeros();
    const jugadores = Math.max(0, mesa.length - viajeros);
    const reparto = repartoPara(jugadores);
    // Los muertos con sudario (público; la muerte pendiente aún no cuenta). Un viajero
    // de la bolsa aún sin repartir está vivo
    const muertos = mesa.filter((a) => a.muerto);
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
    return this.entorno.mesa().filter((a) => !this.llevaViajero(a)).length;
  }

  /**
   * Reparte al azar los personajes de la bolsa (también sus viajeros) entre los
   * asientos que no llevan un viajero puesto a mano (tiene que haber tantos como
   * asientos; no lo comprueba). El alineamiento vuelve a ser el de su tipo. La
   * bolsa se queda como estaba.
   */
  repartir(): void {
    const asientos = this.entorno.mesa().filter((a) => !this.llevaViajero(a));
    const personajes = this.entorno.reglas(asientos, barajar(this.bolsa.bolsa()));
    asientos.forEach((a, i) => this.entorno.darPersonaje(a.id, personajes[i] ?? null));
  }

  /** Otra partida: la bolsa vacía y sin reparto aceptado. */
  olvidar(): void {
    this.bolsa.vaciar();
    this.setupAceptadoActual = null;
  }
}
