import { RecibeInformacion, sinEfectos } from '../partida/habilidades/HabilidadNocturna';

/** El Espía: ve el grimorio. */
class Espia extends RecibeInformacion {
  constructor() {
    super('spy');
    this.tramo = 'veTodo';
  }

  protected informacion() {
    return { opciones: [], efectos: { ...sinEfectos(), grimorio: true } };
  }
}
export const espia = new Espia();
