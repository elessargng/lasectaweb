/**
 * Cada participante tal como se envía.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { EstadoAccesoGrimorio, FormaMano, Persona, Rol } from '../../models/compartido/participante';

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
