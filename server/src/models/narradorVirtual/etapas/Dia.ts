import { duracionFrase, FRASES, PAUSA_MS } from '../frases';
import type { SalaDeJuego } from '../../SalaDeJuego';
import { nombreDeAsiento, vivo } from '../plazaDeJuego';
import { jugadoresSentados, muertosSentados, noPuedeNominar, nominadoHoy } from '../dia/reglasDia';
import type { AccionJugador, ContextoEtapa, Etapa } from './Etapa';
import { Noche } from './Noche';
import { Revelando } from './Revelando';
import { comprobarFinal, type Ganador } from '../final/comprobarFinal';
import { apuntarMuerteDeDia } from '../final/cronica';
import { abrirPatosos, cerrarPatosos } from '../../personajes/patoso';

/** Lo que dura la puesta en común (ms). */
const PUESTA_EN_COMUN_MS = 60_000;
/** Lo que pasa entre el gong y el fin de los privados (ms): para despedirse. */
export const TRAS_GONG_MS = 3_000;
/** Lo que se espera al amanecer antes de los privados (ms): a que acabe su animación en la plaza (CiudadPlaza, unos 7 s). */
export const ESPERA_AMANECER_MS = 7_500;
/** Lo que dan los privados por cada jugador vivo (ms). */
const PRIVADOS_POR_VIVO_MS = 30_000;

/** Lo que duran los privados (ms): medio minuto por cada jugador vivo. */
export const duracionPrivados = ({ partida }: SalaDeJuego): number => partida.plaza().filter(vivo).length * PRIVADOS_POR_VIVO_MS;

/**
 * Una etapa que dura un rato con el reloj de la plaza y luego pasa a la siguiente
 * (o antes, si quien lo añadió termina el reloj). Puede esperar antes de empezar.
 */
abstract class EtapaConReloj implements Etapa {
  abstract readonly id: 'privados' | 'puestaEnComun';
  /** Lo programado: la espera antes de empezar o el fin del reloj. */
  private cancelar: (() => void) | null = null;
  /** El reloj está puesto (y aún no ha acabado). */
  private conReloj = false;

  protected abstract duracion(ctx: ContextoEtapa): number;
  protected abstract mensaje: string;
  protected abstract preparar(ctx: ContextoEtapa): Promise<void>;
  protected abstract siguiente(): Etapa;
  /** Lo que se espera antes de empezar (ms). */
  protected espera(): number {
    return 0;
  }

  async alEntrar(ctx: ContextoEtapa): Promise<void> {
    const espera = this.espera();
    if (espera > 0) this.cancelar = ctx.temporizador.programar(espera, () => void this.empezar(ctx));
    else await this.empezar(ctx);
  }

  private async empezar(ctx: ContextoEtapa): Promise<void> {
    await this.preparar(ctx);
    const ms = this.duracion(ctx);
    await ctx.plaza.ponerReloj(Math.round(ms / 1000), this.mensaje);
    this.conReloj = true;
    this.cancelar = ctx.temporizador.programar(ms, () => void this.acabar(ctx));
  }

  private async acabar(ctx: ContextoEtapa): Promise<void> {
    this.conReloj = false;
    await ctx.pasarA(this.siguiente());
  }

  async terminarReloj(ctx: ContextoEtapa): Promise<string | null> {
    if (!this.conReloj) return 'Ahora no hay ningún reloj que terminar.';
    this.cancelar?.();
    this.cancelar = null;
    const r = await ctx.plaza.terminarReloj();
    if (!r.ok) return r.error;
    await this.acabar(ctx);
    return null;
  }

  alSalir(): void {
    this.cancelar?.();
    this.cancelar = null;
    this.conReloj = false;
  }
}

/** Los privados: medio minuto por cada jugador vivo para conversar en privado. */
export class Privados extends EtapaConReloj {
  readonly id = 'privados' as const;
  protected mensaje = 'Privados';

  protected duracion(ctx: ContextoEtapa): number {
    return duracionPrivados(ctx.juego);
  }

