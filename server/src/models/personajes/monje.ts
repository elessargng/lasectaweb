import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';
import { aSalvo } from './AnteElDemonio';
import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';

/**
 * Monje (Monk): quien lleva su «Safe» está a salvo de cualquier demonio y de todo
 * lo que haga. Si el Monje estaba droison al elegir, no se le pone.
 */
export const monje: ReglaPersonaje = {
  personaje: 'monk',
  alterarAnteElDemonio: (_ctx, jugador, base) => (tieneRecordatorio(jugador, 'monk', /^safe$/i) ? aSalvo() : base),
};

/** De noche, protege a otro del demonio (su «Safe»). */
export const monjeDeNoche = new EligeYMarca('monk', 'Safe', { puedeElegirse: false, tramo: 'alteraAlDemonio' });
