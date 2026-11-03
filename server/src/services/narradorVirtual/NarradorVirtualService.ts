import {
  NARRADORES_VIRTUALES,
  type GuionNarradorVirtual,
  type IdNarradorVirtual,
} from '../../models/compartido/narradorVirtual';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import type { EstrategiaNarrador } from '../../models/narradorVirtual/estrategias/EstrategiaNarrador';
import { TontoYTu } from '../../models/narradorVirtual/estrategias/TontoYTu';
import { EsperandoJugadores } from '../../models/narradorVirtual/etapas/EsperandoJugadores';
import { decisionesDe, type AccionJugador, type ContextoEtapa, type Etapa } from '../../models/narradorVirtual/etapas/Etapa';
import { DECLARACIONES_DIA } from '../../models/personajes';
import { comprobarFinal, esDemonio } from '../../models/narradorVirtual/final/comprobarFinal';
import { Revelando } from '../../models/narradorVirtual/etapas/Revelando';
import { Violinista } from '../../models/narradorVirtual/etapas/Violinista';
import { FRASES } from '../../models/narradorVirtual/frases';
import { recuerdosNuevos } from '../../models/narradorVirtual/noche/criterioDroison';
import { prepararPartida, type FueraDeLaBolsa } from '../../models/narradorVirtual/preparacion';
import type { Azar, BolsasRecientes, ModelosNarrador, Narrador, Temporizador, Voz } from '../../models/narradorVirtual/puertos';
import { ConRespaldo } from '../../models/narradorVirtual/estrategias/ConRespaldo';
import { Jarvis } from '../../models/narradorVirtual/estrategias/Jarvis';

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
  /** Un jugador le pide algo en su turno del día (ya comprobado que puede). Devuelve el error, si lo hay. */
  pedir(jugador: string, accion: AccionJugador, datos: unknown): Promise<string | null>;
  /**
   * Un jugador hace una declaración del día (ver models/personajes; ya comprobado
   * que puede): lo que se le contesta, o el error.
   */
  declarar(jugador: string, declaracion: string, datos: unknown): Promise<{ error: string } | { valor?: string }>;
}

/** Lo que espera a que alguien ocupe el asiento de quien se ha ido en plena partida (ms); si no, el Violinista. */
export const ESPERA_ABANDONO_MS = 120_000;

/** Las etapas con la partida en marcha (en las que irse de un asiento la deja coja). */
const EN_PARTIDA = ['noche', 'privados', 'puestaEnComun', 'nominaciones'];

