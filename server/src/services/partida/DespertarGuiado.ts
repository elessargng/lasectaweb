import type {
  SalaAsiento,
  SalaAvisoHabilidad,
  SalaEleccionDespertar,
  SalaEnvioDespertar,
  SalaHabilidadNoche,
  SalaOpcionDespertar,
} from '../../contrato/sala';
import { tarjeta, type ContextoNoche, type HabilidadNocturna, type Resultado } from './habilidades/HabilidadNocturna';

/** Lo que el despertar guiado necesita de la sala. */
export interface EntornoDespertarGuiado {
  ctx: ContextoNoche;
  /** Las habilidades de noche del guion, por personaje. */
  habilidades: () => ReadonlyMap<string, HabilidadNocturna>;
  /** Es de noche. */
  noche: () => boolean;
  /** Abre el despertar de un asiento (ver Despertares.despertar). */
  despertar: (asientoId: string) => string | null;
  /** Manda algo del narrador a un asiento (con `eleccion`, se le pide que elija). */
  mandar: (asientoId: string, envio: SalaEnvioDespertar, eleccion?: SalaEleccionDespertar) => void;
  /** Pone un recordatorio de un personaje (por su texto) en un asiento; único en la mesa. */
  ponerRecordatorio: (asientoId: string, personaje: string, texto: string) => void;
  /** Mata de noche (la muerte queda pendiente). */
  matarDeNoche: (asientoId: string) => void;
  /** Envía el grimorio de la partida a quien se sienta en el asiento. */
  enviarGrimorio: (asientoId: string) => void;
  cambiarPersonaje: (asientoId: string, personaje: string) => void;
}

/** Lo que ya se ha hecho esta noche con una habilidad. */
interface Turno {
  personaje: string;
  asiento: string;
  estado: 'esperando' | 'revisar' | 'hecho';
  avisos: SalaAvisoHabilidad[];
  opciones: SalaOpcionDespertar[];
}

/**
 * El despertar guiado: el narrador despierta a un personaje desde el orden de
 * noche y la sala hace lo que dice su habilidad (ver habilidades/). Si elige, se
 * le pide que elija solo lo que puede y, al contestar, se pone lo que toque y se
 * le responde; si recibe información, se le manda. Cuando algo no está claro
 * (droison, un Espía o una Reclusa, el Alcalde), lo revisa el narrador. Lo de cada
 * noche se olvida al anochecer otra vez. No comprueba permisos.
 */
export class DespertarGuiado {
  private turnos: Turno[] = [];
  /** El asiento del Imp que se ha elegido a sí mismo, hasta que el narrador dice quién es el nuevo. */
  private impQueMuere: string | null = null;

  constructor(private readonly entorno: EntornoDespertarGuiado) {}

  /**
   * El asiento que despierta con un personaje: el de su ficha (el que cree serlo).
   * Antes uno vivo; si no, uno que muere esta noche; si no, cualquiera.
   */
  private asientoDe(personaje: string): SalaAsiento | null {
    const con = this.entorno.ctx.mesa().filter((a) => a.personaje === personaje);
    return con.find((a) => !a.muerto && !a.muertePendiente) ?? con.find((a) => !a.muerto) ?? con[0] ?? null;
  }

  private turnoDe(personaje: string, asiento: string): Turno | undefined {
    return this.turnos.find((t) => t.personaje === personaje && t.asiento === asiento);
  }

  private guardar(turno: Turno): void {
    this.turnos = [...this.turnos.filter((t) => !(t.personaje === turno.personaje && t.asiento === turno.asiento)), turno];
  }

  /** Cada fila del orden de noche con habilidad y ficha en la mesa: cómo está. Fuera de la noche, ninguna. */
  habilidadesNoche(): SalaHabilidadNoche[] {
    if (!this.entorno.noche()) return [];
    return [...this.entorno.habilidades().values()].flatMap((h): SalaHabilidadNoche[] => {
      const asiento = this.asientoDe(h.personaje);
      if (!asiento) return [];
      const turno = this.turnoDe(h.personaje, asiento.id);
      if (turno) return [{ personaje: h.personaje, asiento: asiento.id, estado: turno.estado, avisos: turno.avisos, opciones: turno.opciones }];
      const { estado, avisos, opciones } = h.preparar(this.entorno.ctx, asiento);
      return [{ personaje: h.personaje, asiento: asiento.id, estado, avisos, opciones }];
    });
  }

  /**
   * Despierta a un personaje según su habilidad: si elige, se le pide que elija
   * (otra vez, si aún no lo ha hecho); si no, se le manda lo que sabe. Solo si está
   * listo. Devuelve el error, si lo hay.
   */
  despertar(personaje: string): string | null {
    const habilidad = this.entorno.habilidades().get(personaje);
    if (!habilidad) return 'Ese personaje no se despierta solo.';
    const asiento = this.asientoDe(personaje);
    if (!asiento) return 'Nadie lleva ese personaje.';
    const turno = this.turnoDe(personaje, asiento.id);
    if (turno?.estado === 'hecho') return 'Ya se ha despertado esta noche.';
    if (turno?.estado === 'revisar') return 'Antes hay que revisar lo que se le manda.';
    const preparado = habilidad.preparar(this.entorno.ctx, asiento);
    if (preparado.estado === 'falta') return 'Falta algo en el grimorio.';
    if (preparado.estado === 'revisar') return 'Antes hay que revisar lo que se le manda.';
    const error = this.entorno.despertar(asiento.id);
    if (error) return error;
    if (habilidad.eleccion) {
      this.entorno.mandar(asiento.id, tarjeta('eleccion'), habilidad.eleccion);
      this.guardar({ personaje, asiento: asiento.id, estado: 'esperando', avisos: preparado.avisos, opciones: [] });
    } else this.aplicar(personaje, asiento, preparado);
    return null;
  }