  // Vienen del amanecer: que acabe de verse antes de que empiece el reloj
  protected espera(): number {
    return ESPERA_AMANECER_MS;
  }

  protected async preparar(ctx: ContextoEtapa): Promise<void> {
    // Un día nuevo: solo están listos los muertos (no nominan) y la palabra es de todos
    const { narrador } = ctx.juego;
    narrador.actualizar({ listos: muertosSentados(ctx.juego), turno: null });
    await ctx.plaza.darPalabra(null);
    await ctx.plaza.privados(true);
  }

  protected siguiente(): Etapa {
    return new PuestaEnComun();
  }
}

/**
 * La puesta en común: suena el gong y, un momento después (para despedirse), se
 * terminan los privados; todos hablan en la plaza un minuto.
 */
export class PuestaEnComun extends EtapaConReloj {
  readonly id = 'puestaEnComun' as const;
  protected mensaje = 'Puesta en común';
  private cancelarCierre: (() => void) | null = null;

  protected duracion(): number {
    return PUESTA_EN_COMUN_MS;
  }

  protected async preparar(ctx: ContextoEtapa): Promise<void> {
    await ctx.plaza.sonarGong();
    this.cancelarCierre = ctx.temporizador.programar(TRAS_GONG_MS, () => {
      this.cancelarCierre = null;
      void ctx.plaza.privados(false);
    });
  }

  // Si se pasa antes a las nominaciones, ya cierran ellas los privados
  alSalir(): void {
    super.alSalir();
    this.cancelarCierre?.();
    this.cancelarCierre = null;
  }

  protected siguiente(): Etapa {
    return new Nominaciones();
  }
}

/**
 * Las nominaciones: cada jugador vivo nomina a quien quiera (una vez al día; a cada
 * uno se le nomina una vez). Al nominar, solo habla quien nomina, que pasa la palabra
 * con «Defensa»; luego solo el nominado, que pasa a la votación con «Voto». Al acabar
 * la votación se marca (si llega a los votos y supera la marca) o se desmarca (si
 * empata). Cuando todos están listos («Listo»; quien ha nominado y los muertos ya lo están), se
 * ejecuta al marcado (si lo hay) y se va a la noche.
 */
export class Nominaciones implements Etapa {
  readonly id = 'nominaciones' as const;
  /** Los votos de la marca al empezar la votación en curso (para saber si empata), o null sin marca. */
  private marcaAlVotar: number | null = null;
  /** Ya se acaba el día (está diciendo cómo): no se atiende nada más. */
  private terminando = false;
  private cancelarEspera: (() => void) | null = null;

  alSalir(): void {
    this.cancelarEspera?.();
    this.cancelarEspera = null;
  }

  async alEntrar(ctx: ContextoEtapa): Promise<void> {
    await ctx.plaza.privados(false);
  }

