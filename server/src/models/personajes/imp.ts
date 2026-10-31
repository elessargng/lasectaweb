import type { AvisoHabilidad } from '../compartido/despertar';
import { tieneRecordatorio } from './ReglaPersonaje';
import {
  droison,
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

/** Protegido del demonio esta noche: con el «Safe» del Monje o un Soldado sano. */
const protegido = (ctx: ContextoNoche, jugador: Jugador) =>
  tieneRecordatorio(jugador, 'monk', /^safe$/i) || (ctx.identidad(jugador) === 'soldier' && !droison(ctx, jugador));

/**
 * El Imp: el elegido muere (su «Dead» y la muerte pendiente), salvo que esté
 * protegido. Al Alcalde la muerte le puede rebotar: lo decide el narrador. Si se
 * elige a sí mismo, muere y el narrador dice quién es el nuevo Imp.
 */
export class Imp extends EligeYMarca {
  constructor() {
    super('imp', 'Dead', { puedeElegirse: true });
  }

  protected marcar(ctx: ContextoNoche, jugador: Jugador, elegido: Jugador, avisos: AvisoHabilidad[]): Resultado {
    const muere: Efectos = { ...sinEfectos(), recordatorios: [{ asiento: elegido.id, texto: this.recordatorio }], muere: elegido.id };
    if (elegido.id === jugador.id) return listo(OK, { ...muere, nuevoImp: true }, avisos);
    if (elegido.muerto) return listo(OK, sinEfectos(), avisos);
    if (protegido(ctx, elegido)) return listo(OK, sinEfectos(), [...avisos, { tipo: 'protegido', jugador: elegido.id }]);
    if (ctx.identidad(elegido) === 'mayor' && !droison(ctx, elegido)) {
      return revisar([{ envio: OK, registros: [] }], [...avisos, { tipo: 'alcalde', jugador: elegido.id }]);
    }
    return listo(OK, muere, avisos);
  }
}
export const imp = new Imp();
