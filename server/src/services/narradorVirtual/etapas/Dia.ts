import { FRASES } from '../frases';
import type { SalaService } from '../../SalaService';
import { nombreDeAsiento, vivo } from '../mesaDeJuego';
import { jugadoresSentados, noPuedeNominar, nominadoHoy } from '../dia/reglasDia';
import type { AccionJugador, ContextoEtapa, Etapa } from './Etapa';
import { Noche } from './Noche';
import { Revelando } from './Revelando';
import { comprobarFinal } from '../final/comprobarFinal';

/** Lo que dura la puesta en común (ms). */
const PUESTA_EN_COMUN_MS = 60_000;
/** Lo que dan los privados por cada jugador vivo (ms). */
const PRIVADOS_POR_VIVO_MS = 30_000;

/** Lo que duran los privados (ms): medio minuto por cada jugador vivo. */
export const duracionPrivados = (sala: SalaService): number => sala.asientos().filter(vivo).length * PRIVADOS_POR_VIVO_MS;

/** Una etapa que dura un rato con el reloj de la mesa y luego pasa a la siguiente. */
abstract class EtapaConReloj implements Etapa {
  abstract readonly id: 'privados' | 'puestaEnComun';
  private cancelar: (() => void) | null = null;

  protected abstract duracion(ctx: ContextoEtapa): number;
  protected abstract mensaje: string;
  protected abstract preparar(ctx: ContextoEtapa): Promise<void>;
  protected abstract siguiente(): Etapa;

  async alEntrar(ctx: ContextoEtapa): Promise<void> {
    await this.preparar(ctx);
    const ms = this.duracion(ctx);
    await ctx.mesa.accion('narrador:reloj', { segundos: Math.round(ms / 1000), mensaje: this.mensaje });
    this.cancelar = ctx.temporizador.programar(ms, () => void ctx.pasarA(this.siguiente()));
  }

  alSalir(): void {
    this.cancelar?.();
    this.cancelar = null;
  }
}

/** Los privados: medio minuto por cada jugador vivo para conversar en privado. */
export class Privados extends EtapaConReloj {
  readonly id = 'privados' as const;
  protected mensaje = 'Privados';

  protected duracion(ctx: ContextoEtapa): number {
    return duracionPrivados(ctx.sala);
  }

  protected async preparar(ctx: ContextoEtapa): Promise<void> {
    // Un día nuevo: nadie está listo aún y la palabra es de todos
    ctx.sala.actualizarNarradorVirtual({ listos: [], turno: null });
    await ctx.mesa.accion('narrador:darPalabra', { participanteId: null });
    await ctx.mesa.accion('narrador:privados', { abiertos: true });
  }

  protected siguiente(): Etapa {
    return new PuestaEnComun();
  }
}

/** La puesta en común: se terminan los privados, suena el gong y todos hablan en la plaza un minuto. */
export class PuestaEnComun extends EtapaConReloj {
  readonly id = 'puestaEnComun' as const;
  protected mensaje = 'Puesta en común';

  protected duracion(): number {
    return PUESTA_EN_COMUN_MS;
  }

  protected async preparar(ctx: ContextoEtapa): Promise<void> {
    await ctx.mesa.accion('narrador:privados', { abiertos: false });
    await ctx.mesa.accion('narrador:sonarGong');
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
 * empata). Cuando todos están listos («Listo»; quien ha nominado ya lo está), se
 * ejecuta al marcado (si lo hay) y se va a la noche.
 */
export class Nominaciones implements Etapa {
  readonly id = 'nominaciones' as const;
  /** Los votos de la marca al empezar la votación en curso (para saber si empata), o null sin marca. */
  private marcaAlVotar: number | null = null;

  async alEntrar(ctx: ContextoEtapa): Promise<void> {
    await ctx.mesa.accion('narrador:privados', { abiertos: false });
  }

  async alPedir(ctx: ContextoEtapa, jugador: string, accion: AccionJugador, datos: unknown): Promise<string | null> {
    const { sala } = ctx;
    const narrador = sala.narradorVirtual();
    const yo = sala.buscar(jugador);
    const miAsiento = sala.asientoDe(jugador);
    if (!narrador || !yo || !miAsiento) return 'No estás sentado.';
    const nominacion = sala.nominacion();

    if (accion === 'nominar') {
      const error = noPuedeNominar(sala, yo);
      if (error) return error;
      const hasta = (datos as { asientoId?: unknown } | null)?.asientoId;
      if (typeof hasta !== 'string' || !sala.hayAsiento(hasta)) return 'Ese asiento ya no existe.';
      if (nominadoHoy(sala, hasta)) return `${nombreDeAsiento(sala, hasta)} ya ha sido nominado hoy.`;
      return this.nominar(ctx, miAsiento.id, hasta, jugador);
    }
    if (accion === 'defensa') {
      if (narrador.turno !== 'acusacion' || nominacion?.desde !== miAsiento.id) return 'Ahora no te toca.';
      const nominado = sala.asientos().find((a) => a.id === nominacion.hasta)?.ocupante ?? null;
      sala.actualizarNarradorVirtual({ turno: 'defensa' });
      await ctx.mesa.accion('narrador:darPalabra', { participanteId: nominado });
      ctx.decir(FRASES.defensa(nombreDeAsiento(sala, nominacion.hasta)));
      return null;
    }
    if (accion === 'voto') {
      if (narrador.turno !== 'defensa' || nominacion?.hasta !== miAsiento.id) return 'Ahora no te toca.';
      this.marcaAlVotar = sala.asientos().find((a) => a.marcado)?.votosMarca ?? null;
      sala.actualizarNarradorVirtual({ turno: 'votacion' });
      await ctx.mesa.accion('narrador:darPalabra', { participanteId: null });
      ctx.decir(FRASES.votosNecesarios(nominacion.votosNecesarios, nombreDeAsiento(sala, nominacion.hasta), this.marcaAlVotar !== null));
      const r = await ctx.mesa.accion('narrador:cuentaAtras');
      return r.ok ? null : r.error;
    }
    if (accion === 'listo') {
      if (!narrador.listos.includes(jugador)) sala.actualizarNarradorVirtual({ listos: [...narrador.listos, jugador] });
      await this.quizaAnochece(ctx);
      return null;
    }
    // Seguir nominando: quien ha nominado hoy está listo siempre
    if (sala.votaciones().some((v) => v.dia === sala.fase().numero && v.nominaAsiento === miAsiento.id)) return 'Ya has nominado hoy: estás listo.';
    sala.actualizarNarradorVirtual({ listos: narrador.listos.filter((id) => id !== jugador) });
    return null;
  }