  /** Lo que pasa con lo que dice la habilidad: si está listo, se hace; si no, queda para revisar. */
  private aplicar(personaje: string, asiento: SalaAsiento, resultado: Resultado): void {
    const { estado, avisos, opciones, efectos } = resultado;
    if (estado !== 'listo') {
      this.guardar({ personaje, asiento: asiento.id, estado: 'revisar', avisos, opciones });
      return;
    }
    for (const r of efectos.recordatorios) this.entorno.ponerRecordatorio(r.asiento, personaje, r.texto);
    if (efectos.muere) this.entorno.matarDeNoche(efectos.muere);
    if (efectos.grimorio) this.entorno.enviarGrimorio(asiento.id);
    if (efectos.nuevoImp) this.impQueMuere = asiento.id;
    if (opciones[0]) this.entorno.mandar(asiento.id, opciones[0].envio);
    this.guardar({ personaje, asiento: asiento.id, estado: 'hecho', avisos, opciones: [] });
  }

  /** Lo que tiene que elegir el de un asiento (se le ha pedido y aún no ha contestado), o null. */
  eleccionPendiente(asientoId: string): SalaEleccionDespertar | null {
    const turno = this.turnos.find((t) => t.asiento === asientoId && t.estado === 'esperando');
    return (turno && this.entorno.habilidades().get(turno.personaje)?.eleccion) ?? null;
  }

  /** El de un asiento ha elegido (ya comprobado: ver eleccionPendiente): se hace lo que diga su habilidad. */
  alElegir(asientoId: string, elegidos: string[]): void {
    const turno = this.turnos.find((t) => t.asiento === asientoId && t.estado === 'esperando');
    const habilidad = turno && this.entorno.habilidades().get(turno.personaje);
    const mesa = this.entorno.ctx.mesa();
    const asiento = mesa.find((a) => a.id === asientoId);
    if (!turno || !habilidad || !asiento) return;
    const elegidosEnMesa = elegidos.flatMap((id) => mesa.find((a) => a.id === id) ?? []);
    this.aplicar(turno.personaje, asiento, habilidad.alElegir(this.entorno.ctx, asiento, elegidosEnMesa));
  }

  /**
   * El narrador manda lo revisado (una de las opciones o lo que haya cambiado): se
   * le manda y la fila queda hecha. Lo demás (recordatorios, muertes) lo pone él.
   * Devuelve el error, si lo hay.
   */
  resolver(personaje: string, envio: SalaEnvioDespertar): string | null {
    const habilidad = this.entorno.habilidades().get(personaje);
    const asiento = this.asientoDe(personaje);
    if (!habilidad || !asiento) return 'Nadie lleva ese personaje.';
    const turno = this.turnoDe(personaje, asiento.id);
    const preparado = turno ?? habilidad.preparar(this.entorno.ctx, asiento);
    if (preparado.estado !== 'revisar') return 'No hay nada que revisar.';
    const error = this.entorno.despertar(asiento.id);
    if (error) return error;
    this.entorno.mandar(asiento.id, envio);
    this.guardar({ personaje, asiento: asiento.id, estado: 'hecho', avisos: preparado.avisos, opciones: [] });
    return null;
  }

  /** El asiento del Imp que se ha elegido a sí mismo, si falta decir quién es el nuevo; si no, null. */
  nuevoImp(): string | null {
    return this.impQueMuere;
  }

  /** El nuevo Imp: su ficha pasa a ser la del Imp y se le despierta para decírselo. Devuelve el error, si lo hay. */
  elegirNuevoImp(asientoId: string): string | null {
    if (!this.impQueMuere) return 'No hay que elegir un nuevo Imp.';
    if (asientoId === this.impQueMuere) return 'Elige a otro jugador.';
    this.entorno.cambiarPersonaje(asientoId, 'imp');
    const error = this.entorno.despertar(asientoId);
    if (error) return error;
    this.entorno.mandar(asientoId, tarjeta('tuEres', { personajes: ['imp'], alineamiento: 'malvado' }));
    this.impQueMuere = null;
    return null;
  }

  /** Otra noche (u otra partida): se empieza de cero. */
  olvidar(): void {
    this.turnos = [];
    this.impQueMuere = null;
  }

  /** Los asientos han cambiado de sitio (ver SalaService.llevarFichas): cada turno va con el suyo. */
  remapear(a: (asientoId: string) => string): void {
    for (const t of this.turnos) t.asiento = a(t.asiento);
    if (this.impQueMuere) this.impQueMuere = a(this.impQueMuere);
  }
}
