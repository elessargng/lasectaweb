import type { SalaHabilidadNoche } from '../../../contrato/sala';
import { habilidadesDelGuion } from '../../partida/habilidades';
import { FRASES } from '../frases';
import { nombreDeAsiento, sinEntender, todosHanEntendido, tipoReal, vivo } from '../mesaDeJuego';
import { planificarNoche } from '../noche/planificarNoche';
import { cumplirRequisitos, ponerFaroles, ponerRecordatorio } from '../noche/requisitos';
import { resolverRevision } from '../noche/revisiones';
import { Privados } from './Dia';
import { comprobarFinal } from '../final/comprobarFinal';
import { Revelando } from './Revelando';
import type { ContextoEtapa, Etapa } from './Etapa';

/** La etapa se ha dejado (el narrador se ha ido, o ha cambiado de etapa): se deja de esperar. */
class Cancelada extends Error {}

/** Lo que espera a que todos digan «Entendido» antes de avisar (con el gong y un mensaje) a quien falte. */
const ESPERA_ENTENDIDO_MS = 60_000;

/** Lo que el narrador le escribe a quien no ha dicho «Entendido». */
export const RECORDAR_ENTENDIDO = 'Envía «Entendido» para saber que has visto el wake de noche.';

/** Las vueltas que da una fila como mucho (falta → listo → esperando → revisar → hecho), por si algo no avanza. */
const VUELTAS_MAX = 12;

/**
 * La noche del narrador virtual. Va por tramos (ver planificarNoche): en cada uno,
 * espera un rato al azar por cada paso de la hoja de noche (esté o no en juego) y
 * despierta a la vez a los del tramo; pasa al siguiente cuando todos están hechos.
 * De cada fila cumple lo que falta, la despierta, espera a que elija (o elige él por
 * un asiento libre) y revisa lo que haya que revisar. Al acabar, cuando todos los
 * despertados han contestado «Entendido», amanece; cada minuto que alguno no lo
 * haya hecho, suena el gong y se le escribe para que lo haga.
 */
export class Noche implements Etapa {
  readonly id = 'noche' as const;
  private cancelada = false;
  private readonly cancelar: (() => void)[] = [];
  private esperas: { cumple: () => boolean; seguir: () => void }[] = [];

  async alEntrar(ctx: ContextoEtapa): Promise<void> {
    // Sin esperar: la noche dura lo que tarden en elegir
    void this.correr(ctx).catch((e) => {
      if (!(e instanceof Cancelada)) console.error('[NARRADOR VIRTUAL] La noche se ha parado:', e);
    });
  }

  async alCambiar(): Promise<void> {
    const listas = this.esperas.filter((e) => e.cumple());
    this.esperas = this.esperas.filter((e) => !listas.includes(e));
    for (const e of listas) e.seguir();
  }

  alSalir(): void {
    this.cancelada = true;
    for (const c of this.cancelar.splice(0)) c();
    this.esperas = [];
  }

  private seguirSiNoCancelada(): void {
    if (this.cancelada) throw new Cancelada();
  }

  private async dormir(ctx: ContextoEtapa, ms: number): Promise<void> {
    await new Promise<void>((seguir) => this.cancelar.push(ctx.temporizador.programar(ms, seguir)));
    this.seguirSiNoCancelada();
  }

  /** Espera a que la sala cumpla algo (se mira cada vez que cambia). */
  private async hasta(cumple: () => boolean): Promise<void> {
    if (!cumple()) await new Promise<void>((seguir) => this.esperas.push({ cumple, seguir }));
    this.seguirSiNoCancelada();
  }

  /** Como `hasta`, pero como mucho `ms`: devuelve si se ha cumplido (false: se ha acabado el tiempo). */
  private async hastaComoMucho(ctx: ContextoEtapa, cumple: () => boolean, ms: number): Promise<boolean> {
    if (cumple()) return true;
    const cumplido = await new Promise<boolean>((seguir) => {
      const espera = { cumple, seguir: () => seguir(true) };
      this.esperas.push(espera);
      this.cancelar.push(
        ctx.temporizador.programar(ms, () => {
          this.esperas = this.esperas.filter((e) => e !== espera);
          seguir(false);
        }),
      );
    });
    this.seguirSiNoCancelada();
    return cumplido;
  }

  /** No amanece hasta que todos los despertados lo han entendido; cada minuto sin hacerlo, el gong y un mensaje. */
  private async esperarEntendidos(ctx: ContextoEtapa): Promise<void> {
    const { sala } = ctx;
    while (!(await this.hastaComoMucho(ctx, () => todosHanEntendido(sala), ESPERA_ENTENDIDO_MS))) {
      await ctx.mesa.accion('narrador:sonarGong');
      for (const asientoId of sinEntender(sala)) {
        await ctx.mesa.accion('despertar:enviar', { asientoId, ficha: 'personalizado', texto: RECORDAR_ENTENDIDO });
      }
    }
  }

