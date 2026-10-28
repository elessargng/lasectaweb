import { NARRADORES_VIRTUALES, type GuionNarradorVirtual, type IdNarradorVirtual } from '../../contrato/sala';
import type { SalaService } from '../SalaService';
import type { EstrategiaNarrador } from './estrategias/EstrategiaNarrador';
import { TontoYTu } from './estrategias/TontoYTu';
import { EsperandoJugadores } from './etapas/EsperandoJugadores';
import type { AccionJugador, ContextoEtapa, Etapa } from './etapas/Etapa';
import { exterminar } from './dia/exterminar';
import { comprobarFinal, esDemonio } from './final/comprobarFinal';
import { Revelando } from './etapas/Revelando';
import { Violinista } from './etapas/Violinista';
import { FRASES } from './frases';
import { prepararPartida } from './preparacion';
import type { Azar, MesaNarrador, Temporizador, Voz } from './puertos';

/** Lo que se elige al añadir un narrador virtual. */
export interface OpcionesNarradorVirtual {
  narrador: IdNarradorVirtual;
  guion: GuionNarradorVirtual;
  jugadores: number;
}

/**
 * Lo que las acciones de la sala usan del narrador virtual (se les inyecta): no
 * conocen el servicio concreto.
 */
export interface ServicioNarradorVirtual {
  /** Lo añade (preparando la partida) en nombre de `creador`. Devuelve el error, si lo hay. */
  anadir(creador: string, opciones: OpcionesNarradorVirtual): Promise<string | null>;
  quitar(): void;
  /** Un jugador le pide algo en el día (ya comprobado que puede). Devuelve el error, si lo hay. */
  pedir(jugador: string, accion: AccionJugador | 'exterminar', datos: unknown): Promise<string | null>;
}

/** Lo que espera a que alguien ocupe el asiento de quien se ha ido en plena partida (ms); si no, el Violinista. */
export const ESPERA_ABANDONO_MS = 120_000;

/** Las etapas con la partida en marcha (en las que irse de un asiento la deja coja). */
const EN_PARTIDA = ['noche', 'privados', 'puestaEnComun', 'nominaciones'];

/** Su avatar en la sala (hasta que tenga uno propio). */
const AVATAR_VIRTUAL = '/logo-2.png';

/** Cada narrador virtual, con su estrategia (null: aún no se puede usar). */
const ESTRATEGIAS: Record<IdNarradorVirtual, ((azar: Azar) => EstrategiaNarrador) | null> = {
  tontoYTu: (azar) => new TontoYTu(azar),
  jarvis: null,
};

/**
 * El narrador virtual de la sala (servicio de aplicación): lo añade y lo quita, y
 * lleva la partida pasando por sus etapas (patrón Estado). Actúa como un narrador
 * más: todo lo que hace va por las acciones de la sala (`MesaNarrador`), con sus
 * mismas reglas. Cada vez que cambia la sala (`alCambiarSala`), la etapa en curso
 * mira si le toca hacer algo. Sin nadie en la sala, se va solo.
 */
export class NarradorVirtualService implements ServicioNarradorVirtual {
  private etapa: Etapa | null = null;
  private estrategia: EstrategiaNarrador | null = null;
  /** Lo que salió al azar pero no va en la bolsa (el Borracho): se pone la primera noche. */
  private fuera: string[] = [];
  /** Revisando la sala ahora; `otraVez`: ha vuelto a cambiar mientras tanto. */
  private revisando = false;
  private otraVez = false;
  /** Los asientos que se han quedado libres en plena partida, con cómo dejar de esperar a que se ocupen. */
  private vacios = new Map<string, () => void>();

  constructor(
    private readonly sala: SalaService,
    /** La mesa del narrador virtual con ese participante. */
    private readonly mesaDe: (participanteId: string) => MesaNarrador,
    private readonly voz: Voz,
    private readonly temporizador: Temporizador,
    /** Manda la sala a todos (lo que cambia el propio narrador virtual sin pasar por una acción: su etapa). */
    private readonly difundir: () => void,
    private readonly azar: Azar = Math.random,
  ) {}

  async anadir(creador: string, { narrador, guion, jugadores }: OpcionesNarradorVirtual): Promise<string | null> {
    const datos = NARRADORES_VIRTUALES.find((n) => n.id === narrador);
    const crear = ESTRATEGIAS[narrador];
    if (!datos || !crear) return 'Ese narrador virtual aún no está disponible.';
    if (this.sala.hayNarrador()) return 'La sala ya tiene narrador.';
    const sentados = this.sala.asientos().filter((a) => a.ocupante).length;
    if (sentados > jugadores) return `Ya hay ${sentados} jugadores sentados: elige al menos ${sentados}.`;

    const participante = this.sala.anadirNarradorVirtual({ id: narrador, creador, guion, jugadores }, datos.nombre, AVATAR_VIRTUAL);
    this.estrategia = crear(this.azar);
    const preparada = await prepararPartida(this.sala, this.mesaDe(participante), this.estrategia, { guion, jugadores });
    if ('error' in preparada) {
      this.quitar();
      return preparada.error;
    }
    this.fuera = preparada.fuera;
    await this.pasarA(new EsperandoJugadores());
    return null;
  }

