import type { BorradorDespertar } from '../../models/partida/mensajeDespertar';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer de noche (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_NOCHE = [
  'noche:despertar',
  'noche:enviar',
  'noche:despertarHabilidad',
  'noche:resolverHabilidad',
  'noche:nuevoImp',
  'noche:recordatorio',
] as const;
type UsoNoche = (typeof USOS_NOCHE)[number];

/** Un narrador, de noche. */
const deNoche: Permiso = ({ partida }, yo) => {
  if (yo.rol !== 'narrador') return 'Solo un narrador puede despertar a alguien.';
  return partida.fases.actual().momento === 'noche' ? null : 'Solo se despierta a alguien de noche.';
};

/** Quién puede hacer cada cosa de noche y, si no, por qué. */
const PERMISOS: Record<UsoNoche, Permiso> = {
  // De día, solo el narrador virtual con el Violinista (el demonio elige en secreto)
  'noche:despertar': (juego, yo) => (yo.rol === 'narrador' && juego.narrador.actual()?.etapa === 'violinista' ? null : deNoche(juego, yo)),
  // El narrador, a cualquier despertar abierto; el jugador, en el suyo
  'noche:enviar': ({ partida }, yo) => {
    const abierto =
      yo.rol === 'narrador' ? partida.despertares.despertares().length > 0 : yo.rol === 'jugador' && !!partida.despertares.asientoDespiertoDe(yo.id);
    return abierto ? null : 'No tienes ningún despertar abierto.';
  },
  'noche:despertarHabilidad': deNoche,
  'noche:resolverHabilidad': deNoche,
  'noche:nuevoImp': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador elige al nuevo Imp.';
    return partida.guiado.nuevoImp() ? null : 'No hay que elegir un nuevo Imp.';
  },
  'noche:recordatorio': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede cambiar los recordatorios.';
    return partida.guion.actual() ? null : 'Aún no hay guion.';
  },
};

/**
 * Los casos de uso de la noche: los despertares (también los guiados), el nuevo Imp
 * y la estrella de cada fila del orden de noche. Las reglas están en la partida
 * (Partida.enviarAlDespertar, resolverHabilidad…) y en models/partida/Despertares y
 * DespertarGuiado. Si cambia, avisa para que la sala se mande a todos.
 */
export class NocheService {
  private readonly usos: UsosSala<UsoNoche>;

  constructor(
    private readonly juego: SalaDeJuego,
    /** La sala ha cambiado: se manda a todos. */
    alCambiar: () => void,
  ) {
    this.usos = new UsosSala(juego, PERMISOS, alCambiar);
  }

  /** El participante de una sesión (su id), o null si ya no está en la sala. */
  quienEs(clave: string): string | null {
    return this.usos.quienEs(clave);
  }

  /** Lo que puede hacer ahora de noche (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_NOCHE);
  }

  /**
   * Abre el despertar de un asiento (también de uno libre: cuenta como un jugador
   * más), para mandarle información y que conteste. Si ya lo tiene, no hace nada.
   */
  despertar(yoId: string, jugadorId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'noche:despertar', () => this.juego.partida.despertares.despertar(jugadorId));
  }

  /**
   * Un mensaje en un despertar (ver Partida.enviarAlDespertar): el narrador, a los de
   * esos asientos; el jugador, al narrador en el suyo (`jugadorIds` no cuenta).
   */
  enviar(yoId: string, jugadorIds: readonly string[], borrador: BorradorDespertar): ResultadoUso {
    return this.usos.hacer(yoId, 'noche:enviar', () => {
      const yo = this.juego.sala.participantes.buscar(yoId)!;
      const de = yo.rol === 'narrador' ? { narrador: [...jugadorIds], virtual: yo.persona.tipo === 'virtual' } : { jugador: yoId };
      return this.juego.partida.enviarAlDespertar(de, borrador);
    });
  }

  /** El despertar guiado: despierta al de una fila del orden de noche según su habilidad, si está listo. */
  despertarHabilidad(yoId: string, personajeId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'noche:despertarHabilidad', () => this.juego.partida.guiado.despertar(personajeId));
  }

  /** El despertar guiado, revisado: lo que ha decidido el narrador para una fila que había que revisar. */
  resolverHabilidad(yoId: string, personajeId: string, borrador: BorradorDespertar): ResultadoUso {
    return this.usos.hacer(yoId, 'noche:resolverHabilidad', () => this.juego.partida.resolverHabilidad(personajeId, borrador));
  }

  /** El Imp se ha elegido a sí mismo: el narrador dice quién es el nuevo. */
  nuevoImp(yoId: string, jugadorId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'noche:nuevoImp', () => this.juego.partida.elegirNuevoImp(jugadorId));
  }

  /** Pone o quita la estrella de una fila del orden de noche, para todos los narradores. */
  recordatorio(yoId: string, id: string, activo: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'noche:recordatorio', () => this.juego.partida.cambiarRecordatorio(id, activo));
  }
}
