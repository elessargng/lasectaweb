import type { AvisoHabilidad, EleccionDespertar, EnvioDespertar, EstadoHabilidad, FichaDespertar, OpcionDespertar } from '../compartido/despertar';
import { tarjeta, type ContextoNoche, type HabilidadNocturna, type Resultado } from './habilidades/HabilidadNocturna';
import type { Jugador } from './Jugador';

/**
 * Si lo que contesta el de un asiento no es lo que le pide su habilidad (cuántos
 * jugadores elige y si puede elegirse a sí mismo): el error, o null.
 */
export function errorDeEleccion(pide: EleccionDespertar, mensaje: { ficha: FichaDespertar | null; jugadores: string[] }, jugadorId: string): string | null {
  const cuantos = pide.cantidad === 1 ? 'un jugador' : `${pide.cantidad} jugadores`;
  if (mensaje.ficha !== 'jugador' || mensaje.jugadores.length !== pide.cantidad) return `Elige ${cuantos}.`;
  if (!pide.puedeElegirse && mensaje.jugadores.includes(jugadorId)) return 'No puedes elegirte a ti.';
  return null;
}

/**
 * Cómo está el despertar guiado de una fila del orden de noche: quién despierta,
 * qué le falta y lo que se propone mandarle.
 */
export interface HabilidadNoche {
  /** El personaje, o 'esbirros' / 'demonios'. */
  personaje: string;
  /** El jugador que despierta (el de la ficha); con 'esbirros' o 'demonios', el primero. */
  jugador: string;
  /** Todos los que despiertan: el de la ficha o, con 'esbirros' y 'demonios', cada uno. */
  jugadores: string[];
  estado: EstadoHabilidad;
  avisos: AvisoHabilidad[];
  /** Lo que se propone mandar (revisar: una o varias, la primera es la de verdad). */
  opciones: OpcionDespertar[];
}

/** Lo que el despertar guiado necesita de la sala. */
export interface EntornoDespertarGuiado {
  ctx: ContextoNoche;
  /** Las habilidades de noche del guion, por personaje. */
  habilidades: () => ReadonlyMap<string, HabilidadNocturna>;
  /** Es de noche. */
  noche: () => boolean;
  /** Abre el despertar de un asiento (ver Despertares.despertar). */
  despertar: (jugadorId: string) => string | null;
  /** Manda algo del narrador a un asiento (con `eleccion`, se le pide que elija). */
  mandar: (jugadorId: string, envio: EnvioDespertar, eleccion?: EleccionDespertar) => void;
  /** A lo último que se le ha mandado a un asiento aún le falta el «Entendido» (ver Despertares.porEntender). */
  porEntender: (jugadorId: string) => boolean;
  /** Pone un recordatorio de un personaje (por su texto) en un asiento; único en la plaza. */
  ponerRecordatorio: (jugadorId: string, personaje: string, texto: string) => void;
  /** Mata de noche (la muerte queda pendiente). */
  matarDeNoche: (jugadorId: string) => void;
  /** Envía el grimorio de la partida a quien se sienta en el asiento. */
  enviarGrimorio: (jugadorId: string) => void;
  cambiarPersonaje: (jugadorId: string, personaje: string) => void;
}

/** Lo que ya se ha hecho esta noche con una habilidad. */
/** Lo que se le manda a un asiento: un despertar. */
interface Envio {
  envio: EnvioDespertar;
  eleccion?: EleccionDespertar;
}

interface Turno {
  personaje: string;
  asiento: string;
  estado: 'esperando' | 'revisar' | 'hecho';
  avisos: AvisoHabilidad[];
  opciones: OpcionDespertar[];
}

/**
 * El despertar guiado: el narrador despierta a un personaje desde el orden de
 * noche y la sala hace lo que dice su habilidad (ver habilidades/). Si elige, se
 * le pide que elija solo lo que puede y, al contestar, se pone lo que toque y se
 * le responde; si recibe información, se le manda. Cuando algo no está claro
 * (droison, un Espía o una Reclusa, el Alcalde), lo revisa el narrador. Lo de cada
 * noche se olvida al anochecer otra vez. No comprueba permisos.
 *
 * Una cosa cada vez: a un jugador no se le manda un despertar mientras no haya
 * dicho «Entendido» al anterior (o el narrador no le haya contestado «Entendido» a
 * lo que eligió). Lo que llega mientras tanto espera en la cola de su asiento, en
 * orden, sea de la habilidad que sea. Un asiento libre no contesta: no espera.
 */
