import type { RespuestaPregunta } from './preguntaPartida';
import type { EnvioDespertar, FichaDespertar, TarjetaDespertar } from './despertar';
import type { Alineamiento } from './jugador';
import type { Fase } from './partida';

/**
 * El diario de la partida: el registro de todo lo que pasa en ella, en orden. Es
 * lo único que se apunta (ver Partida.anotar y Registro): de él salen las
 * estadísticas, las votaciones, el historial, los logros y lo que se cuenta al
 * narrador virtual (ver models/partida/proyecciones). Se apunta todo, también en la
 * preparación; el historial enseña solo lo que interesa (ver HECHOS_DEL_HISTORIAL).
 * Lo que solo hace el narrador virtual (el disparo del Exterminador, el Patoso, el
 * Artista) solo sale con él.
 *
 * Los diarios ya guardados se siguen leyendo: lo que se ha añadido después es opcional.
 */

/**
 * Un asiento tal como estaba al apuntarlo: su número en la plaza y quien se sentaba
 * (null: libre); su id y la cuenta de quien se sentaba (no están en los diarios antiguos).
 */
export interface AsientoDiario {
  numero: number;
  nombre: string | null;
  id?: string;
  userId?: string | null;
}

/** Un asiento de la plaza en un momento de la partida (al anochecer, al amanecer, al terminar). */
export interface FotoAsiento {
  /** Su número en la plaza (1, el de las 12). */
  numero: number;
  /** Quien se sienta (su nombre en la sala), o null si está libre. */
  nombre: string | null;
  /** Su cuenta, si la tiene. */
  userId: string | null;
  /** Quien es de verdad (su «Is The …» o su ficha). */
  personaje: string | null;
  /** La ficha que lleva, si no es quien es de verdad (el Borracho que se cree Lavandera). */
  ficha: string | null;
  alineamiento: Alineamiento | null;
  muerto: boolean;
  /** Su id (no está en las partidas guardadas antes). */
  id?: string;
  /** Si está envenenado o borracho (no está en las partidas guardadas antes). */
  droison?: 'envenenado' | 'borracho' | null;
}

/**
 * Por qué muere alguien: lo ejecuta la plaza, lo expulsa (un viajero), lo mata el
 * narrador a mano o lo mata una habilidad (el id del personaje: el demonio, el
 * Exterminador…).
 */
export type CausaMuerte = 'ejecucion' | 'expulsion' | 'narrador' | (string & {});

