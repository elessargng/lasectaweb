import type { PersonajeMostrado } from './guiones';

/**
 * Llenar la bolsa al azar: la lógica está en el contrato (la comparte el narrador
 * virtual del servidor); aquí, con los personajes como los muestra la sala.
 */
export { llenarAlAzar } from '@contrato/bolsaAleatoria';
export type BolsaAlAzar = import('@contrato/bolsaAleatoria').BolsaAlAzar<PersonajeMostrado>;
