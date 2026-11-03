import { MENSAJES_PRIVADOS, type MensajesPrivados } from '../compartido/chat';

/** Lo que tarda la aguja de ficha en ficha al votar, en segundos (de cuarto en cuarto). */
export const SALA_SEGUNDOS_POR_FICHA = { min: 0.25, max: 2, paso: 0.25, defecto: 1 };

/** Los ajustes de la partida que fija el narrador y valen para todos. */
export interface Ajustes {
  /** Cada jugador puede cambiar las fichas en su propio grimorio (si no, solo las ve). */
  grimorioJugadores: boolean;
  /** Lo que tarda la aguja en pasar de una ficha a la siguiente al votar, en segundos. */
  segundosPorFicha: number;
  /** Mensajes privados entre jugadores: ninguno, solo con los vecinos o con todos. */
  mensajes: MensajesPrivados;
  /** El fondo de la sala (una imagen subida o de la Biblioteca, o la del guion), o null: el de por defecto. */
  fondo: string | null;
  /** Las cámaras de quien conversa en privado no se ven en la plaza. */
  ocultarCamarasConversacion: boolean;
}

/** Los ajustes que puede cambiar el narrador (Preferencias > Partida); el fondo va aparte. */
export type CambiosAjustes = Partial<Omit<Ajustes, 'fondo'>>;

/**
 * Si esos cambios no valen, por qué: la velocidad de las agujas, de `paso` en `paso`
 * entre `min` y `max`, y los mensajes privados, uno de MENSAJES_PRIVADOS. Sin
 * ningún cambio, tampoco.
 */
export function cambiosNoValen(cambios: CambiosAjustes): string | null {
  if (Object.keys(cambios).length === 0) return 'Ajuste desconocido.';
  const { segundosPorFicha: segundos, mensajes } = cambios;
  if (segundos !== undefined) {
    const { min, max, paso } = SALA_SEGUNDOS_POR_FICHA;
    if (segundos < min || segundos > max || !Number.isInteger(segundos / paso)) {
      const es = (n: number) => n.toLocaleString('es');
      return `La velocidad de las agujas tiene que ser de ${es(min)} a ${es(max)} segundos, de ${es(paso)} en ${es(paso)}.`;
    }
  }
  if (mensajes !== undefined && !MENSAJES_PRIVADOS.includes(mensajes)) return 'Ajuste desconocido.';
  return null;
}

/** Los ajustes de la partida y si se puede conversar en privado. No comprueba permisos. */
export class Configuracion {
  private ajustes: Ajustes = {
    grimorioJugadores: false,
    segundosPorFicha: SALA_SEGUNDOS_POR_FICHA.defecto,
    // Por defecto, los privados entre jugadores solo con los vecinos
    mensajes: 'vecinos',
    fondo: null,
    ocultarCamarasConversacion: true,
  };
  private privadosAbiertos = true;

  /** Los ajustes (una copia). */
  actual(): Ajustes {
    return { ...this.ajustes };
  }

  cambiar(cambios: Partial<Ajustes>): void {
    this.ajustes = { ...this.ajustes, ...cambios };
  }

  /** Si se puede conversar en privado (el narrador virtual lo cierra fuera de los privados). */
  privadosPermitidos(): boolean {
    return this.privadosAbiertos;
  }

  /** Abre o cierra las conversaciones privadas. */
  permitirPrivados(abiertos: boolean): void {
    this.privadosAbiertos = abiertos;
  }
}