export type HechoDiario =
  /** Un mensaje en un despertar: del narrador al asiento o del jugador al narrador. `eleccion`: a cuántos le pide elegir. */
  | {
      tipo: 'despertar';
      asiento: AsientoDiario;
      delNarrador: boolean;
      ficha: FichaDespertar | null;
      tarjeta: TarjetaDespertar | null;
      jugadores: AsientoDiario[];
      personajes: string[];
      texto: string | null;
      alineamiento: Alineamiento | null;
      eleccion: number | null;
    }
  /** Muere (de noche, cuando se le pone la muerte, aunque se anuncie al amanecer); `causa`, no en los antiguos. */
  | { tipo: 'muere'; asiento: AsientoDiario; causa?: CausaMuerte }
  | { tipo: 'revive'; asiento: AsientoDiario }
  /** El narrador anuncia la muerte que tenía pendiente (la de la noche). */
  | { tipo: 'anunciaMuerte'; asiento: AsientoDiario }
  | { tipo: 'ejecucion'; asiento: AsientoDiario }
  /** Su ficha pasa a ser otra (null: se le quita). */
  | { tipo: 'personaje'; asiento: AsientoDiario; personaje: string | null }
  | { tipo: 'alineamiento'; asiento: AsientoDiario; alineamiento: Alineamiento }
  /** Se le pone (o se le quita) un recordatorio. */
  | { tipo: 'recordatorio'; asiento: AsientoDiario; personaje: string; texto: string; quitado: boolean }
  /** El voto de un muerto: lo gasta (o lo recupera, `gastado` false). */
  | { tipo: 'votoMuerto'; asiento: AsientoDiario; gastado: boolean }
  /** El narrador le envía una copia del grimorio. */
  | { tipo: 'grimorio'; asiento: AsientoDiario }
  /** Pone un farol en una casilla (null: la vacía). Sin asiento, los del narrador para el demonio. */
  | { tipo: 'farol'; asiento: AsientoDiario | null; posicion: number; personaje: string | null }
  /** Copia en sus faroles los que le ha enseñado el narrador. */
  | { tipo: 'copiaFaroles'; asiento: AsientoDiario; personajes: string[] }
  /** Dice que se hace pasar por uno de sus faroles (null: por ninguno). */
  | { tipo: 'usaFarol'; asiento: AsientoDiario; personaje: string | null }
  /** En un señalamiento, señala a otro (null: deja de señalar). */
  | { tipo: 'senala'; asiento: AsientoDiario; objetivo: AsientoDiario | null }
  /** Se declara Exterminador y dispara (con narrador virtual). */
  | { tipo: 'exterminador'; asiento: AsientoDiario; objetivo: AsientoDiario; muere: boolean }
  /** Se declara Patoso y elige (con narrador virtual). `porElNarrador`: no eligió a tiempo y eligió el narrador. */
  | { tipo: 'patoso'; asiento: AsientoDiario; objetivo: AsientoDiario; porElNarrador: boolean }
  /** Hace la pregunta del Artista (con narrador virtual). */
  | { tipo: 'artista'; asiento: AsientoDiario; pregunta: string; respuesta: RespuestaPregunta }
  /**
   * Anochece: la plaza como está al caer la noche (`desdePreparacion`: empieza la
   * partida) y quien lleva la calavera (la plaza lo ha ejecutado, si nadie más).
   */
  | { tipo: 'anochece'; desdePreparacion: boolean; plaza: FotoAsiento[]; calavera: AsientoDiario | null }
  /** Amanece: la plaza como empieza el día. */
  | { tipo: 'amanece'; plaza: FotoAsiento[] }
  /**
   * El narrador virtual da información a un rol envenenado o borracho (con su
   * personaje): la de verdad, la que le da y cómo está. Para ser coherente las
   * noches siguientes y contarlo al revelar; no sale en el historial.
   */
  | {
      tipo: 'informacion';
      asiento: AsientoDiario;
      personaje: string;
      verdadera: EnvioDespertar;
      dada: EnvioDespertar;
      droison: 'envenenado' | 'borracho' | null;
    }
  /** El narrador virtual apunta lo que acaba la partida o conviene dejar dicho (CAUSAS_FIN_PARTIDA): de ahí salen los logros. */
  | { tipo: 'causa'; id: string }
  /** Se limpia el grimorio: empieza otra partida (con ese id). */
  | { tipo: 'nuevaPartida'; partida: string }
  /** Alguien nomina a alguien (o pide la expulsión de un viajero). */
  | { tipo: 'nominacion'; asiento: AsientoDiario; objetivo: AsientoDiario; expulsion: boolean }
  /** La aguja pasa por su ficha y vota (`valor`: lo que vale su voto). */
  | { tipo: 'voto'; asiento: AsientoDiario; valor: number }
  /** Se reinicia la votación: los votos contados en ella no valen. */
  | { tipo: 'reinicioVotacion' }
  /** Termina la votación: los votos que ha tenido. */
  | { tipo: 'votacion'; votos: number }
  /**
   * Se revela el grimorio: gana ese bando, por esas causas (CAUSAS_FIN_PARTIDA; las de
   * esbirro, con su cuenta) y con la plaza así. Lo demás, para el historial.
   */
  | {
      tipo: 'final';
      ganador: Alineamiento;
      causas: { id: string; userId?: string | null }[];
      plaza: FotoAsiento[];
      narradores: { userId: string | null; nombre: string }[];
      npcs: string[];
      guion: string | null;
      edicion: string | null;
    };

/** Un hecho del diario, con cuándo pasó. */
export type EntradaDiario = HechoDiario & {
  fase: { momento: Fase['momento']; numero: number };
  /** ms */
  hora: number;
};

/**
 * Lo que enseña el historial de una partida: lo que pasa en ella. Lo demás (los
 * cambios de fase, cada voto, el final) sale de otro modo (las votaciones, el
 * resultado) o no interesa. En la preparación, solo los faroles.
 */
export const HECHOS_DEL_HISTORIAL: readonly HechoDiario['tipo'][] = [
  'despertar', 'muere', 'revive', 'ejecucion', 'personaje', 'alineamiento', 'recordatorio', 'votoMuerto', 'grimorio',
  'farol', 'copiaFaroles', 'usaFarol', 'senala', 'exterminador', 'patoso', 'artista',
];
const DE_LA_PREPARACION: readonly HechoDiario['tipo'][] = ['farol', 'copiaFaroles', 'usaFarol'];

/** Si el historial enseña esta entrada (ver HECHOS_DEL_HISTORIAL). */
export const enElHistorial = (e: EntradaDiario): boolean =>
  HECHOS_DEL_HISTORIAL.includes(e.tipo) && (e.fase.momento !== 'preparacion' || DE_LA_PREPARACION.includes(e.tipo));
