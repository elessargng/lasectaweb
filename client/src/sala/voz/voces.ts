import type { VoiceId } from '@diffusionstudio/vits-web';

/** Una voz neuronal que se puede elegir: un modelo de Piper y, si tiene varios, cuál de sus hablantes. */
export interface VozPiper {
  id: string;
  /** El modelo en vits-web. */
  modelo: VoiceId;
  /** El hablante dentro del modelo (0 si solo tiene uno). */
  hablante: number;
  nombre: string;
  acento: 'España' | 'México';
  calidad: 'media' | 'alta';
  /** Lo que se descarga, en MB. */
  megas: number;
}

/** Las voces en español de calidad media o alta (las de menos suenan peor). */
export const VOCES_NEURONALES: readonly VozPiper[] = [
  { id: 'davefx', modelo: 'es_ES-davefx-medium', hablante: 0, nombre: 'Davefx', acento: 'España', calidad: 'media', megas: 63 },
  { id: 'sharvard-m', modelo: 'es_ES-sharvard-medium', hablante: 0, nombre: 'Sharvard, hombre', acento: 'España', calidad: 'media', megas: 77 },
  { id: 'sharvard-f', modelo: 'es_ES-sharvard-medium', hablante: 1, nombre: 'Sharvard, mujer', acento: 'España', calidad: 'media', megas: 77 },
  { id: 'ald', modelo: 'es_MX-ald-medium', hablante: 0, nombre: 'Ald', acento: 'México', calidad: 'media', megas: 63 },
  { id: 'claude', modelo: 'es_MX-claude-high', hablante: 0, nombre: 'Claude', acento: 'México', calidad: 'alta', megas: 63 },
];

export const VOZ_NEURONAL_DEFECTO = 'davefx';

export const esVozNeuronal = (v: unknown): v is string => VOCES_NEURONALES.some((voz) => voz.id === v);

/** La voz con ese id (si ya no existe, la de entrada). */
export const vozPiper = (id: string): VozPiper =>
  VOCES_NEURONALES.find((v) => v.id === id) ?? VOCES_NEURONALES.find((v) => v.id === VOZ_NEURONAL_DEFECTO)!;