/**
 * El narrador virtual de la sala (servicio de aplicación): lo añade y lo quita, y
 * lleva la partida pasando por sus etapas (patrón Estado). Actúa como un narrador
 * más: todo lo que hace va por las acciones de la sala (`Narrador`), con sus
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
  /** Contando una declaración pública (con sus pausas): hasta que acaba, no se hace otra. */
  private contando = false;
  /** Revisando la sala ahora; `otraVez`: ha vuelto a cambiar mientras tanto. */
  private revisando = false;
  private otraVez = false;
  /** Los asientos que se han quedado libres en plena partida, con cómo dejar de esperar a que se ocupen. */
  private vacios = new Map<string, () => void>();

  constructor(
    private readonly juego: SalaDeJuego,
    /** La plaza del narrador virtual con ese participante. */
    private readonly plazaDe: (participanteId: string) => Narrador,
    private readonly voz: Voz,
    private readonly temporizador: Temporizador,
    /** Manda la sala a todos (lo que cambia el propio narrador virtual sin pasar por una acción: su etapa). */
    private readonly difundir: () => void,
    private readonly azar: Azar,
    /** Para Jarvis (sin esto, no se puede añadir). */
    private readonly modelos: ModelosNarrador | null = null,
    /** Las bolsas de las últimas partidas de quien lo añade (sin esto, no se tienen en cuenta). */
    private readonly bolsas: BolsasRecientes | null = null,
  ) {}

  async anadir(creador: string, { narrador, guion, jugadores }: OpcionesNarradorVirtual): Promise<string | null> {
    const { sala, partida } = this.juego;
    const datos = NARRADORES_VIRTUALES.find((n) => n.id === narrador);
    if (!datos?.disponible) return 'Ese narrador virtual aún no está disponible.';
    const libre = () => {
      if (sala.participantes.hayNarrador()) return 'La sala ya tiene narrador.';
      const sentados = partida.plaza().filter((a) => a.participanteId).length;
      return sentados > jugadores ? `Ya hay ${sentados} jugadores sentados: elige al menos ${sentados}.` : null;
    };
    const ocupada = libre();
    if (ocupada) return ocupada;
    const estrategia = narrador === 'jarvis' ? await this.estrategiaJarvis(creador) : new TontoYTu(this.azar);
    if (typeof estrategia === 'string') return estrategia;
    // Mientras se comprobaba el modelo, puede haber cambiado la sala
    const ocupadaYa = libre();
    if (ocupadaYa) return ocupadaYa;

    const participante = this.juego.narrador.anadir({ id: narrador, creador, guion, jugadores }, datos.nombre, datos.avatar);
    this.estrategia = estrategia;
    // Si no se pueden leer o apuntar las recientes, la partida sigue igual
    const recientes = (await this.bolsas?.de(creador).catch(() => null)) ?? [];
    const preparada = await prepararPartida(this.juego, this.plazaDe(participante), (d) => this.contextoDecisiones().decidir(d), {
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
    if (!this.modelos) return 'Jarvis no está disponible en este servidor.';
    const modelo = await this.modelos.modeloDe(creador);
    if (typeof modelo === 'string') return modelo;
    const respaldo = new TontoYTu(this.azar);
    return new ConRespaldo(new Jarvis(modelo), respaldo, this.temporizador, () => this.jarvisSeVa(respaldo));
  }

  /** Jarvis no consigue hablar con su modelo: lo dice y sigue la partida «Tonto y tú». */
  private jarvisSeVa(tonto: EstrategiaNarrador): void {
    const { narrador } = this.juego;
    if (!narrador.actual()) return;
    this.estrategia = tonto;
    const tontoYTu = NARRADORES_VIRTUALES.find((n) => n.id === 'tontoYTu')!;
    narrador.relevar('tontoYTu', tontoYTu.nombre, tontoYTu.avatar);
    this.contexto().decir(FRASES.jarvisSeVa());
    this.difundir();
  }

  quitar(): void {
    const { narrador } = this.juego;
    for (const cancelar of this.vacios.values()) cancelar();
    this.vacios.clear();
    this.etapa?.alSalir?.();
    this.etapa = null;
    this.estrategia = null;
    this.fuera = [];
    narrador.quitar();
  }

  async pedir(jugador: string, accion: AccionJugador, datos: unknown): Promise<string | null> {
    if (!this.etapa || !this.juego.narrador.actual()) return 'La sala no tiene narrador virtual.';
    return this.etapa.alPedir ? this.etapa.alPedir(this.contexto(), jugador, accion, datos) : 'Ahora no es el momento.';
  }

  async declarar(jugador: string, id: string, datos: unknown): Promise<{ error: string } | { valor?: string }> {
    const { narrador } = this.juego;
    const declaracion = DECLARACIONES_DIA.find((d) => d.id === id);
    if (!declaracion) return { error: 'Esa declaración no existe.' };
    if (!this.etapa || !narrador.actual()) return { error: 'La sala no tiene narrador virtual.' };
    if (declaracion.publica && this.contando) return { error: 'Espera a que el narrador termine de contar lo anterior.' };
    const r = await declaracion.declarar(this.contexto(), jugador, datos);
    if ('error' in r) return r;
    if (r.contar) {
      // Se cuenta con pausas (sin hacer esperar a quien lo pide); si se acaba la partida, se revela
      this.contando = true;
      void r
        .contar()
        .then(async (ganador) => {
          if (ganador && narrador.actual()) await this.pasarA(new Revelando(ganador));
        })
        .finally(() => (this.contando = false));
    }
    return r.valor === undefined ? {} : { valor: r.valor };
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
    const { narrador } = this.juego;
    if (!narrador.actual()) return;
    if (this.revisando) {
      this.otraVez = true;
      return;
    }
    this.temporizador.programar(0, () => void this.revisar());
  }

  private async revisar(): Promise<void> {
    const { sala, narrador } = this.juego;
    if (this.revisando) return;
    this.revisando = true;
    try {
      do {
        this.otraVez = false;
        if (!narrador.actual()) return;
        // Sin nadie en la sala (solo él), se va
        if (!sala.participantes.participantes().some((p) => p.persona.tipo !== 'virtual')) {
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
    const { sala, partida } = this.juego;
    const narrador = this.juego.narrador.actual();
    if (!narrador) return;
    for (const p of sala.participantes.participantes()) {
      if (p.rol === 'visitante' && partida.acceso.de(p.id) === 'solicitado') {
        await this.plazaDe(narrador.participante).accion('narrador:accesoGrimorio', { participanteId: p.id, conceder: true });
      }
    }
  }

  /**
   * En plena partida, un asiento que se queda libre (su jugador se ha ido): se
   * espera un rato a que alguien lo ocupe; si no, se acaba con el Violinista o, si
   * quien se fue era el demonio, gana el bando bueno.
   */
  private vigilarAsientos(): void {
    const { partida } = this.juego;
    const enPartida = !!this.etapa && EN_PARTIDA.includes(this.etapa.id);
    const jugadores = partida.plaza();
    for (const [id, cancelar] of this.vacios) {
      if (!enPartida || jugadores.find((a) => a.id === id)?.participanteId !== null) {
        cancelar();
        this.vacios.delete(id);
      }
    }
    if (!enPartida) return;
    for (const a of jugadores) {
      if (a.participanteId || this.vacios.has(a.id)) continue;
      this.vacios.set(
        a.id,
        this.temporizador.programar(ESPERA_ABANDONO_MS, () => {
          this.vacios.delete(a.id);
          void this.abandonado(a.id);
        }),
      );
    }
  }

  private async abandonado(jugadorId: string): Promise<void> {
    const { partida } = this.juego;
    const jugador = partida.plaza().find((a) => a.id === jugadorId);
    if (!jugador || jugador.participanteId || !this.etapa || !EN_PARTIDA.includes(this.etapa.id)) return;
    if (esDemonio(this.juego, jugador) && !jugador.muerto) {
      await this.pasarA(new Revelando('bueno'));
      return;
    }
    await this.pasarA(new Violinista());
  }

  private contexto(): ContextoEtapa {
    const narrador = this.juego.narrador.actual();
    if (!narrador || !this.estrategia) throw new Error('No hay narrador virtual.');
    return {
      juego: this.juego,
      plaza: this.plazaDe(narrador.participante),
      ...this.contextoDecisiones(),
      azar: this.azar,
      temporizador: this.temporizador,
      decir: (texto) => {
        this.juego.narrador.actualizar({ frase: texto });
        this.voz.decir(texto);
      },
      pasarA: (etapa) => this.pasarA(etapa),
      fueraDeLaBolsa: () => this.fueraDeLaBolsa(),
      recuerdos: this.recuerdos,
    };
  }

  /** Las decisiones con la estrategia de ahora (si se cambia a media partida, la nueva). */
  private contextoDecisiones() {
    return decisionesDe(this.juego, () => this.estrategia ?? new TontoYTu(this.azar));
  }

  private async pasarA(etapa: Etapa): Promise<void> {
    const { narrador } = this.juego;
    this.etapa?.alSalir?.();
    this.etapa = etapa;
    narrador.actualizar({ etapa: etapa.id });
    this.difundir();
    await etapa.alEntrar?.(this.contexto());
    // Por si ya le toca algo (la plaza ya estaba llena)
    this.alCambiarSala();
  }
}