export class DespertarGuiado {
  private turnos: Turno[] = [];
  /** El asiento del Imp que se ha elegido a sí mismo, hasta que el narrador dice quién es el nuevo. */
  private impQueMuere: string | null = null;
  /** Lo que espera a que el jugador del asiento diga «Entendido» a lo anterior, por asiento. */
  private colas = new Map<string, Envio[]>();

  constructor(private readonly entorno: EntornoDespertarGuiado) {}

  /**
   * El asiento que despierta con un personaje: el de su ficha (el que cree serlo).
   * Antes uno vivo; si no, uno que muere esta noche; si no, cualquiera.
   */
  private asientoDe(personaje: string): Jugador | null {
    const con = this.entorno.ctx.plaza().filter((a) => a.personaje === personaje);
    return con.find((a) => !a.muerto && !a.muertePendiente) ?? con.find((a) => !a.muerto) ?? con[0] ?? null;
  }

  private turnoDe(personaje: string, asiento: string): Turno | undefined {
    return this.turnos.find((t) => t.personaje === personaje && t.asiento === asiento);
  }

  private guardar(turno: Turno): void {
    this.turnos = [...this.turnos.filter((t) => !(t.personaje === turno.personaje && t.asiento === turno.asiento)), turno];
  }

  /** Los que despiertan con una habilidad: el de su ficha o, los esbirros y el demonio, cada uno. */
  private asientosDe(habilidad: HabilidadNocturna): Jugador[] {
    if (habilidad.despiertan) return habilidad.despiertan(this.entorno.ctx);
    const jugador = this.asientoDe(habilidad.personaje);
    return jugador ? [jugador] : [];
  }

  /**
   * Lo que dice una habilidad de todos los que despiertan con ella: lo peor de
   * cada uno (falta, revisar, listo), con sus avisos sin repetir. Las opciones, las del primero.
   */
  private preparar(habilidad: HabilidadNocturna, jugadores: Jugador[]): Pick<Resultado, 'estado' | 'avisos' | 'opciones'> {
    const resultados = jugadores.map((a) => habilidad.preparar(this.entorno.ctx, a));
    const estado = (['falta', 'revisar'] as const).find((e) => resultados.some((r) => r.estado === e)) ?? 'listo';
    const avisos = [...new Map(resultados.flatMap((r) => r.avisos).map((a) => [JSON.stringify(a), a])).values()];
    return { estado, avisos, opciones: resultados[0]?.opciones ?? [] };
  }

  /** Cada fila del orden de noche con habilidad y ficha en la plaza: cómo está. Fuera de la noche, ninguna. */
  habilidadesNoche(): HabilidadNoche[] {
    if (!this.entorno.noche()) return [];
    return [...this.entorno.habilidades().values()].flatMap((h): HabilidadNoche[] => {
      const jugadores = this.asientosDe(h);
      if (!jugadores.length) return [];
      const fila = { personaje: h.personaje, jugador: jugadores[0].id, jugadores: jugadores.map((a) => a.id) };
      const turno = this.turnoDe(h.personaje, jugadores[0].id);
      if (turno) return [{ ...fila, estado: turno.estado, avisos: turno.avisos, opciones: turno.opciones }];
      return [{ ...fila, ...this.preparar(h, jugadores) }];
    });
  }

