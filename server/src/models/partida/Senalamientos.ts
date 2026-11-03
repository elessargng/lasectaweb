import { randomUUID } from 'crypto';
import type { Participante } from '../sala/Participantes';
import { SALA_SENALAMIENTO, type Fase } from '../compartido/partida';
import type { Jugador } from './Jugador';

/**
 * Un señalamiento: unos jugadores señalan a otros. Mientras dura la cuenta atrás
 * cada uno elige (y puede cambiar); al acabar se congela.
 */
export interface Senalamiento {
  id: string;
  /** 'normal', o el de Lil' Monsta: los esbirros eligen quién lo cuida, sin cuenta atrás. */
  tipo: 'normal' | 'lilmonsta';
  /** Lo que se pide (puede ir vacío). */
  mensaje: string;
  /** Los jugadores que señalan y los que se pueden señalar (si no se eligió ninguno, todos). */
  senaladores: string[];
  objetivos: string[];
  /** De día: lo ven todos. */
  publico: boolean;
  /** Cuándo empezó y cuándo acaba la cuenta atrás (ms); fin null: sin cuenta atrás. */
  inicio: number;
  fin: number | null;
  /** Ya no se puede señalar: acabó la cuenta atrás o (Lil' Monsta) todos coinciden. */
  congelado: boolean;
  /** A quién señala cada jugador (el que señala → el señalado). */
  senales: Record<string, string>;
}

/** Lo que el señalamiento necesita saber de la sala. */
export interface EntornoSenalamiento {
  /** Los jugadores de la plaza como están ahora. */
  plaza(): readonly Jugador[];
  fase(): Fase;
  /** El asiento en el que se sienta un participante, o null. */
  jugadorDe(participanteId: string): Jugador | null;
  /** Un visitante ve el grimorio del narrador. */
  veGrimorio(participanteId: string): boolean;
  /** Despierta a un asiento (de noche, los que señalan). */
  despertar(jugadorId: string): void;
}

/**
 * El señalamiento: el narrador pide que unos jugadores señalen a otros (con un
 * mensaje y una cuenta atrás o sin ella). De día lo ven todos; de noche, solo
 * los que señalan y quien ve el grimorio. No comprueba permisos.
 */
export class Senalamientos {
  /** El señalamiento en curso (o ya congelado), o null. */
  private actual: Senalamiento | null = null;

  constructor(private readonly entorno: EntornoSenalamiento) {}

  /**
   * El señalamiento, o null. Al leerlo se pone al día: los asientos que ya no
   * existen salen, y con la cuenta atrás acabada queda congelado.
   */
  senalamiento(): Senalamiento | null {
    const s = this.actual;
    if (!s) return null;
    const ids = new Set(this.entorno.plaza().map((a) => a.id));
    s.senaladores = s.senaladores.filter((id) => ids.has(id));
    s.objetivos = s.objetivos.filter((id) => ids.has(id));
    for (const [desde, hasta] of Object.entries(s.senales)) if (!ids.has(desde) || !ids.has(hasta)) delete s.senales[desde];
    if (!s.congelado && s.fin !== null && Date.now() >= s.fin) s.congelado = true;
    return { ...s, senaladores: [...s.senaladores], objetivos: [...s.objetivos], senales: { ...s.senales } };
  }

  /**
   * Si este participante ve el señalamiento: de día, todos; de noche, los
   * narradores, los visitantes que ven el grimorio y los jugadores sentados en
   * un asiento que señala.
   */
  veSenalamiento(participante: Participante): boolean {
    const s = this.actual;
    if (!s) return false;
    if (s.publico || participante.rol === 'narrador') return true;
    if (participante.rol === 'visitante') return this.entorno.veGrimorio(participante.id);
    const jugador = this.entorno.jugadorDe(participante.id);
    return !!jugador && s.senaladores.includes(jugador.id);
  }

  /**
   * Empieza un señalamiento (sustituye al que hubiera). Sin asientos que señalan
   * o que se pueden señalar, todos. De día es público; de noche se despierta a
   * los que señalan. `segundos` null: sin cuenta atrás. Si la cuenta atrás no
   * dura lo que puede durar o algún asiento ya no está, el error.
   */
  empezar(datos: {
    tipo?: Senalamiento['tipo'];
    mensaje: string;
    segundos: number | null;
    senaladores: readonly string[];
    objetivos: readonly string[];
  }): string | null {
    const { minSegundos, maxSegundos, mensajeMax } = SALA_SENALAMIENTO;
    if (datos.segundos !== null && !Number.isInteger(datos.segundos)) return 'Indica cuántos segundos dura la cuenta atrás.';
    if (datos.segundos !== null && (datos.segundos < minSegundos || datos.segundos > maxSegundos)) {
      return `La cuenta atrás tiene que durar entre ${minSegundos} y ${maxSegundos} segundos.`;
    }
    const todos = this.entorno.plaza().map((a) => a.id);
    if ([...datos.senaladores, ...datos.objetivos].some((id) => !todos.includes(id))) return 'Alguno de esos asientos ya no existe.';
    const deLaPlaza = (ids: readonly string[]) => (ids.length ? todos.filter((id) => ids.includes(id)) : todos);
    const publico = this.entorno.fase().momento !== 'noche';
    const inicio = Date.now();
    this.actual = {
      id: randomUUID(),
      tipo: datos.tipo ?? 'normal',
      mensaje: datos.mensaje.replace(/\s+/g, ' ').trim().slice(0, mensajeMax),
      senaladores: deLaPlaza(datos.senaladores),
      objetivos: deLaPlaza(datos.objetivos),
      publico,
      inicio,
      fin: datos.segundos === null ? null : inicio + datos.segundos * 1000,
      congelado: false,
      senales: {},
    };
    if (!publico) for (const id of this.actual.senaladores) this.entorno.despertar(id);
    return null;
  }

  /** El jugador de un asiento que señala, señala a otro (null: deja de señalar). Devuelve el error, si lo hay. */
  senalar(participanteId: string, objetivo: string | null): string | null {
    const s = this.senalamiento() && this.actual!;
    if (!s) return 'No hay ningún señalamiento.';
    if (s.congelado) return 'El señalamiento ya ha terminado.';
    const jugador = this.entorno.jugadorDe(participanteId);
    if (!jugador || !s.senaladores.includes(jugador.id)) return 'No te toca señalar.';
    if (objetivo === null) {
      delete s.senales[jugador.id];
      return null;
    }
    if (!s.objetivos.includes(objetivo)) return 'Ese asiento no se puede señalar.';
    s.senales[jugador.id] = objetivo;
    return null;
  }

  /** Ya no se puede señalar (Lil' Monsta: cuando todos coinciden). */
  congelar(): void {
    if (this.actual) this.actual.congelado = true;
  }

  /** Quita el señalamiento. */
  terminar(): void {
    this.actual = null;
  }

  /** El señalamiento tal cual, para que la máquina del tiempo lo devuelva. */
  instantanea(): Senalamiento | null {
    return this.actual;
  }

  restaurar(senalamiento: Senalamiento): void {
    this.actual = senalamiento;
  }
}
