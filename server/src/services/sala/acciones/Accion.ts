import type { Participante } from '../../../models/sala/Participantes';
import type { SalaDeJuego } from '../../../models/SalaDeJuego';
import type { RespuestaAccion } from '../../../models/narradorVirtual/puertos';
import type { DependenciasAcciones } from '../puertos';

/** Lo que devuelve una acción: el resultado y, si saca a alguien de la sala, qué conexiones cerrar. */
export type SalaEfecto = RespuestaAccion & { expulsar?: string[] };

/** Una acción de la sala (ver index.ts). */
export interface Accion {
  /** Si quien la pide puede hacerla ahora. Es la única comprobación de permisos. */
  puede: (juego: SalaDeJuego, yo: Participante) => boolean;
  /** Mensaje cuando no puede. */
  noPuede: string | ((juego: SalaDeJuego, yo: Participante) => string);
  /** La ejecuta; solo valida los datos que recibe, no los permisos. */
  hacer: (juego: SalaDeJuego, yo: Participante, datos: unknown, deps: DependenciasAcciones) => SalaEfecto | Promise<SalaEfecto>;
}

export const cualquiera = () => true;

export const esNarrador = (_juego: SalaDeJuego, yo: Participante) => yo.rol === 'narrador';

/**
 * Un dato de texto tal cual o, si no lo es, vacío: el dominio lo rechaza como a
 * cualquier id que no existe, con su mensaje.
 */
export const cadena = (valor: unknown): string => (typeof valor === 'string' ? valor : '');
