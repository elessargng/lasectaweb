import { randomUUID } from 'crypto';
import type { MensajeDespertar } from '../compartido/despertar';
import type { Fase } from '../compartido/partida';
import type { Diario } from './eventos';
import type { Jugador } from './Jugador';

/** Mensajes que se guardan en cada despertar (los más antiguos se descartan). */
export const SALA_MENSAJES_DESPERTAR_MAX = 300;

/** Un despertar abierto: el jugador, quién lo jugaba al abrirlo y lo que se han dicho. */
export interface HiloDespertar {
  jugador: string;
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
    /** Los jugadores de la plaza como están ahora. */
    private readonly plaza: () => readonly Jugador[],
    /** La fase de la partida, para fechar los mensajes. */
    private readonly fase: () => Fase,
    private readonly diario: Diario,
  ) {}

  /**
   * Se aplica al leer: si el jugador de un asiento se levanta, cambia de asiento,
   * alguien se sienta en el que estaba libre o el asiento se quita, ese
   * despertar se cierra (lo dicho era para otro).
   */
  private alDia(): HiloDespertar[] {
    const plaza = this.plaza();
    this.hilos = this.hilos.filter((h) => plaza.some((a) => a.id === h.jugador && a.participanteId === h.ocupante));
    return this.hilos;
  }

  /** Todos los despertares, en el orden en que se abrieron (copias). */
  despertares(): HiloDespertar[] {
    return this.alDia().map((h) => ({ ...h, mensajes: h.mensajes.map((m) => ({ ...m })) }));
  }

  hayDespertar(jugadorId: string): boolean {
    return this.alDia().some((h) => h.jugador === jugadorId);
  }

  /**
   * El asiento con despertar de este participante, o null. Para el jugador, el
   * despertar empieza cuando el narrador le manda algo: hasta entonces, ni lo ve ni contesta.
   */
  asientoDespiertoDe(participanteId: string): string | null {
    return (
      this.alDia().find((h) => h.ocupante === participanteId && h.mensajes.some((m) => m.autor === 'narrador'))?.jugador ?? null
    );
  }

  /** Abre el despertar de un asiento (si ya lo tiene, no hace nada). Devuelve el error, si lo hay. */
  despertar(jugadorId: string): string | null {
    const jugador = this.plaza().find((a) => a.id === jugadorId);
    if (!jugador) return 'Ese asiento ya no existe.';
    if (!this.hayDespertar(jugadorId)) this.hilos.push({ jugador: jugadorId, ocupante: jugador.participanteId, mensajes: [] });
    return null;
  }

  /**
   * Lo último que el narrador ha mandado a un asiento lo mandó el despertar guiado
   * (ver MensajeDespertar.guiado).
   */
  respuestaGuiada(jugadorId: string): boolean {
    const hilo = this.alDia().find((h) => h.jugador === jugadorId);
    return !!hilo && !![...hilo.mensajes].reverse().find((m) => m.autor === 'narrador')?.guiado;
  }

  /**
   * A lo último del despertar de un asiento le falta el «Entendido»: es del narrador
   * y no es un «Entendido» suyo (a lo que ha elegido el jugador). Sin despertar, no.
   */
  porEntender(jugadorId: string): boolean {
    const ultimo = this.alDia().find((h) => h.jugador === jugadorId)?.mensajes.slice(-1)[0];
    return !!ultimo && ultimo.autor === 'narrador' && ultimo.ficha !== 'entendido';
  }

  /**
   * Guarda un mensaje en el despertar de un asiento (sin `eleccion`: una libre; sin
   * `guiado`, no lo es) y lo apunta en el diario. Sin despertar, nada. No valida: lo hace quien lo llama.
   */
  enviar(
    jugadorId: string,
    mensaje: Omit<MensajeDespertar, 'id' | 'hora' | 'fase' | 'eleccion' | 'guiado'> & Partial<Pick<MensajeDespertar, 'eleccion' | 'guiado'>>,
  ): void {
    const hilo = this.alDia().find((h) => h.jugador === jugadorId);
    if (!hilo) return;
    const { momento, numero } = this.fase();
    hilo.mensajes.push({ eleccion: null, guiado: false, ...mensaje, id: randomUUID(), hora: Date.now(), fase: { momento, numero } });
    if (hilo.mensajes.length > SALA_MENSAJES_DESPERTAR_MAX) hilo.mensajes.shift();
    this.diario.anotar({
      tipo: 'despertar',
      asiento: this.diario.asiento(jugadorId),
      delNarrador: mensaje.autor === 'narrador',
      ficha: mensaje.ficha,
      tarjeta: mensaje.tarjeta,
      jugadores: mensaje.jugadores.map((id) => this.diario.asiento(id)),
      personajes: mensaje.personajes,
      texto: mensaje.texto,
      alineamiento: mensaje.alineamiento,
      eleccion: mensaje.eleccion?.cantidad ?? null,
    });
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
}
