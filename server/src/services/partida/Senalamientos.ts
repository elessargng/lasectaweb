import { randomUUID } from 'crypto';
import type { Participante } from '../sala/Participantes';
import type { FaseDto, SenalamientoDto } from '../../contrato/partida';
import type { Jugador } from './Jugador';

/** Lo que el señalamiento necesita saber de la sala. */
export interface EntornoSenalamiento {
  /** Los jugadores de la plaza como están ahora. */
  plaza(): readonly Jugador[];
  fase(): FaseDto;
  /** El asiento en el que se sienta un participante, o null. */
  jugadorDe(participanteId: string): Jugador | null;
  /** Un visitante ve el grimorio del narrador. */
  veGrimorio(participanteId: string): boolean;
  /** Despierta a un asiento (de noche, los que señalan). */
  despertar(asientoId: string): void;
}

/**
 * El señalamiento: el narrador pide que unos jugadores señalen a otros (con un
 * mensaje y una cuenta atrás o sin ella). De día lo ven todos; de noche, solo
 * los que señalan y quien ve el grimorio. No comprueba permisos.
 */
export class Senalamientos {
  /** El señalamiento (ver SalaDto.senalamiento), o null. */
  private actual: SenalamientoDto | null = null;

  constructor(private readonly entorno: EntornoSenalamiento) {}

  /**
   * El señalamiento, o null. Al leerlo se pone al día: los asientos que ya no
   * existen salen, y con la cuenta atrás acabada queda congelado.
   */
  senalamiento(): SenalamientoDto | null {
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
    const asiento = this.entorno.jugadorDe(participante.id);
    return !!asiento && s.senaladores.includes(asiento.id);
  }

  /**
   * Empieza un señalamiento (sustituye al que hubiera). Sin asientos que señalan
   * o que se pueden señalar, todos. De día es público; de noche se despierta a
   * los que señalan. `segundos` null: sin cuenta atrás. No valida los datos.
   */
  empezar(datos: {
    tipo?: SenalamientoDto['tipo'];
    mensaje: string;
    segundos: number | null;
    senaladores: string[];
    objetivos: string[];
  }): void {
    const todos = this.entorno.plaza().map((a) => a.id);
    const deLaMesa = (ids: string[]) => (ids.length ? todos.filter((id) => ids.includes(id)) : todos);
    const publico = this.entorno.fase().momento !== 'noche';
    const inicio = Date.now();
    this.actual = {
      id: randomUUID(),
      tipo: datos.tipo ?? 'normal',
      mensaje: datos.mensaje,
      senaladores: deLaMesa(datos.senaladores),
      objetivos: deLaMesa(datos.objetivos),
      publico,
      inicio,
      fin: datos.segundos === null ? null : inicio + datos.segundos * 1000,
      congelado: false,
      senales: {},
    };
    if (!publico) for (const id of this.actual.senaladores) this.entorno.despertar(id);
  }

  /** El jugador de un asiento que señala, señala a otro (null: deja de señalar). Devuelve el error, si lo hay. */
  senalar(participanteId: string, objetivo: string | null): string | null {
    const s = this.senalamiento() && this.actual!;
    if (!s) return 'No hay ningún señalamiento.';
    if (s.congelado) return 'El señalamiento ya ha terminado.';
    const asiento = this.entorno.jugadorDe(participanteId);
    if (!asiento || !s.senaladores.includes(asiento.id)) return 'No te toca señalar.';
    if (objetivo === null) {
      delete s.senales[asiento.id];
      return null;
    }
    if (!s.objetivos.includes(objetivo)) return 'Ese asiento no se puede señalar.';
    s.senales[asiento.id] = objetivo;
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
  instantanea(): SenalamientoDto | null {
    return this.actual;
  }

  restaurar(senalamiento: SenalamientoDto): void {
    this.actual = senalamiento;
  }
}
