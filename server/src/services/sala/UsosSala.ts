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
    const yo = this.juego.sala.participantes.buscar(yoId);
    if (!yo) return { ok: false, error: 'No estás en la sala.' };
    const noPuede = this.permisos[uso](this.juego, yo);
    if (noPuede) return { ok: false, error: noPuede };
    const hecho = hacer();
    if (typeof hecho === 'string') return { ok: false, error: hecho };
    this.alCambiar();
    return hecho ? { ok: true, valor: hecho.valor } : { ok: true };
  }
}
