/**
 * Los despertares tal como se envían.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { AvisoHabilidad, EstadoHabilidad, MensajeDespertar, OpcionDespertar } from '../../models/compartido/despertar';

/**
 * El despertar guiado de una fila del orden de noche (solo con el guion Trouble
 * Brewing, de momento): el personaje despierta según su habilidad. Si elige, solo
 * puede elegir lo que ella le deja y el recordatorio se pone solo; si recibe
 * información, se calcula y se manda sola. Uno por personaje con habilidad y ficha en la plaza,
 * y los de la primera noche para los esbirros y el demonio ('esbirros' y 'demonios').
 */
export interface HabilidadNocheDto {
  /** El personaje, o 'esbirros' / 'demonios'. */
  personaje: string;
  /** El jugador que despierta (el de la ficha); con 'esbirros' o 'demonios', el primero. */
  jugador: string;
  /** Todos los que despiertan: el de la ficha o, con 'esbirros' y 'demonios', cada uno. */
  jugadores: string[];
  estado: EstadoHabilidad;
  avisos: AvisoHabilidad[];
  /** Lo que se propone mandar (revisar: una o varias, la primera es la de verdad). */
  opciones: OpcionDespertar[];
}

/**
 * Un despertar: lo que se dicen el narrador y un jugador (aunque no lo juegue
 * nadie). Se abre de noche y dura hasta limpiar el grimorio; se pueden tener
 * varios a la vez, uno por jugador. Cerrar su ventana es cosa de cada uno (en su
 * navegador): el despertar sigue. Solo lo reciben los narradores y quien juega a
 * ese jugador.
 */
export interface DespertarDto {
  jugador: string;
  mensajes: MensajeDespertar[];
}
