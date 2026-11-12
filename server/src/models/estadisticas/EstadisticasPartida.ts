import type { EntradaDiario } from '../compartido/diario';
import type { EventoPartida, FotoAsiento } from '../partida/eventos';
import { SeguimientoPartida, type FotoJugador, type InstantaneaSeguimiento, type RegistroPartida } from './SeguimientoPartida';

/** Cómo están los jugadores con cuenta en una foto de la mesa. */
const fotosDeCuentas = (mesa: FotoAsiento[]): FotoJugador[] =>
  mesa.flatMap((a) => (a.userId ? [{ userId: a.userId, personaje: a.personaje, alineamiento: a.alineamiento, muerto: a.muerto }] : []));

/**
 * Las estadísticas de la sala: escucha lo que pasa en la partida (ver
 * eventos.ts), lo va apuntando (SeguimientoPartida) y, al terminar, da la
 * partida para que se guarde. La sala no sabe que existe.
 */
export class EstadisticasPartida {
  private seguimiento = new SeguimientoPartida();
  /** Lo que se ha hecho en la partida, en orden (ver models/compartido/diario). */
  private diario: EntradaDiario[] = [];

  constructor(
    /** A quién se da cada partida terminada (con alguien con cuenta) para que la guarde. */
    private readonly guardar: (registro: RegistroPartida) => void,
  ) {}

  /** Lo que acaba de pasar en la partida. */
  registrar(evento: EventoPartida): void {
    switch (evento.tipo) {
      case 'anochece':
        if (evento.desdePreparacion || !this.seguimiento.estaEmpezada()) this.seguimiento.empezar(fotosDeCuentas(evento.plaza));
        else for (const userId of evento.conCalavera) this.seguimiento.ejecutado(userId);
        return;
      case 'amanece':
        // El rol con el que empieza el día cuenta como jugado (los cambios de la noche, no)
        this.seguimiento.anotarRoles(fotosDeCuentas(evento.plaza));
        return;
      case 'nominacion':
        this.seguimiento.nomina(evento.nomina, evento.nominado);
        return;
      case 'voto':
        this.seguimiento.vota(evento.userId);
        return;
      case 'desvoto':
        this.seguimiento.desvota(evento.userId);
        return;
      case 'ejecucion':
        this.seguimiento.ejecutado(evento.userId);
        return;
      case 'diario':
        this.diario.push(evento.entrada);
        return;
      case 'nuevaPartida':
        this.diario = [];
        this.seguimiento.reiniciar();
        return;
      case 'partidaTerminada':
        this.terminar(evento);
        return;
    }
  }

  /** Una copia de lo apuntado, para deshacerlo con la partida (ver Historia). */
  instantanea(): InstantaneaEstadisticas {
    return { seguimiento: this.seguimiento.instantanea(), diario: structuredClone(this.diario) };
  }

  restaurar({ seguimiento, diario }: InstantaneaEstadisticas): void {
    this.seguimiento.restaurar(seguimiento);
    this.diario = structuredClone(diario);
  }

  /** Se acaba la partida: se guarda lo de cada uno (si se había empezado a jugar) y la mesa, para el historial. */
  private terminar(fin: Extract<EventoPartida, { tipo: 'partidaTerminada' }>): void {
    const jugadores = this.seguimiento.estaEmpezada() ? this.seguimiento.terminar(fotosDeCuentas(fin.plaza), fin.ganador, fin.causas) : [];
    const narradores = fin.narradores.map((n) => n.userId).filter((id): id is string => !!id);
    const diario = this.diario;
    this.diario = [];
    if (jugadores.length === 0 && narradores.length === 0) return;
    this.guardar({
      diario,
      mesa: fin.plaza,
      narradoresNombres: fin.narradores.map((n) => n.nombre),
      npcs: fin.npcs,
      votaciones: fin.votaciones,
      fecha: new Date(),
      guion: fin.guion,
      edicion: fin.edicion,
      ganador: fin.ganador,
      dias: fin.dias,
      causas: fin.causas.map((c) => c.id),
      jugadores,
      narradores,
    });
  }
}

/** Lo apuntado en un momento (ver EstadisticasPartida.instantanea). */
export interface InstantaneaEstadisticas {
  seguimiento: InstantaneaSeguimiento;
  diario: EntradaDiario[];
}
