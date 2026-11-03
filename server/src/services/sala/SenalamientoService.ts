import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer con los señalamientos (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_SENALAMIENTO = ['senalamiento:empezar', 'senalamiento:lilmonsta', 'senalamiento:terminar', 'senalamiento:senalar'] as const;
type UsoSenalamiento = (typeof USOS_SENALAMIENTO)[number];

/** Lo que pide el narrador al empezar un señalamiento (listas vacías: todos; segundos null: sin cuenta atrás). */
export interface PeticionSenalamiento {
  mensaje: string;
  segundos: number | null;
  senaladores: readonly string[];
  objetivos: readonly string[];
}

/** Quién puede hacer cada cosa con los señalamientos y, si no, por qué. */
const PERMISOS: Record<UsoSenalamiento, Permiso> = {
  'senalamiento:empezar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede pedir que se señale.';
    return partida.plaza().length > 0 ? null : 'La plaza no tiene asientos.';
  },
  'senalamiento:lilmonsta': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return "Solo un narrador puede empezar Lil' Monsta.";
    return partida.esbirrosLilmonsta() ? null : "Lil' Monsta se empieza de noche, sin demonio en la plaza y con un esbirro de más.";
  },
  'senalamiento:terminar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede terminar el señalamiento.';
    return partida.senalamientos.senalamiento() ? null : 'No hay ningún señalamiento.';
  },
  // El jugador de un asiento que señala, mientras no se congele
  'senalamiento:senalar': ({ partida }, yo) => {
    const s = partida.senalamientos.senalamiento();
    const jugador = partida.jugadorDe(yo.id);
    return yo.rol === 'jugador' && s && !s.congelado && jugador && s.senaladores.includes(jugador.id) ? null : 'No te toca señalar.';
  },
};

/**
 * Los casos de uso de los señalamientos (también el de Lil' Monsta): el narrador
 * los empieza y los quita, y los jugadores que señalan eligen. Las reglas están en
 * la partida (Partida.empezarSenalamiento, senalar) y en models/partida/Senalamientos.
 * Si cambia, avisa para que la sala se mande a todos.
 */
export class SenalamientoService {
  private readonly usos: UsosSala<UsoSenalamiento>;

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

  /** Lo que puede hacer ahora con los señalamientos (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_SENALAMIENTO);
  }

  /** Empieza un señalamiento (sustituye al que hubiera): quiénes señalan, a quiénes, el mensaje y la cuenta atrás. */
  empezar(yoId: string, peticion: PeticionSenalamiento): ResultadoUso {
    return this.usos.hacer(yoId, 'senalamiento:empezar', () => this.juego.partida.empezarSenalamiento(peticion));
  }

  /** Lil' Monsta: los esbirros eligen quién lo cuida. */
  lilmonsta(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'senalamiento:lilmonsta', () => this.juego.partida.empezarLilmonsta());
  }

  /** Quita el señalamiento (en marcha o ya congelado). */
  terminar(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'senalamiento:terminar', () => {
      this.juego.partida.senalamientos.terminar();
      return null;
    });
  }

  /** El jugador de un asiento que señala elige a quién (null: deja de señalar). */
  senalar(yoId: string, jugadorId: string | null): ResultadoUso {
    return this.usos.hacer(yoId, 'senalamiento:senalar', () => this.juego.partida.senalar(yoId, jugadorId));
  }
}