  async alPedir(ctx: ContextoEtapa, jugador: string, accion: AccionJugador, datos: unknown): Promise<string | null> {
    const { juego } = ctx;
    const { sala, partida } = juego;
    if (this.terminando) return 'El día ya ha terminado.';
    const narrador = juego.narrador.actual();
    const yo = sala.participantes.buscar(jugador);
    const miJugador = partida.jugadorDe(jugador);
    if (!narrador || !yo || !miJugador) return 'No estás sentado.';
    const nominacion = partida.nominaciones.nominacion();

    if (accion === 'nominar') {
      const error = noPuedeNominar(juego, yo);
      if (error) return error;
      const hasta = (datos as { jugadorId?: unknown } | null)?.jugadorId;
      if (typeof hasta !== 'string' || !sala.jugador(hasta)) return 'Ese asiento ya no existe.';
      if (nominadoHoy(juego, hasta)) return `${nombreDeAsiento(juego, hasta)} ya ha sido nominado hoy.`;
      return this.nominar(ctx, miJugador.id, hasta, jugador);
    }
    if (accion === 'defensa') {
      if (narrador.turno !== 'acusacion' || nominacion?.desde !== miJugador.id) return 'Ahora no te toca.';
      const nominado = partida.plaza().find((a) => a.id === nominacion.hasta)?.participanteId ?? null;
      juego.narrador.actualizar({ turno: 'defensa' });
      await ctx.plaza.darPalabra(nominado);
      ctx.decir(FRASES.defensa(nombreDeAsiento(juego, nominacion.hasta)));
      return null;
    }
    if (accion === 'voto') {
      if (narrador.turno !== 'defensa' || nominacion?.hasta !== miJugador.id) return 'Ahora no te toca.';
      this.marcaAlVotar = partida.grimorio.calavera()?.votos ?? null;
      juego.narrador.actualizar({ turno: 'votacion' });
      await ctx.plaza.darPalabra(null);
      ctx.decir(FRASES.votosNecesarios(nominacion.votosNecesarios, nombreDeAsiento(juego, nominacion.hasta), this.marcaAlVotar !== null));
      const r = await ctx.plaza.cuentaAtras();
      return r.ok ? null : r.error;
    }
    if (accion === 'listo') {
      if (!narrador.listos.includes(jugador)) juego.narrador.actualizar({ listos: [...narrador.listos, jugador] });
      await this.quizaAnochece(ctx);
      return null;
    }
    // Seguir nominando: quien ha nominado hoy y los muertos están listos siempre
    if (miJugador.muerto) return 'Los muertos no nominan: estás listo.';
    if (partida.nominaciones.votaciones().some((v) => v.dia === partida.fases.actual().numero && v.nominaAsiento === miJugador.id)) return 'Ya has nominado hoy: estás listo.';
    juego.narrador.actualizar({ listos: narrador.listos.filter((id) => id !== jugador) });
    return null;
  }

  private async nominar(ctx: ContextoEtapa, desde: string, hasta: string, jugador: string): Promise<string | null> {
    const { juego } = ctx;
    let r = await ctx.plaza.nominar(desde, hasta);
    // Quien nomina puede registrar como aldeano (ver Percepcion): lo decide su estrategia
    if (r.ok && r.valor === 'comoAldeano') {
      const nominador = nombreDeAsiento(juego, desde);
      const comoAldeano = await ctx.siONo({
        motivo: 'registraComoAldeano',
        pregunta: `${nominador} nomina a la Virgen y puede registrar como aldeano: ¿registra como tal?`,
        si: `Registra como aldeano: ${nominador} es ejecutado.`,
        no: 'No registra como aldeano: no pasa nada.',
      });
      r = await ctx.plaza.nominar(desde, hasta, comoAldeano);
    }
    if (!r.ok) return r.error;
    const quien = nombreDeAsiento(juego, desde);
    // La Virgen: quien la nomina es ejecutado al momento (y se dice quién nominó a quién)
    if (r.valor === 'ejecutado' || r.valor === 'final') {
      await this.trasEjecutar(ctx, desde, FRASES.virgen(quien, nombreDeAsiento(juego, hasta)));
      return null;
    }
    const narrador = juego.narrador.actual()!;
    juego.narrador.actualizar({ turno: 'acusacion', listos: [...new Set([...narrador.listos, jugador])] });
    await ctx.plaza.darPalabra(jugador);
    ctx.decir(FRASES.nomina(quien, nombreDeAsiento(juego, hasta)));
    return null;
  }

  async alCambiar(ctx: ContextoEtapa): Promise<void> {
    const { juego } = ctx;
    const { partida } = juego;
    const narrador = juego.narrador.actual();
    if (this.terminando || !narrador || narrador.turno === null) return;
    const nominacion = partida.nominaciones.nominacion();
    if (!nominacion) {
      juego.narrador.actualizar({ turno: null });
      return;
    }
    if (narrador.turno !== 'votacion' || !nominacion.votacion?.terminada) return;
    const { votos } = nominacion.votacion;
    juego.narrador.actualizar({ turno: null });
    if (votos >= nominacion.votosNecesarios) {
      const r = await ctx.plaza.marcar(nominacion.hasta, true);
      if (r.ok) ctx.decir(FRASES.marcado(nombreDeAsiento(juego, nominacion.hasta)));
    } else if (this.marcaAlVotar !== null && votos === this.marcaAlVotar) {
      // Empata con la marca: nadie queda marcado
      await ctx.plaza.desmarcar();
    } else {
      await ctx.plaza.cerrarNominacion();
    }
    this.marcaAlVotar = null;
    await this.quizaAnochece(ctx);
  }

