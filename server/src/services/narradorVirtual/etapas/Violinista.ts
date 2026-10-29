import { esDemonio, type Ganador } from '../final/comprobarFinal';
import { FRASES } from '../frases';
import { opcionesDeAsientos } from '../grimorio';
import type { ContextoEtapa, Etapa } from './Etapa';
import { Revelando } from './Revelando';

/** Lo que tiene el demonio para elegir en secreto (ms); si no, elige su estrategia. */
const ELIGE_EL_DEMONIO_MS = 60_000;
/** Lo que dura el señalamiento de todos (s). */
const SENALAMIENTO_SEGUNDOS = 30;

/** Lo que el narrador le escribe al demonio. */
export const PIDE_AL_DEMONIO = 'Sale el Violinista: elige en secreto a un jugador bueno contestando con «Jugador».';

/**
 * El Violinista (un jugador se ha ido y nadie ha ocupado su asiento): el demonio
 * elige en secreto a un jugador bueno (en un despertar; si no contesta a tiempo o
 * no está, lo elige la estrategia), luego todos señalan a uno de los dos y gana el
 * bando del más señalado (si empatan, lo decide la estrategia). Se revela el grimorio.
 */
export class Violinista implements Etapa {
  readonly id = 'violinista' as const;
  private readonly cancelar: (() => void)[] = [];
  private seguir = true;

  async alEntrar(ctx: ContextoEtapa): Promise<void> {
    ctx.decir(FRASES.violinista());
    void this.correr(ctx);
  }

  alSalir(): void {
    this.seguir = false;
    for (const c of this.cancelar.splice(0)) c();
  }

  private esperar(ctx: ContextoEtapa, ms: number): Promise<void> {
    return new Promise((listo) => this.cancelar.push(ctx.temporizador.programar(ms, listo)));
  }

  private async correr(ctx: ContextoEtapa): Promise<void> {
    const { sala } = ctx;
    const demonio = sala.asientos().find((a) => !a.muerto && esDemonio(sala, a)) ?? sala.asientos().find((a) => esDemonio(sala, a));
    const buenos = sala.asientos().filter((a) => !esDemonio(sala, a) && sala.alineamientoEfectivo(a) !== 'malvado');
    if (!demonio || !buenos.length) return void ctx.pasarA(new Revelando(demonio ? 'malvado' : 'bueno'));

    const bueno =
      (await this.eligeElDemonio(ctx, demonio.id, buenos.map((a) => a.id))) ??
      (
        await ctx.decidir({
          motivo: 'violinistaBueno',
          pregunta: 'El Violinista: el jugador bueno que se enfrenta al demonio (el demonio no ha elegido).',
          opciones: opcionesDeAsientos(ctx.sala, buenos),
        })
      ).id;
    if (!this.seguir) return;
    await ctx.mesa.accion('narrador:senalamiento', {
      mensaje: '¿Quién gana? Señala a uno de los dos',
      segundos: SENALAMIENTO_SEGUNDOS,
      objetivos: [demonio.id, bueno],
    });
    await this.esperar(ctx, SENALAMIENTO_SEGUNDOS * 1000 + 500);
    if (!this.seguir) return;
    const senales = Object.values(sala.senalamiento()?.senales ?? {});
    await ctx.mesa.accion('narrador:terminarSenalamiento');
    const alDemonio = senales.filter((s) => s === demonio.id).length;
    const alBueno = senales.filter((s) => s === bueno).length;
    const ganador: Ganador =
      alDemonio === alBueno ? (ctx.azar() < 0.5 ? 'bueno' : 'malvado') : alDemonio > alBueno ? 'malvado' : 'bueno';
    await ctx.pasarA(new Revelando(ganador));
  }

  /** El demonio elige en un despertar: el asiento de un bueno, o null si no está o no contesta a tiempo. */
  private async eligeElDemonio(ctx: ContextoEtapa, demonio: string, buenos: string[]): Promise<string | null> {
    const { sala } = ctx;
    if (!sala.asientos().find((a) => a.id === demonio)?.ocupante) return null;
    if (!(await ctx.mesa.accion('narrador:despertar', { asientoId: demonio })).ok) return null;
    await ctx.mesa.accion('despertar:enviar', { asientoId: demonio, ficha: 'personalizado', texto: PIDE_AL_DEMONIO });
    const limite = Date.now() + ELIGE_EL_DEMONIO_MS;
    for (let vuelta = 0; this.seguir && Date.now() < limite && vuelta < ELIGE_EL_DEMONIO_MS / 250; vuelta++) {
      const ultimo = sala.despertares().find((d) => d.asiento === demonio)?.mensajes.slice(-1)[0];
      if (ultimo && ultimo.autor !== 'narrador' && ultimo.ficha === 'jugador') {
        const elegido = ultimo.jugadores.find((j) => buenos.includes(j));
        if (elegido) {
          await ctx.mesa.accion('despertar:enviar', { asientoId: demonio, ficha: 'entendido' });
          return elegido;
        }
        await ctx.mesa.accion('despertar:enviar', { asientoId: demonio, ficha: 'personalizado', texto: 'Ese no es un jugador bueno: elige otro.' });
      }
      await this.esperar(ctx, 250);
    }
    return null;
  }
}