  private async correr(ctx: ContextoEtapa): Promise<void> {
    const { sala } = ctx;
    const guion = sala.guion();
    const primera = sala.fase().numero === 1;
    const habilidades = habilidadesDelGuion(guion?.edicion ?? null);
    if (primera) await this.ponerBorracho(ctx);
    const plan = planificarNoche({
      orden: (primera ? guion?.primeraNoche : guion?.otrasNoches) ?? [],
      primera,
      habilidades,
      tipoDe: (id) => sala.personaje(id)?.tipo,
    });
    for (const { personajes } of plan) {
      for (let paso = 0; paso < personajes.length; paso++) await this.dormir(ctx, ctx.estrategia.esperaPaso());
      if (personajes.includes('demonios')) await ponerFaroles(ctx);
      await Promise.all(personajes.map((p) => this.resolverFila(ctx, p)));
      // El Imp que se ha elegido a sí mismo: el nuevo, uno de los esbirros vivos
      if (sala.nuevoImp()) await this.elegirNuevoImp(ctx);
      this.seguirSiNoCancelada();
    }
    await this.esperarEntendidos(ctx);
    await this.amanecer(ctx);
  }

  /** La primera noche, si salió el Borracho: «Is The Drunk» a un aldeano al azar. */
  private async ponerBorracho(ctx: ContextoEtapa): Promise<void> {
    if (!ctx.fueraDeLaBolsa().includes('drunk')) return;
    const aldeanos = ctx.sala.asientos().filter((a) => a.personaje && ctx.sala.personaje(a.personaje)?.tipo === 'townsfolk');
    if (aldeanos.length) await ponerRecordatorio(ctx, ctx.estrategia.elegirUno(aldeanos).id, 'drunk', 'Is The Drunk');
  }

  private fila(ctx: ContextoEtapa, personaje: string): SalaHabilidadNoche | undefined {
    return ctx.sala.habilidadesNoche().find((h) => h.personaje === personaje);
  }

  /** Lleva una fila del orden de noche hasta hecha (o hasta ver que no le toca despertar). */
  private async resolverFila(ctx: ContextoEtapa, personaje: string): Promise<void> {
    for (let vuelta = 0; vuelta < VUELTAS_MAX; vuelta++) {
      this.seguirSiNoCancelada();
      const fila = this.fila(ctx, personaje);
      if (!fila || fila.estado === 'hecho') return;
      if (fila.estado === 'falta') {
        if (!(await cumplirRequisitos(ctx, fila))) return;
      } else if (fila.estado === 'listo') {
        if (!(await ctx.mesa.accion('narrador:despertarHabilidad', { personajeId: personaje })).ok) return;
      } else if (fila.estado === 'esperando') {
        await this.esperarEleccion(ctx, fila);
      } else if (fila.estado === 'revisar') {
        // Droison y sin sus recordatorios (la Lavandera): se ponen antes, así hay una de verdad de la que partir
        if (fila.avisos.some((a) => a.tipo === 'faltaRecordatorio') && (await cumplirRequisitos(ctx, fila))) continue;
        if (!(await resolverRevision(ctx, fila))) return;
      } else return;
    }
  }

  /** Espera a que elija; por un asiento libre, elige él (cuenta como un jugador). */
  private async esperarEleccion(ctx: ContextoEtapa, fila: SalaHabilidadNoche): Promise<void> {
    const eleccion = habilidadesDelGuion(ctx.sala.guion()?.edicion ?? null).get(fila.personaje)?.eleccion;
    const asiento = ctx.sala.asientos().find((a) => a.id === fila.asiento);
    if (eleccion && asiento && !asiento.ocupante) {
      const posibles = ctx.sala.asientos().filter((a) => eleccion.puedeElegirse || a.id !== asiento.id);
      const jugadores = ctx.estrategia.barajar(posibles).slice(0, eleccion.cantidad).map((a) => a.id);
      await ctx.mesa.accion('despertar:enviar', { asientoId: asiento.id, ficha: 'jugador', jugadores });
    }
    await this.hasta(() => this.fila(ctx, fila.personaje)?.estado !== 'esperando');
  }

  private async elegirNuevoImp(ctx: ContextoEtapa): Promise<void> {
    const esbirros = ctx.sala.asientos().filter((a) => vivo(a) && tipoReal(ctx.sala, a) === 'minion');
    if (esbirros.length) await ctx.mesa.accion('narrador:nuevoImp', { asientoId: ctx.estrategia.elegirUno(esbirros).id });
  }

  /** Amanece: se anuncian las muertes de la noche y empiezan los privados. */
  private async amanecer(ctx: ContextoEtapa): Promise<void> {
    const { sala } = ctx;
    const muertos = sala.asientos().filter((a) => a.muertePendiente);
    const nombres = muertos.map((a) => nombreDeAsiento(sala, a.id));
    if (!(await ctx.mesa.accion('narrador:amanecer')).ok) return;
    for (const a of muertos) await ctx.mesa.accion('narrador:confirmarMuerte', { asientoId: a.id });
    const jugadores = sala.narradorVirtual()?.jugadores ?? sala.asientos().length;
    const buenosDias = sala.fase().numero === 1 ? FRASES.primerDia(Math.ceil(jugadores / 2)) : FRASES.buenosDias(nombres);
    // Si con las muertes de la noche se acaba la partida, se revela
    const ganador = await comprobarFinal(ctx);
    if (ganador) {
      ctx.decir(`${FRASES.buenosDias(nombres)} ${FRASES.revelamos()}`);
      await ctx.pasarA(new Revelando(ganador, true));
      return;
    }
    ctx.decir(buenosDias);
    await ctx.pasarA(new Privados());
  }
}
