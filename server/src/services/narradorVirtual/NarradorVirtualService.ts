import { NARRADORES_VIRTUALES, type GuionNarradorVirtual, type IdNarradorVirtual } from '../../contrato/sala';
import type { SalaService } from '../SalaService';
import type { EstrategiaNarrador } from './estrategias/EstrategiaNarrador';
import { TontoYTu } from './estrategias/TontoYTu';
import { EsperandoJugadores } from './etapas/EsperandoJugadores';
import { decisionesDe, type AccionJugador, type ContextoEtapa, type Etapa } from './etapas/Etapa';
import type { RespuestaArtista } from '../../contrato/artista';
import { preguntarComoArtista } from './dia/artista';
import { contarDisparo, exterminar } from './dia/exterminar';
import { contarPatoso } from './dia/patoso';
import { vivo } from './mesaDeJuego';
import { comprobarFinal, esDemonio, type Ganador } from './final/comprobarFinal';
import { Revelando } from './etapas/Revelando';
import { Violinista } from './etapas/Violinista';
import { FRASES } from './frases';
import { recuerdosNuevos } from './noche/criterioDroison';
import { prepararPartida, type FueraDeLaBolsa } from './preparacion';
import type { Azar, BolsasRecientes, MesaNarrador, ModelosJarvis, Temporizador, Voz } from './puertos';
import { ConRespaldo } from './estrategias/ConRespaldo';
import { Jarvis } from './estrategias/Jarvis';

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
  pedir(jugador: string, accion: AccionJugador | AccionSuelta, datos: unknown): Promise<string | null>;
  /** Un jugador le hace la pregunta del Artista (ya comprobado que puede): la respuesta o el error. */
  preguntarArtista(jugador: string, datos: unknown): Promise<{ error: string } | { respuesta: RespuestaArtista }>;
}

/** Lo que piden los jugadores fuera de los turnos del día: disparar como Exterminador, declararse Patoso. */
export type AccionSuelta = 'exterminar' | 'patoso';

/** Lo que espera a que alguien ocupe el asiento de quien se ha ido en plena partida (ms); si no, el Violinista. */
export const ESPERA_ABANDONO_MS = 120_000;

