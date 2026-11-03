import type { Alineamiento } from '../../models/compartido/jugador';
import type { BorradorFicha } from '../../models/partida/grimorioEnviado';
import { NPC_FERRYMAN, NPC_GARDENER } from '../../models/partida/personajesEspeciales';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer con el grimorio (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_GRIMORIO = [
  'grimorio:personaje',
  'grimorio:intercambiar',
  'grimorio:alineamiento',
  'grimorio:vida',
  'grimorio:confirmarMuerte',
  'grimorio:voto',
  'grimorio:barquero',
  'grimorio:recordatorio',
  'grimorio:recordatorioTexto',
  'grimorio:quitarRecordatorio',
  'grimorio:nota',
  'grimorio:borrarNota',
  'grimorio:enviar',
] as const;
type UsoGrimorio = (typeof USOS_GRIMORIO)[number];

/** Un narrador, con asientos en la plaza (si no es narrador, `noPuede`). */
const conAsientos =
  (noPuede: string): Permiso =>
  ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return noPuede;
    return partida.plaza().length > 0 ? null : 'La plaza no tiene asientos.';
  };

const soloNarrador =
  (noPuede: string): Permiso =>
  (_juego, yo) =>
    yo.rol === 'narrador' ? null : noPuede;

/** Quién puede hacer cada cosa con el grimorio y, si no, por qué. */
const PERMISOS: Record<UsoGrimorio, Permiso> = {
  'grimorio:personaje': conAsientos('Solo un narrador puede cambiar las fichas.'),
  // Con el Gardener, mientras los personajes repartidos no se hayan entregado
  'grimorio:intercambiar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede intercambiar las fichas.';
    if (!partida.npcs.activo(NPC_GARDENER)) return 'Las fichas solo se intercambian con el Gardener en juego.';
    if (!partida.entregas.fichasRetenidas()) return 'Los personajes ya se han entregado: ya no se intercambian.';
    return partida.plaza().length > 1 ? null : 'Hacen falta dos asientos.';
  },
  'grimorio:alineamiento': conAsientos('Solo un narrador puede cambiar las fichas.'),
  'grimorio:vida': conAsientos('Solo un narrador puede matar o revivir.'),
  'grimorio:confirmarMuerte': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede anunciar una muerte.';
    return partida.plaza().some((a) => a.muertePendiente) ? null : 'No hay ninguna muerte por anunciar.';
  },
  'grimorio:voto': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador quita o devuelve votos.';
    return partida.plaza().some((a) => a.muerto) ? null : 'No hay ningún muerto.';
  },
  'grimorio:barquero': ({ partida }, yo) =>
    yo.rol === 'narrador' && partida.npcs.activo(NPC_FERRYMAN) ? null : 'Solo un narrador, con el Barquero en juego, devuelve los votos a los muertos.',
  'grimorio:recordatorio': conAsientos('Solo un narrador pone recordatorios.'),
  'grimorio:recordatorioTexto': conAsientos('Solo un narrador pone recordatorios.'),
  'grimorio:quitarRecordatorio': soloNarrador('Solo un narrador quita recordatorios.'),
  'grimorio:nota': conAsientos('Solo un narrador escribe notas.'),
  'grimorio:borrarNota': soloNarrador('Solo un narrador borra notas.'),
  'grimorio:enviar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador envía el grimorio.';
    return partida.plaza().some((a) => a.participanteId) ? null : 'No hay nadie sentado.';
  },
};

/**
 * Los casos de uso del grimorio del narrador: las fichas (personaje, alineamiento,
 * vida, voto), los recordatorios, las notas y enviarlo a un jugador. Las reglas
 * están en models/partida/Grimorio (y en la partida, enviarlo). Si cambia, avisa
 * para que la sala se mande a todos.
 */
export class GrimorioService {
  private readonly usos: UsosSala<UsoGrimorio>;

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

  /** Lo que puede hacer ahora con el grimorio (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_GRIMORIO);
  }

  /** Pone un personaje del guion en la ficha de un asiento, o se lo quita (null). */
  personaje(yoId: string, jugadorId: string, personajeId: string | null): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:personaje', () => this.grimorio().elegirPersonaje(jugadorId, personajeId));
  }

  /** Con el Gardener: intercambia el personaje y el alineamiento de dos fichas. */
  intercambiar(yoId: string, desde: string, hasta: string): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:intercambiar', () => this.grimorio().intercambiarFichas(desde, hasta));
  }

  alineamiento(yoId: string, jugadorId: string, alineamiento: Alineamiento): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:alineamiento', () => this.grimorio().elegirAlineamiento(jugadorId, alineamiento));
  }

  /** Mata o revive la ficha de un asiento (de noche, matar deja la muerte pendiente). */
  vida(yoId: string, jugadorId: string, muerto: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:vida', () => this.grimorio().elegirVida(jugadorId, muerto));
  }

  /** Hace efectiva la muerte pendiente de un asiento: ya la ven todos. */
  confirmarMuerte(yoId: string, jugadorId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:confirmarMuerte', () => this.grimorio().anunciarMuerte(jugadorId));
  }

  /** Quita o devuelve a mano el voto de un muerto. */
  voto(yoId: string, jugadorId: string, gastado: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:voto', () => this.grimorio().elegirVoto(jugadorId, gastado));
  }

  /** El Barquero: todos los muertos recuperan su voto. */
  barquero(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:barquero', () => this.grimorio().barquero());
  }

  /** Pone junto a una ficha uno de los recordatorios de un personaje del guion (cada uno, único). */
  recordatorio(yoId: string, jugadorId: string, personajeId: string, indice: number): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:recordatorio', () => this.grimorio().elegirRecordatorio(jugadorId, personajeId, indice));
  }

  /** Pone un recordatorio con texto propio (y, si quiere, un icono del guion). */
  recordatorioTexto(yoId: string, jugadorId: string, texto: string, icono: unknown): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:recordatorioTexto', () => this.grimorio().escribirRecordatorio(jugadorId, texto, icono));
  }

  quitarRecordatorio(yoId: string, jugadorId: string, recordatorioId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:quitarRecordatorio', () => {
      this.grimorio().quitarRecordatorio(jugadorId, recordatorioId);
      return null;
    });
  }

  /** Escribe la nota de un asiento (sustituye la que hubiera). */
  nota(yoId: string, jugadorId: string, texto: string): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:nota', () => this.grimorio().escribirNota(jugadorId, texto));
  }

  borrarNota(yoId: string, jugadorId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:borrarNota', () => {
      this.grimorio().escribirNota(jugadorId, null);
      return null;
    });
  }

  /** Envía un grimorio (el Espía, la Viuda) a quien se sienta en un asiento (ver Partida.enviarGrimorio). */
  enviar(yoId: string, jugadorId: string, fichas: readonly BorradorFicha[], faroles: readonly string[]): ResultadoUso {
    return this.usos.hacer(yoId, 'grimorio:enviar', () => this.juego.partida.enviarGrimorio(jugadorId, fichas, faroles));
  }

  private grimorio() {
    return this.juego.partida.grimorio;
  }
}
