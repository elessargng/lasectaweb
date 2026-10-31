/**
 * La calavera y el grimorio que el narrador envía al Espía o a la Viuda.
 * Lo que se envía al cliente (alias @views): solo tipos, sin Node ni servicios.
 */
import type { Recordatorio } from '../../models/compartido/grimorio';
import type { Alineamiento } from '../../models/compartido/jugador';

/**
 * Una ficha del grimorio que el narrador envía al Espía o a la Viuda: lo que se
 * ve de ella (el narrador puede cambiarlo antes de enviarlo).
 */
export interface FichaEnviadaDto {
  jugadorId: string;
  personaje: string | null;
  alineamiento: Alineamiento | null;
  muerto: boolean;
  recordatorios: Recordatorio[];
}

/**
 * Un grimorio enviado (el último) a un jugador: cuándo, sus fichas (en el orden de
 * la plaza) y los faroles del demonio (ids de personaje, hasta NUM_FAROLES).
 */
export interface GrimorioEnviadoDto {
  hora: number;
  fichas: FichaEnviadaDto[];
  faroles: string[];
}

/**
 * La calavera: el único jugador marcado para ser ejecutado y con cuántos votos se
 * le puso (desde una nominación ya votada), o null si se puso a mano.
 */
export interface CalaveraDto {
  jugadorId: string;
  votos: number | null;
}
