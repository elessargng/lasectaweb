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
 * El Imp: mata al elegido (su «Dead» y la muerte pendiente), o a quien le llegue
 * (ver Objetivo): puede no llegarle a nadie, y con varios desenlaces decide el
 * narrador. Si se elige a sí mismo, muere y el narrador dice quién es el nuevo Imp.
 */
export class Imp extends EligeYMarca {
  constructor() {
    super('imp', 'Dead', { puedeElegirse: true });
  }

  protected marcar(ctx: ContextoNoche, jugador: Jugador, elegido: Jugador, avisos: AvisoHabilidad[]): Resultado {
    if (elegido.id === jugador.id) {
      return listo(OK, { ...sinEfectos(), recordatorios: [{ asiento: elegido.id, texto: this.recordatorio }], muere: elegido.id, nuevoImp: true }, avisos);
    }
    if (elegido.muerto) return listo(OK, sinEfectos(), avisos);
    const desenlaces = ctx.objetivo(elegido).recibe({ origen: 'demonio', personaje: this.personaje, efecto: 'matar' });
    if (desenlaces.length > 1) {
      const dto = desenlaces.map((d) => ({ muere: d.a?.id ?? null, ...(d.gasta ? { gasta: d.gasta } : {}) }));
      return revisar([{ envio: OK, registros: [] }], [...avisos, { tipo: 'desenlaces', jugador: elegido.id, desenlaces: dto }]);
    }
    const [{ a, gasta }] = desenlaces;
    const efectos: Efectos = {
      ...sinEfectos(),
      recordatorios: [...(a ? [{ asiento: a.id, texto: this.recordatorio }] : []), ...(gasta ? [gasta] : [])],
      muere: a?.id ?? null,
    };
    return listo(OK, efectos, a ? avisos : [...avisos, { tipo: 'protegido', jugador: elegido.id }]);
  }
}
export const imp = new Imp();
