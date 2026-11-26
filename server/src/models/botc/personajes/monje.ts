import { EligeYMarca } from '../partida/habilidades/HabilidadNocturna';
import { A_NADIE } from './Objetivo';
import { tieneRecordatorio, type ReglaPersonaje } from './ReglaPersonaje';
import type { DefinicionPersonaje } from './DefinicionPersonaje';

/**
 * Monje (Monk): quien lleva su «Safe» está a salvo de cualquier demonio y de todo
 * lo que haga. Si el Monje estaba droison al elegir, no se le pone.
 */
const regla: ReglaPersonaje = {
  personaje: 'monk',
  alterarObjetivo: (_ctx, jugador, base) =>
    tieneRecordatorio(jugador, 'monk', /^safe$/i) ? { recibe: (accion) => (accion.origen === 'demonio' ? A_NADIE : base.recibe(accion)) } : base,
};

/** De noche, protege a otro del demonio (su «Safe»). */
const deNoche = new EligeYMarca('monk', 'Safe', { puedeElegirse: false, tramo: 'alteraAlDemonio' });

export const monje: DefinicionPersonaje = { regla, deNoche };
