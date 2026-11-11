import { ModeloVitsRepository } from './ModeloVitsRepository';
import { MotorEnSegundoPlano } from './MotorEnSegundoPlano';
import { ReproductorAudio } from './ReproductorAudio';
import { VozNarradorService } from './VozNarradorService';
import { VozNavegador } from './VozNavegador';
import { VozNeuronal } from './VozNeuronal';

export type { EstadoVozNeuronal } from './VozNarradorService';
export { VozNarradorService } from './VozNarradorService';

/** Monta la voz del narrador con sus piezas de verdad (el único sitio que conoce las clases concretas). */
export function crearVozNarrador(): VozNarradorService {
  const navegador = new VozNavegador();
  // El motor, en un worker: calcular el audio no traba la página
  const modelo = new ModeloVitsRepository((cargar) => new MotorEnSegundoPlano(cargar));
  return new VozNarradorService(navegador, new VozNeuronal(modelo, new ReproductorAudio(), navegador), modelo);
}