  /**
   * Despierta a un personaje según su habilidad (a los esbirros o al demonio, a
   * cada uno): si elige, se le pide que elija (otra vez, si aún no lo ha hecho); si
   * no, se le manda lo que sabe. Solo si está listo. Devuelve el error, si lo hay.
   */
  despertar(personaje: string): string | null {
    const habilidad = this.entorno.habilidades().get(personaje);
    if (!habilidad) return 'Ese personaje no se despierta solo.';
    const jugadores = this.asientosDe(habilidad);
    if (!jugadores.length) return 'Nadie lleva ese personaje.';
    const turno = this.turnoDe(personaje, jugadores[0].id);
    if (turno?.estado === 'hecho') return 'Ya se ha despertado esta noche.';
    if (turno?.estado === 'revisar') return 'Antes hay que revisar lo que se le manda.';
    const preparados = jugadores.map((a) => habilidad.preparar(this.entorno.ctx, a));
    if (preparados.some((p) => p.estado === 'falta')) return 'Falta algo en el grimorio.';
    if (preparados.some((p) => p.estado === 'revisar')) return 'Antes hay que revisar lo que se le manda.';
    for (const [i, jugador] of jugadores.entries()) {
      const error = this.entorno.despertar(jugador.id);
      if (error) return error;
      if (habilidad.eleccion) {
        this.entregar(jugador.id, { envio: tarjeta('eleccion'), eleccion: habilidad.eleccion });
        this.guardar({ personaje, asiento: jugador.id, estado: 'esperando', avisos: preparados[i].avisos, opciones: [] });
      } else this.aplicar(personaje, jugador, preparados[i]);
    }
    return null;
  }

  /**
   * Lo que pasa con lo que dice la habilidad: si está listo, se hace; si no, queda para
   * revisar. `respuesta`: contesta a lo que ha elegido (se le manda ya, sin cola).
   */
  private aplicar(personaje: string, jugador: Jugador, resultado: Resultado, respuesta = false): void {
    const { estado, avisos, opciones, efectos } = resultado;
    if (estado !== 'listo') {
      this.guardar({ personaje, asiento: jugador.id, estado: 'revisar', avisos, opciones });
      return;
    }
    for (const r of efectos.recordatorios) this.entorno.ponerRecordatorio(r.asiento, r.personaje ?? personaje, r.texto);
    if (efectos.muere) this.entorno.matarDeNoche(efectos.muere);
    if (efectos.grimorio) this.entorno.enviarGrimorio(jugador.id);
    if (efectos.nuevoImp) this.impQueMuere = jugador.id;
    const enviar = (envio: EnvioDespertar) => (respuesta ? this.entorno.mandar(jugador.id, envio) : this.entregar(jugador.id, { envio }));
    for (const envio of resultado.previos ?? []) enviar(envio);
    if (opciones[0]) enviar(opciones[0].envio);
    // Contestado con «Entendido», ya está: lo siguiente de su cola
    if (respuesta && opciones[0]?.envio.ficha === 'entendido') this.alEntender(jugador.id);
    this.guardar({ personaje, asiento: jugador.id, estado: 'hecho', avisos, opciones: [] });
  }

  /**
   * Le manda algo a un asiento o, si aún no ha entendido lo anterior (o hay cola), lo
   * pone a la cola. El «Entendido» del narrador (a lo que ha elegido) no es un
   * despertar: va siempre, y cierra lo anterior.
   */
  private entregar(jugadorId: string, { envio, eleccion }: Envio): void {
    if (envio.ficha === 'entendido') {
      this.entorno.mandar(jugadorId, envio);
      this.alEntender(jugadorId);
      return;
    }
    const cola = this.colas.get(jugadorId) ?? [];
    const ocupado = !!this.entorno.ctx.plaza().find((a) => a.id === jugadorId)?.participanteId;
    if (ocupado && (cola.length || this.entorno.porEntender(jugadorId))) this.colas.set(jugadorId, [...cola, { envio, eleccion }]);
    else this.entorno.mandar(jugadorId, envio, eleccion);
  }

  /** Lo último de un asiento ya está entendido: se le manda lo siguiente de su cola, si hay. */
  alEntender(jugadorId: string): void {
    const [siguiente, ...resto] = this.colas.get(jugadorId) ?? [];
    if (!siguiente) return;
    if (resto.length) this.colas.set(jugadorId, resto);
    else this.colas.delete(jugadorId);
    this.entorno.mandar(jugadorId, siguiente.envio, siguiente.eleccion);
  }