  quitar(): void {
    for (const cancelar of this.vacios.values()) cancelar();
    this.vacios.clear();
    this.etapa?.alSalir?.();
    this.etapa = null;
    this.estrategia = null;
    this.fuera = [];
    this.sala.quitarNarradorVirtual();
  }

  async pedir(jugador: string, accion: AccionJugador | 'exterminar', datos: unknown): Promise<string | null> {
    if (!this.etapa || !this.sala.narradorVirtual()) return 'La sala no tiene narrador virtual.';
    if (accion === 'exterminar') {
      const asientoId = (datos as { asientoId?: unknown } | null)?.asientoId;
      if (typeof asientoId !== 'string' || !this.sala.hayAsiento(asientoId)) return 'Ese asiento ya no existe.';
      if (this.sala.asientoDe(jugador)?.id === asientoId) return 'No puedes dispararte a ti.';
      const ctx = this.contexto();
      if (await exterminar(ctx, jugador, asientoId)) {
        // Si ha caído el demonio, se acaba
        const ganador = await comprobarFinal(ctx);
        if (ganador) await this.pasarA(new Revelando(ganador));
      }
      return null;
    }
    return this.etapa.alPedir ? this.etapa.alPedir(this.contexto(), jugador, accion, datos) : 'Ahora no es el momento.';
  }

  /** Lo que salió al azar pero no va en la bolsa (ver `prepararPartida`). */
  fueraDeLaBolsa(): string[] {
    return [...this.fuera];
  }

  /**
   * La sala ha cambiado: la etapa en curso mira si le toca algo. No se mete en
   * medio de otra revisión: si cambia mientras revisa, vuelve a mirar al acabar.
   */
  alCambiarSala(): void {
    if (!this.sala.narradorVirtual()) return;
    if (this.revisando) {
      this.otraVez = true;
      return;
    }
    this.temporizador.programar(0, () => void this.revisar());
  }

  private async revisar(): Promise<void> {
    if (this.revisando) return;
    this.revisando = true;
    try {
      do {
        this.otraVez = false;
        if (!this.sala.narradorVirtual()) return;
        // Sin nadie en la sala (solo él), se va
        if (!this.sala.participantes().some((p) => !p.virtual)) {
          this.quitar();
          return;
        }
        this.vigilarAsientos();
        await this.etapa?.alCambiar?.(this.contexto());
      } while (this.otraVez);
    } finally {
      this.revisando = false;
    }
  }

  /**
   * En plena partida, un asiento que se queda libre (su jugador se ha ido): se
   * espera un rato a que alguien lo ocupe; si no, se acaba con el Violinista o, si
   * quien se fue era el demonio, gana el bando bueno.
   */
  private vigilarAsientos(): void {
    const enPartida = !!this.etapa && EN_PARTIDA.includes(this.etapa.id);
    const asientos = this.sala.asientos();
    for (const [id, cancelar] of this.vacios) {
      if (!enPartida || asientos.find((a) => a.id === id)?.ocupante !== null) {
        cancelar();
        this.vacios.delete(id);
      }
    }
    if (!enPartida) return;
    for (const a of asientos) {
      if (a.ocupante || this.vacios.has(a.id)) continue;
      this.vacios.set(
        a.id,
        this.temporizador.programar(ESPERA_ABANDONO_MS, () => {
          this.vacios.delete(a.id);
          void this.abandonado(a.id);
        }),
      );
    }
  }

  private async abandonado(asientoId: string): Promise<void> {
    const asiento = this.sala.asientos().find((a) => a.id === asientoId);
    if (!asiento || asiento.ocupante || !this.etapa || !EN_PARTIDA.includes(this.etapa.id)) return;
    if (esDemonio(this.sala, asiento) && !asiento.muerto) {
      await this.pasarA(new Revelando('bueno'));
      return;
    }
    await this.pasarA(new Violinista());
  }

  private contexto(): ContextoEtapa {
    const narrador = this.sala.narradorVirtual();
    if (!narrador || !this.estrategia) throw new Error('No hay narrador virtual.');
    return {
      sala: this.sala,
      mesa: this.mesaDe(narrador.participante),
      estrategia: this.estrategia,
      temporizador: this.temporizador,
      decir: (texto) => {
        this.sala.actualizarNarradorVirtual({ frase: texto });
        this.voz.decir(texto);
      },
      pasarA: (etapa) => this.pasarA(etapa),
      fueraDeLaBolsa: () => this.fueraDeLaBolsa(),
    };
  }

  private async pasarA(etapa: Etapa): Promise<void> {
    this.etapa?.alSalir?.();
    this.etapa = etapa;
    this.sala.actualizarNarradorVirtual({ etapa: etapa.id });
    this.difundir();
    await etapa.alEntrar?.(this.contexto());
    // Por si ya le toca algo (la mesa ya estaba llena)
    this.alCambiarSala();
  }
}
