import type { Alineamiento } from '../../models/compartido/jugador';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer al revelar el grimorio (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_REVELACION = ['revelacion:empezar', 'revelacion:revelarFicha', 'revelacion:terminar'] as const;
type UsoRevelacion = (typeof USOS_REVELACION)[number];

/** Un narrador, con el grimorio revelándose. */
const revelando: Permiso = ({ partida }, yo) => {
  const revelacion = partida.revelacion.revelacion();
  return yo.rol === 'narrador' && revelacion && !revelacion.terminada ? null : 'No se está revelando el grimorio.';
};

/** Quién puede hacer cada cosa al revelar el grimorio y, si no, por qué. */
const PERMISOS: Record<UsoRevelacion, Permiso> = {
  'revelacion:empezar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede revelar el grimorio.';
    if (partida.revelacion.revelacion()) return 'Ya se está revelando el grimorio.';
    return partida.plaza().length > 0 ? null : 'La plaza no tiene asientos.';
  },
  'revelacion:revelarFicha': revelando,
  'revelacion:terminar': revelando,
};

/**
 * Los casos de uso del final de la partida: el narrador revela el grimorio (quién
 * gana y lo que ha pasado) y va dando la vuelta a las fichas. Las reglas están en
 * la partida (Partida.revelarGrimorio) y en models/partida/Revelacion. Si cambia,
 * avisa para que la sala se mande a todos.
 */
export class RevelacionService {
  private readonly usos: UsosSala<UsoRevelacion>;

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

  /** Lo que puede hacer ahora al revelar el grimorio (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_REVELACION);
  }

  /**
   * Revela el grimorio (final de la partida): ha ganado ese bando y todas las fichas
   * se dan la vuelta. `causas`: lo que ha pasado (CAUSAS_FIN_PARTIDA); `esbirros`, de
   * las de esbirro, qué asiento fue.
   */
  empezar(yoId: string, ganador: Alineamiento, causas: readonly string[], esbirros: Readonly<Record<string, string>>): ResultadoUso {
    return this.usos.hacer(yoId, 'revelacion:empezar', () => this.juego.partida.revelarGrimorio(ganador, causas, esbirros));
  }

  /** Revela la ficha de un asiento, para todos. */
  revelarFicha(yoId: string, jugadorId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'revelacion:revelarFicha', () => this.juego.partida.revelacion.revelarFicha(jugadorId));
  }

  /** Termina la revelación: revela de una vez las fichas que quedan. */
  terminar(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'revelacion:terminar', () => {
      this.juego.partida.revelacion.revelarTodas();
      return null;
    });
  }
}