  /** Lo que tiene que elegir el de un asiento (se le ha pedido y aún no ha contestado), o null. */
  eleccionPendiente(jugadorId: string): EleccionDespertar | null {
    // Mientras la petición espera en la cola, aún no se le ha pedido
    if (this.colas.get(jugadorId)?.some((e) => e.eleccion)) return null;
    const turno = this.turnos.find((t) => t.asiento === jugadorId && t.estado === 'esperando');
    return (turno && this.entorno.habilidades().get(turno.personaje)?.eleccion) ?? null;
  }

  /** El de un asiento ha elegido (ya comprobado: ver eleccionPendiente): se hace lo que diga su habilidad. */
  alElegir(jugadorId: string, elegidos: string[]): void {
    const turno = this.turnos.find((t) => t.asiento === jugadorId && t.estado === 'esperando');
    const habilidad = turno && this.entorno.habilidades().get(turno.personaje);
    const plaza = this.entorno.ctx.plaza();
    const jugador = plaza.find((a) => a.id === jugadorId);
    if (!turno || !habilidad || !jugador) return;
    const elegidosEnPlaza = elegidos.flatMap((id) => plaza.find((a) => a.id === id) ?? []);
    // Con quién ha despertado esta noche por su habilidad (la Camarera)
    const ctx = { ...this.entorno.ctx, despertados: () => this.despertados() };
    // La respuesta a lo que ha elegido es del mismo despertar: no espera en la cola
    this.aplicar(turno.personaje, jugador, habilidad.alElegir(ctx, jugador, elegidosEnPlaza), true);
  }

  /**
   * Los asientos despertados esta noche por su habilidad: los que tienen turno (solo
   * se guarda al despertarlos), sin la información de los esbirros y del demonio.
   */
  private despertados(): string[] {
    return this.turnos.filter((t) => t.personaje !== 'esbirros' && t.personaje !== 'demonios').map((t) => t.asiento);
  }

  /**
   * El narrador manda lo revisado (una de las opciones o lo que haya cambiado): se
   * le manda y la fila queda hecha. Lo demás (recordatorios, muertes) lo pone él.
   * Devuelve el error, si lo hay.
   */
  resolver(personaje: string, envio: EnvioDespertar): string | null {
    const habilidad = this.entorno.habilidades().get(personaje);
    const jugador = this.asientoDe(personaje);
    if (!habilidad || !jugador) return 'Nadie lleva ese personaje.';
    const turno = this.turnoDe(personaje, jugador.id);
    const preparado = turno ?? habilidad.preparar(this.entorno.ctx, jugador);
    if (preparado.estado !== 'revisar') return 'No hay nada que revisar.';
    const error = this.entorno.despertar(jugador.id);
    if (error) return error;
    this.entregar(jugador.id, { envio });
    this.guardar({ personaje, asiento: jugador.id, estado: 'hecho', avisos: preparado.avisos, opciones: [] });
    return null;
  }

  /** El asiento del Imp que se ha elegido a sí mismo, si falta decir quién es el nuevo; si no, null. */
  nuevoImp(): string | null {
    return this.impQueMuere;
  }

  /** El nuevo Imp: su ficha pasa a ser la del Imp y se le despierta para decírselo. Devuelve el error, si lo hay. */
  elegirNuevoImp(jugadorId: string): string | null {
    if (!this.impQueMuere) return 'No hay que elegir un nuevo Imp.';
    if (jugadorId === this.impQueMuere) return 'Elige a otro jugador.';
    this.entorno.cambiarPersonaje(jugadorId, 'imp');
    const error = this.entorno.despertar(jugadorId);
    if (error) return error;
    this.entregar(jugadorId, { envio: tarjeta('tuEres', { personajes: ['imp'], alineamiento: 'malvado' }) });
    this.impQueMuere = null;
    return null;
  }

  /** Otra noche (u otra partida): se empieza de cero. */
  olvidar(): void {
    this.turnos = [];
    this.impQueMuere = null;
    this.colas.clear();
  }
}
