import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';

/** Lo que contesta un caso de uso de la sala: hecho (con lo que devuelva, si algo) o no, y por qué. */
export type ResultadoUso = { ok: true; valor?: string } | { ok: false; error: string };

/** Si alguien puede hacer algo ahora: null o, si no, por qué. */
export type Permiso = (juego: SalaDeJuego, yo: Participante) => string | null;

/**
 * Lo común a los servicios de cada parte de la sala (BolsaService, RelojService…):
 * con su tabla de permisos, quién lo pide, lo que puede hacer ahora y hacerlo si
 * puede, avisando de que la sala ha cambiado.
 */
export class UsosSala<U extends string> {
  constructor(
    private readonly juego: SalaDeJuego,
    private readonly permisos: Record<U, Permiso>,
    /** La sala ha cambiado: se manda a todos. */
    private readonly alCambiar: () => void,
  ) {}

  /** El participante de una sesión (su id), o null si ya no está en la sala. */
  quienEs(clave: string): string | null {
    return this.juego.sala.participantes.participanteDe(clave)?.id ?? null;
  }

  /** De estos usos, los que puede hacer ahora (para que el cliente pinte sus botones). */
  permitidos(yo: Participante, usos: readonly U[]): U[] {
    return usos.filter((uso) => this.permisos[uso](this.juego, yo) === null);
  }

  /**
   * Si puede, lo hace (`hacer` devuelve el error del dominio, null o, si contesta
   * algo, { valor }); si sale bien, avisa del cambio.
   */
  hacer(yoId: string, uso: U, hacer: () => string | null | { valor: string }): ResultadoUso {
    const noPuede = this.noPuede(yoId, uso);
    return noPuede ? { ok: false, error: noPuede } : this.hecho(hacer());
  }

  /** Como hacer, con algo que tarda (el narrador virtual prepara la partida, cuenta una declaración…). */
  async hacerAsincrono(yoId: string, uso: U, hacer: () => Promise<string | null | { valor: string }>): Promise<ResultadoUso> {
    const noPuede = this.noPuede(yoId, uso);
    return noPuede ? { ok: false, error: noPuede } : this.hecho(await hacer());
  }

  /** Por qué no puede (no está en la sala, o su permiso), o null. */
  private noPuede(yoId: string, uso: U): string | null {
    const yo = this.juego.sala.participantes.buscar(yoId);
    return yo ? this.permisos[uso](this.juego, yo) : 'No estás en la sala.';
  }

  /** Lo que contesta: el error del dominio o, si ha salido bien (y se avisa del cambio), su valor. */
  private hecho(hecho: string | null | { valor: string }): ResultadoUso {
    if (typeof hecho === 'string') return { ok: false, error: hecho };
    this.alCambiar();
    return hecho ? { ok: true, valor: hecho.valor } : { ok: true };
  }
}
