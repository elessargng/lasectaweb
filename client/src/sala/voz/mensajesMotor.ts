import type { ArchivosPiper } from './MotorPiper';

/** Lo que se le pide al worker de la voz; cada petición lleva su id para casar la respuesta. */
export type PeticionMotor =
  | { id: number; tipo: 'preparar'; archivos: ArchivosPiper }
  | { id: number; tipo: 'sintetizar'; texto: string };

/** Lo que contesta: el audio (WAV) de una frase, nada al preparar, o el error. */
export type RespuestaMotor = { id: number; audio?: ArrayBuffer } | { id: number; error: string };