  /** Todos listos y sin nominación: se ejecuta al marcado (si lo hay) y a la noche. */
  private async quizaAnochece(ctx: ContextoEtapa): Promise<void> {
    const { juego } = ctx;
    const { partida } = juego;
    const narrador = juego.narrador.actual();
    if (this.terminando || !narrador || narrador.turno !== null || partida.nominaciones.nominacion()) return;
    const muertos = muertosSentados(juego);
    if (!jugadoresSentados(juego).every((id) => narrador.listos.includes(id) || muertos.includes(id))) return;
    const marcado = partida.plaza().find((a) => a.id === partida.grimorio.calavera()?.jugadorId);
    if (!marcado) {
      // Sin ejecución: con el Alcalde y tres vivos, se acaba
      await this.terminarDia(ctx, FRASES.nadieEjecutado(), await comprobarFinal(ctx, { sinEjecucion: true }));
      return;
    }
    const quien = nombreDeAsiento(juego, marcado.id);
    if ((await ctx.plaza.ejecutar(marcado.id)).ok) await this.trasEjecutar(ctx, marcado.id, FRASES.ejecutado(quien));
  }

  /**
   * Tras una ejecución (`frase`: cómo se cuenta): si se acaba la partida (también por
   * el Santo), se revela; si no, a la noche. El ejecutado puede declararse Patoso hasta el amanecer.
   */
  private async trasEjecutar(ctx: ContextoEtapa, ejecutado: string, frase: string): Promise<void> {
    apuntarMuerteDeDia(ctx.recuerdos.cronica, ctx.juego, ejecutado, 'ejecucion');
    abrirPatosos(ctx.juego, [ejecutado], 'amanecer');
    await this.terminarDia(ctx, frase, await comprobarFinal(ctx, { ejecutado }));
  }

  /**
   * Se acaba el día, dicho en dos partes con una pausa («Pepe es ejecutada y muere…»,
   * «Y nos vamos a la noche» o «Y revelamos el grimorio»). Hasta que no acaba de
   * decirlo no se va a la noche ni se revela; mientras, no se atiende a nadie. Los
   * muertos de anoche ya no pueden declararse Patoso (si el de verdad no ha elegido,
   * elige ahora y eso puede acabar la partida).
   */
  private async terminarDia(ctx: ContextoEtapa, frase: string, ganador: Ganador | null): Promise<void> {
    const { partida } = ctx.juego;
    this.terminando = true;
    ctx.decir(frase);
    await this.esperar(ctx, duracionFrase(frase) + PAUSA_MS);
    const porElPatoso = ganador ? null : await cerrarPatosos(ctx, 'anochecer');
    if (porElPatoso) {
      await ctx.pasarA(new Revelando(porElPatoso));
      return;
    }
    const despues = FRASES.trasEjecucion(!!ganador);
    ctx.decir(despues);
    await this.esperar(ctx, duracionFrase(despues));
    if (ganador) {
      await ctx.pasarA(new Revelando(ganador, true));
      return;
    }
    if (partida.fases.actual().momento !== 'noche') await ctx.plaza.irANoche();
    await ctx.pasarA(new Noche());
  }

  /** Espera con el reloj de la plaza (si se sale de la etapa antes, no sigue). */
  private esperar(ctx: ContextoEtapa, ms: number): Promise<void> {
    return new Promise((seguir) => {
      this.cancelarEspera = ctx.temporizador.programar(ms, () => {
        this.cancelarEspera = null;
        seguir();
      });
    });
  }
}
