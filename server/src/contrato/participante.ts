/**
 * Quién está en la sala: su papel, quién es (persona) y lo que se envía de cada participante.
 * Parte del contrato de la sala de juego (ver sala.ts): solo tipos y valores puros.
 */
import type { IdNarradorVirtual } from './narradorVirtual';

/** Papel de cada participante en la sala de juego. Todo el que entra es visitante. */
export type Rol = 'narrador' | 'jugador' | 'visitante';

/** Forma de la mano que levanta un jugador (como en piedra, papel o tijera). */
/**
 * La forma de la mano: una de SALA_FORMAS_MANO o el id de un personaje del guion
 * (la mano es su icono).
 */
export type FormaMano = string;

/** Los estilos de mano (lo mismo en el cliente, ESTILOS_MANO de marcas.ts, sin «al azar»). */
export const SALA_ESTILOS_MANO = ['defecto', 'laton', 'cinco', 'guante', 'esqueleto', 'guantelete'];

/** Partidas jugadas (terminadas en la sala) por debajo de las que se es novato. */
export const SALA_PARTIDAS_NOVATO = 10;

export const SALA_FORMAS_MANO: FormaMano[] = [
  'palma', 'tijera', 'puno', 'peineta', 'paz', 'cuernos', 'lagarto', 'spock', 'senalar',
  // Emoticonos (el cliente sabe qué emoji es cada uno: formasMano.ts)
  ...['sonrisa', 'risa', 'guino', 'enamorado', 'beso', 'gafas', 'pensando', 'sospecha', 'silencio', 'susto',
    'llanto', 'enfado', 'diablo', 'angel', 'sueno', 'fiesta', 'labios', 'corazon', 'rosa', 'girasol',
    'ramo', 'pulgar-arriba', 'pulgar-abajo', 'aplausos', 'por-favor', 'palomitas', 'calavera', 'fantasma',
    'fuego', 'ojos'].map((e) => `emoji-${e}`),
];

/**
 * Quién es un participante, sea cual sea su papel en la sala: un usuario de la web
 * (entró con su cuenta), un invitado (sin cuenta) o un narrador virtual (no es una persona).
 */
export type Persona =
  | {
      tipo: 'usuario';
      /** Su id de usuario de la web (para enlazar a su perfil y para las estadísticas). */
      usuarioId: string;
      /** Ha jugado menos de SALA_PARTIDAS_NOVATO partidas (lleva el pulpito junto al nombre). */
      novato: boolean;
    }
  | { tipo: 'invitado' }
  | { tipo: 'virtual'; narrador: IdNarradorVirtual };

/** Su id de usuario de la web, si entró con su cuenta; si no, null. */
export const usuarioDe = (persona: Persona): string | null => (persona.tipo === 'usuario' ? persona.usuarioId : null);

export interface ParticipanteDto {
  /** Identificador dentro de la sala (no es el id de usuario de la web). */
  id: string;
  nombre: string;
  persona: Persona;
  /** Ruta del avatar que lleva (el de su cuenta, el elegido para la sala o el logo), o null. */
  avatar: string | null;
  rol: Rol;
  /** false mientras se espera a que vuelva tras perder la conexión. */
  conectado: boolean;
  /** Jugador con la mano levantada. Al dejar de ser jugador, vuelve a false. */
  manoLevantada: boolean;
  /**
   * Con la mano levantada, levanta las dos (la Banshee muerta con su «Has Ability»):
   * su voto cuenta doble. Siempre false con la mano bajada.
   */
  dosManos: boolean;
  /** La forma de su mano al levantarla; se conserva aunque la baje. */
  formaMano: FormaMano;
  /**
   * Cómo se ve su mano (su «skin»: ver SALA_ESTILOS_MANO). La elige cada uno y la ven
   * así todos; cada mano, con la de quien la levanta.
   */
  estiloMano: string;
  /** Ha quitado el sonido: no oye a los demás (los demás lo ven junto a su nombre). */
  sinSonido: boolean;
  /**
   * Un visitante puede pedir ver el grimorio del narrador: «solicitado» mientras
   * el narrador responde; «concedido», lo ve como él (todos los personajes) y ya
   * no lo pierde (tampoco si sale de la sala y vuelve) ni puede sentarse (lo ha
   * visto). Al cambiar de papel, al limpiar el grimorio (otra partida) o si un
   * narrador lo expulsa, vuelve a «ninguno».
   */
  accesoGrimorio: EstadoAccesoGrimorio;
}

export type EstadoAccesoGrimorio = 'ninguno' | 'solicitado' | 'concedido';
