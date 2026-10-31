import type { AvisoHabilidad } from '../compartido/despertar';
import {
  EligeYMarca,
  listo,
  OK,
  revisar,
  sinEfectos,
  type ContextoNoche,
  type Efectos,
  type Resultado,
} from '../partida/habilidades/HabilidadNocturna';
import type { Jugador } from '../partida/Jugador';

/**
 * El Imp: el elegido muere (su «Dead» y la muerte pendiente), salvo que se salve
 * (ver AnteElDemonio); si puede rebotar a otro, lo decide el narrador. Si se elige
 * a sí mismo, muere y el narrador dice quién es el nuevo Imp.
 */
export class Imp extends EligeYMarca {
  constructor() {
    super('imp', 'Dead', { puedeElegirse: true });
  }

  protected marcar(ctx: ContextoNoche, jugador: Jugador, elegido: Jugador, avisos: AvisoHabilidad[]): Resultado {
    const muere: Efectos = { ...sinEfectos(), recordatorios: [{ asiento: elegido.id, texto: this.recordatorio }], muere: elegido.id };
    if (elegido.id === jugador.id) return listo(OK, { ...muere, nuevoImp: true }, avisos);
    if (elegido.muerto) return listo(OK, sinEfectos(), avisos);
    const desenlace = ctx.anteElDemonio(elegido).atacado({ demonio: this.personaje, efecto: 'matar' });
    if (desenlace[0] === 'seSalva') return listo(OK, sinEfectos(), [...avisos, { tipo: 'protegido', jugador: elegido.id }]);
    if (desenlace.includes('rebota')) return revisar([{ envio: OK, registros: [] }], [...avisos, { tipo: 'alcalde', jugador: elegido.id }]);
    return listo(OK, muere, avisos);
  }
}
export const imp = new Imp();