/** Las etapas con la partida en marcha (en las que irse de un asiento la deja coja). */
const EN_PARTIDA = ['noche', 'privados', 'puestaEnComun', 'nominaciones'];

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
  /** Lo que salió pero no va en la bolsa (el Borracho, y qué cree ser): se pone la primera noche. */
  private fuera: FueraDeLaBolsa[] = [];
  /** Lo que recuerda de la partida (ver ContextoEtapa.recuerdos). */
  private recuerdos = recuerdosNuevos();
  /** Contando un disparo del Exterminador o lo que elige un Patoso (con sus pausas): hasta que acaba, no se cuenta otro. */
  private contando = false;
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
    /** Para Jarvis (sin esto, no se puede añadir). */
    private readonly modelos: ModelosJarvis | null = null,
    /** Las bolsas de las últimas partidas de quien lo añade (sin esto, no se tienen en cuenta). */
    private readonly bolsas: BolsasRecientes | null = null,
  ) {}

  async anadir(creador: string, { narrador, guion, jugadores }: OpcionesNarradorVirtual): Promise<string | null> {
    const datos = NARRADORES_VIRTUALES.find((n) => n.id === narrador);
    if (!datos?.disponible) return 'Ese narrador virtual aún no está disponible.';
    const libre = () => {
      if (this.sala.hayNarrador()) return 'La sala ya tiene narrador.';
      const sentados = this.sala.asientos().filter((a) => a.ocupante).length;
      return sentados > jugadores ? `Ya hay ${sentados} jugadores sentados: elige al menos ${sentados}.` : null;
    };
    const ocupada = libre();
    if (ocupada) return ocupada;
    const estrategia = narrador === 'jarvis' ? await this.estrategiaJarvis(creador) : new TontoYTu(this.azar);
    if (typeof estrategia === 'string') return estrategia;
    // Mientras se comprobaba el modelo, puede haber cambiado la sala
    const ocupadaYa = libre();
    if (ocupadaYa) return ocupadaYa;

    const participante = this.sala.anadirNarradorVirtual({ id: narrador, creador, guion, jugadores }, datos.nombre, datos.avatar);
    this.estrategia = estrategia;
    // Si no se pueden leer o apuntar las recientes, la partida sigue igual
    const recientes = (await this.bolsas?.de(creador).catch(() => null)) ?? [];
    const preparada = await prepararPartida(this.sala, this.mesaDe(participante), (d) => this.contextoDecisiones().decidir(d), {
      guion,
      jugadores,
      azar: this.azar,
      recientes,
    });
    if ('error' in preparada) {
      this.quitar();
      return preparada.error;
    }
    this.fuera = preparada.fuera;
    void this.bolsas?.apuntar(creador, [...preparada.personajes, ...preparada.fuera.map((f) => f.personaje)]).catch(() => undefined);
    this.recuerdos = recuerdosNuevos();
    // Saluda al llegar (lo oyen y lo ven todos al pasar a esperar jugadores)
    this.contexto().decir(FRASES.saludo(this.azar));
    await this.pasarA(new EsperandoJugadores());
    return null;
  }

  /**
   * Jarvis, con el modelo de quien lo añade (comprobado ahora) y «Tonto y tú» de
   * respaldo; si deja de responder del todo, se va y sigue «Tonto y tú». O el error.
   */
  private async estrategiaJarvis(creador: string): Promise<EstrategiaNarrador | string> {
    const datos = await this.modelos?.modeloDe(creador);
    if (!this.modelos || datos === undefined) return 'Jarvis no está disponible en este servidor.';
    if (datos === 'sinCuenta') return 'Para añadir a Jarvis necesitas una cuenta.';
    if (!datos) return 'Jarvis no está disponible en este servidor.';
    const cliente = this.modelos.cliente(datos);
    const error = await cliente.comprobar();
    if (error) return `El modelo de Jarvis no responde: ${error}`;
    const respaldo = new TontoYTu(this.azar);
    return new ConRespaldo(new Jarvis(cliente), respaldo, this.temporizador, () => this.jarvisSeVa(respaldo));
  }

  /** Jarvis no consigue hablar con su modelo: lo dice y sigue la partida «Tonto y tú». */
  private jarvisSeVa(tonto: EstrategiaNarrador): void {
    if (!this.sala.narradorVirtual()) return;
    this.estrategia = tonto;
    const tontoYTu = NARRADORES_VIRTUALES.find((n) => n.id === 'tontoYTu')!;
    this.sala.relevarNarradorVirtual('tontoYTu', tontoYTu.nombre, tontoYTu.avatar);
    this.contexto().decir(FRASES.jarvisSeVa());
    this.difundir();
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

  async pedir(jugador: string, accion: AccionJugador | AccionSuelta, datos: unknown): Promise<string | null> {
    if (!this.etapa || !this.sala.narradorVirtual()) return 'La sala no tiene narrador virtual.';
    if (accion === 'exterminar' || accion === 'patoso') {
      const asientoId = (datos as { asientoId?: unknown } | null)?.asientoId;
      if (typeof asientoId !== 'string' || !this.sala.hayAsiento(asientoId)) return 'Ese asiento ya no existe.';
      const mio = this.sala.asientoDe(jugador)?.id;
      if (mio === asientoId) return accion === 'exterminar' ? 'No puedes dispararte a ti.' : 'Elige a otro jugador.';
      if (this.contando) return 'Espera a que el narrador termine de contar lo anterior.';
      const ctx = this.contexto();
      let contar: Promise<Ganador | null>;
      if (accion === 'patoso') {
        if (!mio) return 'No estás sentado.';
        if (!vivo(this.sala.asientos().find((a) => a.id === asientoId)!)) return 'Elige a un jugador vivo.';
        contar = contarPatoso(ctx, mio, asientoId);
      } else {
        const muere = await exterminar(ctx, jugador, asientoId);
        contar = contarDisparo(ctx, jugador, asientoId, muere);
      }
      // Se cuenta con pausas (sin hacer esperar a quien lo pide); si se acaba la partida, se revela
      this.contando = true;
      void contar
        .then(async (ganador) => {
          if (ganador && this.sala.narradorVirtual()) await this.pasarA(new Revelando(ganador));
        })
        .finally(() => (this.contando = false));
      return null;
    }
    return this.etapa.alPedir ? this.etapa.alPedir(this.contexto(), jugador, accion, datos) : 'Ahora no es el momento.';
  }

  async preguntarArtista(jugador: string, datos: unknown): Promise<{ error: string } | { respuesta: RespuestaArtista }> {
    if (!this.etapa || !this.sala.narradorVirtual()) return { error: 'La sala no tiene narrador virtual.' };
    return preguntarComoArtista(this.contexto(), jugador, datos);
  }

  /** Lo que salió pero no va en la bolsa (ver `prepararPartida`). */
  fueraDeLaBolsa(): FueraDeLaBolsa[] {
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
        await this.concederGrimorios();
        await this.etapa?.alCambiar?.(this.contexto());
      } while (this.otraVez);
    } finally {
      this.revisando = false;
    }
  }

  /** A los visitantes que piden ver el grimorio, se lo concede (como haría un narrador). */
  private async concederGrimorios(): Promise<void> {
    const narrador = this.sala.narradorVirtual();
    if (!narrador) return;
    for (const p of this.sala.participantes()) {
      if (p.rol === 'visitante' && p.accesoGrimorio === 'solicitado') {
        await this.mesaDe(narrador.participante).accion('narrador:accesoGrimorio', { participanteId: p.id, conceder: true });
      }
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
      ...this.contextoDecisiones(),
      azar: this.azar,
      temporizador: this.temporizador,
      decir: (texto) => {
        this.sala.actualizarNarradorVirtual({ frase: texto });
        this.voz.decir(texto);
      },
      pasarA: (etapa) => this.pasarA(etapa),
      fueraDeLaBolsa: () => this.fueraDeLaBolsa(),
      recuerdos: this.recuerdos,
    };
  }

  /** Las decisiones con la estrategia de ahora (si se cambia a media partida, la nueva). */
  private contextoDecisiones() {
    return decisionesDe(this.sala, () => this.estrategia ?? new TontoYTu(this.azar));
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