  private async nominar(ctx: ContextoEtapa, desde: string, hasta: string, jugador: string): Promise<string | null> {
    const { sala } = ctx;
    let r = await ctx.mesa.accion('narrador:nominar', { desde, hasta });
    // Un Espía nomina a la Virgen: si registra como aldeano, lo decide su estrategia
    if (r.ok && r.valor === 'comoAldeano') {
      r = await ctx.mesa.accion('narrador:nominar', { desde, hasta, comoAldeano: ctx.estrategia.elegirUno([true, false]) });
    }
    if (!r.ok) return r.error;
    const quien = nombreDeAsiento(sala, desde);
    // La Virgen: quien la nomina es ejecutado al momento
    if (r.valor === 'ejecutado' || r.valor === 'final') {
      await this.trasEjecutar(ctx, quien, desde);
      return null;
    }
    const narrador = sala.narradorVirtual()!;
    sala.actualizarNarradorVirtual({ turno: 'acusacion', listos: [...new Set([...narrador.listos, jugador])] });
    await ctx.mesa.accion('narrador:darPalabra', { participanteId: jugador });
    ctx.decir(FRASES.nomina(quien, nombreDeAsiento(sala, hasta)));
    return null;
  }

  async alCambiar(ctx: ContextoEtapa): Promise<void> {
    const { sala } = ctx;
    const narrador = sala.narradorVirtual();
    if (!narrador || narrador.turno === null) return;
    const nominacion = sala.nominacion();
    if (!nominacion) {
      sala.actualizarNarradorVirtual({ turno: null });
      return;
    }
    if (narrador.turno !== 'votacion' || !nominacion.votacion?.terminada) return;
    const { votos } = nominacion.votacion;
    sala.actualizarNarradorVirtual({ turno: null });
    if (votos >= nominacion.votosNecesarios) {
      const r = await ctx.mesa.accion('narrador:marcar', { asientoId: nominacion.hasta, marcado: true });
      if (r.ok) ctx.decir(FRASES.marcado(nombreDeAsiento(sala, nominacion.hasta)));
    } else if (this.marcaAlVotar !== null && votos === this.marcaAlVotar) {
      // Empata con la marca: nadie queda marcado
      await ctx.mesa.accion('narrador:desmarcar');
    } else {
      await ctx.mesa.accion('narrador:cerrarNominacion');
    }
    this.marcaAlVotar = null;
    await this.quizaAnochece(ctx);
  }

  /** Todos listos y sin nominación: se ejecuta al marcado (si lo hay) y a la noche. */
  private async quizaAnochece(ctx: ContextoEtapa): Promise<void> {
    const { sala } = ctx;
    const narrador = sala.narradorVirtual();
    if (!narrador || narrador.turno !== null || sala.nominacion()) return;
    if (!jugadoresSentados(sala).every((id) => narrador.listos.includes(id))) return;
    const marcado = sala.asientos().find((a) => a.marcado);
    if (!marcado) {
      // Sin ejecución: con el Alcalde y tres vivos, se acaba
      const ganador = await comprobarFinal(ctx, { sinEjecucion: true });
      if (ganador) {
        ctx.decir(FRASES.nadieEjecutadoYFinal());
        await ctx.pasarA(new Revelando(ganador, true));
        return;
      }
      ctx.decir(FRASES.nadieEjecutado());
      await ctx.mesa.accion('narrador:irANoche');
      await ctx.pasarA(new Noche());
      return;
    }
    const quien = nombreDeAsiento(sala, marcado.id);
    if ((await ctx.mesa.accion('narrador:ejecutar', { asientoId: marcado.id })).ok) await this.trasEjecutar(ctx, quien, marcado.id);
  }

  /** Tras una ejecución: si se acaba la partida (también por el Santo), se revela; si no, a la noche. */
  private async trasEjecutar(ctx: ContextoEtapa, quien: string, ejecutado: string): Promise<void> {
    const ganador = await comprobarFinal(ctx, { ejecutado });
    if (ganador) {
      ctx.decir(FRASES.ejecutadoYFinal(quien));
      await ctx.pasarA(new Revelando(ganador, true));
      return;
    }
    ctx.decir(FRASES.ejecutado(quien));
    if (ctx.sala.fase().momento !== 'noche') await ctx.mesa.accion('narrador:irANoche');
    await ctx.pasarA(new Noche());
  }
}
