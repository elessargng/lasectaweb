import type { PersonajeMostrado } from './guiones';

/**
 * Llenar la bolsa al azar: la lógica está en el dominio compartido, @models (la comparte el narrador
 * virtual del servidor); aquí, con los personajes como los muestra la sala.
 */
export { llenarAlAzar } from '@models/bolsaAleatoria';
export type BolsaAlAzar = import('@models/bolsaAleatoria').BolsaAlAzar<PersonajeMostrado>;
