import { randomUUID } from 'crypto';
import type { MensajeDespertar, SalaAsiento, SalaDespertar, SalaFase } from '../../contrato/sala';

/** Mensajes que se guardan en cada despertar (los más antiguos se descartan). */
export const SALA_MENSAJES_DESPERTAR_MAX = 300;

/** Un despertar abierto: el asiento, quién estaba sentado al abrirlo y lo que se han dicho. */
export interface HiloDespertar {
  asiento: string;
  ocupante: string | null;
  mensajes: MensajeDespertar[];
}

/**
 * Los despertares de la noche: lo que se dicen el narrador y el jugador de un
 * asiento. Uno por asiento, con quién estaba sentado al abrirlo (null: estaba
 * libre; un asiento libre cuenta como un jugador más). No comprueba permisos.
 */
export class Despertares {
  private hilos: HiloDespertar[] = [];

  constructor(
    /** La mesa como está ahora. */
    private readonly mesa: () => SalaAsiento[],
    /** La fase de la partida, para fechar los mensajes. */
    private readonly fase: () => SalaFase,
  ) {}

  /**
   * Se aplica al leer: si el jugador de un asiento se levanta, cambia de asiento,
   * alguien se sienta en el que estaba libre o el asiento se quita, ese
   * despertar se cierra (lo dicho era para otro).
   */
  private alDia(): HiloDespertar[] {
    const mesa = this.mesa();
    this.hilos = this.hilos.filter((h) => mesa.some((a) => a.id === h.asiento && a.ocupante === h.ocupante));
    return this.hilos;
  }

  /** Todos los despertares, en el orden en que se abrieron. */
  despertares(): SalaDespertar[] {
    return this.alDia().map((h) => ({ asiento: h.asiento, mensajes: h.mensajes.map((m) => ({ ...m })) }));
  }

  hayDespertar(asientoId: string): boolean {
    return this.alDia().some((h) => h.asiento === asientoId);
  }

  /** El asiento con despertar de este participante, o null. */
  asientoDespiertoDe(participanteId: string): string | null {
    return this.alDia().find((h) => h.ocupante === participanteId)?.asiento ?? null;
  }

  /** Abre el despertar de un asiento (si ya lo tiene, no hace nada). Devuelve el error, si lo hay. */
  despertar(asientoId: string): string | null {
    const asiento = this.mesa().find((a) => a.id === asientoId);
    if (!asiento) return 'Ese asiento ya no existe.';
    if (!this.hayDespertar(asientoId)) this.hilos.push({ asiento: asientoId, ocupante: asiento.ocupante, mensajes: [] });
    return null;
  }

  /** Guarda un mensaje en el despertar de un asiento. No valida: lo hace quien lo llama. */
  enviar(asientoId: string, mensaje: Omit<MensajeDespertar, 'id' | 'hora' | 'fase'>): void {
    const hilo = this.alDia().find((h) => h.asiento === asientoId);
    if (!hilo) return;
    const { momento, numero } = this.fase();
    hilo.mensajes.push({ ...mensaje, id: randomUUID(), hora: Date.now(), fase: { momento, numero } });
    if (hilo.mensajes.length > SALA_MENSAJES_DESPERTAR_MAX) hilo.mensajes.shift();
  }

  /** Una copia de los despertares abiertos, para devolverlos con la máquina del tiempo. */
  instantanea(): HiloDespertar[] {
    return this.hilos.map((h) => ({ ...h, mensajes: [...h.mensajes] }));
  }

  /** Vuelven los despertares de una instantánea. */
  restaurar(hilos: HiloDespertar[]): void {
    this.hilos = hilos;
  }

  /** Se acaban todos (al amanecer o en otra partida). */
  cerrarTodos(): void {
    this.hilos = [];
  }

  /** Los asientos han cambiado de sitio (ver SalaService.llevarFichas): cada despertar va con el suyo. */
  remapear(a: (asientoId: string) => string): void {
    for (const h of this.hilos) h.asiento = a(h.asiento);
  }
}
