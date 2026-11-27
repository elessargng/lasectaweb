/**
 * Cada participante tal como se envía.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { IdNarradorVirtual } from './narradorVirtual';

/** Papel de cada participante en la sala de juego. */
export type Rol = 'narrador' | 'jugador' | 'visitante';

/** La forma de la mano que levanta: una forma de la sala o el id de un personaje del guion. */
export type FormaMano = string;

/** Quién es: un usuario de la web, un invitado o un narrador virtual. */
export type Persona =
  | {
      tipo: 'usuario';
      /** Su id de usuario de la web. */
      usuarioId: string;
      /** Ha jugado pocas partidas (lleva el pulpito junto al nombre). */
      novato: boolean;
    }
  | { tipo: 'invitado' }
  | { tipo: 'virtual'; narrador: IdNarradorVirtual };

export type EstadoAccesoGrimorio = 'ninguno' | 'solicitado' | 'concedido';

export interface ParticipanteDto {
  /** Identificador dentro de la sala (no es el id de usuario de la web). */
  id: string;
  nombre: string;
  persona: Persona;
  /** Su id de usuario de la web, si entró con su cuenta; si no, null. */
  usuarioId: string | null;
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
