import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer de día (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_DIA = [
  'dia:darPalabra',
  'dia:nominar',
  'dia:cerrarNominacion',
  'dia:votosNecesarios',
  'dia:cuentaAtras',
  'dia:reiniciarVotacion',
  'dia:marcar',
  'dia:desmarcar',
  'dia:ejecutar',
] as const;
type UsoDia = (typeof USOS_DIA)[number];

const SIN_NOMINACION = 'No hay ninguna nominación abierta.';

/** Un narrador, con una nominación abierta. */
const conNominacion: Permiso = ({ partida }, yo) => (yo.rol === 'narrador' && partida.nominaciones.nominacion() ? null : SIN_NOMINACION);

/** Un narrador, con alguien que lleva la calavera (si no, `noPuede`). */
const conCalavera =
  (noPuede: string): Permiso =>
  ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return noPuede;
    return partida.grimorio.hayMarca() ? null : 'Nadie lleva la calavera.';
  };

/** Quién puede hacer cada cosa de día y, si no, por qué. */
const PERMISOS: Record<UsoDia, Permiso> = {
  'dia:darPalabra': (_juego, yo) => (yo.rol === 'narrador' ? null : 'Solo un narrador da la palabra.'),
  // Solo de día
  'dia:nominar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede abrir una nominación.';
    if (partida.fases.actual().momento !== 'dia') return 'Solo se nomina de día.';
    return partida.plaza().length >= 2 ? null : 'Hacen falta al menos dos asientos.';
  },
  'dia:cerrarNominacion': conNominacion,
  'dia:votosNecesarios': conNominacion,
  // Una vez arrancada no se puede volver a pulsar (para eso está reiniciarVotacion)
  'dia:cuentaAtras': ({ partida }, yo) => {
    const { nominaciones } = partida;
    if (nominaciones.hayVotacion()) return 'Esta nominación ya se ha votado.';
    if (nominaciones.votacionEnMarcha()) return 'La cuenta atrás ya está en marcha.';
    return yo.rol === 'narrador' && nominaciones.nominacion()?.cuentaAtrasFin === null ? null : SIN_NOMINACION;
  },
  'dia:reiniciarVotacion': ({ partida }, yo) =>
    yo.rol === 'narrador' && partida.nominaciones.votacionEnMarcha() ? null : 'No hay ninguna votación en marcha.',
  // De noche no se marca a nadie: la calavera es de las ejecuciones del día
  'dia:marcar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede marcar una ficha.';
    if (partida.fases.actual().momento === 'noche') return 'De noche no se marca a nadie.';
    return partida.plaza().length > 0 ? null : 'La plaza no tiene asientos.';
  },
  'dia:desmarcar': conCalavera('Solo un narrador puede desmarcar.'),
  'dia:ejecutar': conCalavera('Solo un narrador puede ejecutar.'),
};

/**
 * Los casos de uso del día: las nominaciones, la votación, la calavera y la
 * ejecución. Las reglas están en la partida (Partida.nominar, marcar, ejecutarConCalavera…)
 * y en models/partida/Nominaciones. Si cambia, avisa para que la sala se mande a todos.
 */
export class DiaService {
  private readonly usos: UsosSala<UsoDia>;

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

  /** Lo que puede hacer ahora de día (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_DIA);
  }

  /** En la nominación, da la palabra a un participante (los demás jugadores callan) o, con null, a todos. */
  darPalabra(yoId: string, participanteId: string | null): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:darPalabra', () => this.juego.partida.darPalabra(participanteId));
  }

  /**
   * La ficha de un asiento nomina a la de otro (o a sí misma). `comoAldeano`: si quien
   * nomina registra como aldeano (el Espía que nomina a la Virgen). Contesta (valor):
   * «comoAldeano» si hace falta saberlo y no viene (no se nomina: hay que volver a
   * pedirlo con la respuesta); con la Virgen, «ejecutado» o, si quedan dos vivos, «final».
   */
  nominar(yoId: string, desde: string, hasta: string, comoAldeano?: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:nominar', () => {
      const r = this.juego.partida.nominar(desde, hasta, comoAldeano === undefined ? {} : { comoAldeano });
      if (!r) return null;
      if ('error' in r) return r.error;
      if ('pregunta' in r) return { valor: r.pregunta };
      return { valor: r.final ? 'final' : 'ejecutado' };
    });
  }

  cerrarNominacion(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:cerrarNominacion', () => {
      this.juego.partida.nominaciones.cerrarNominacion();
      return null;
    });
  }

  /** Los votos que hacen falta en la nominación abierta (null: los de por defecto). */
  votosNecesarios(yoId: string, votos: number | null): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:votosNecesarios', () => this.juego.partida.nominaciones.elegirVotosNecesarios(votos));
  }

  /** Arranca la cuenta atrás de la nominación abierta; al acabar, empieza la votación. */
  cuentaAtras(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:cuentaAtras', () => {
      this.juego.partida.nominaciones.iniciarCuentaAtras(Date.now());
      return null;
    });
  }

  /** Para la cuenta atrás o la votación en marcha y deja la nominación como recién abierta. */
  reiniciarVotacion(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:reiniciarVotacion', () => {
      this.juego.partida.nominaciones.reiniciarVotacion();
      return null;
    });
  }

  /** Pone o quita la calavera a la ficha de un asiento; desde la nominación, además la cierra. */
  marcar(yoId: string, jugadorId: string, marcado: boolean, cerrarNominacion: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:marcar', () => this.juego.partida.marcar(jugadorId, marcado, cerrarNominacion));
  }

  /** Quita la calavera a quien la lleve y cierra la nominación. */
  desmarcar(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:desmarcar', () => {
      this.juego.partida.desmarcar();
      return null;
    });
  }

  /**
   * Ejecuta al que lleva la calavera (ver Partida.ejecutar). Si quedan dos vivos, no
   * anochece: contesta «final» (el narrador elige entre la noche y revelar el grimorio).
   */
  ejecutar(yoId: string, jugadorId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'dia:ejecutar', () => {
      const r = this.juego.partida.ejecutarConCalavera(jugadorId);
      if ('error' in r) return r.error;
      return r.final ? { valor: 'final' } : null;
    });
  }
}
