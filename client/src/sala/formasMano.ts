import type { FormaMano } from './useSala';

/** Las formas de mano, en el orden en que se ofrecen, con su nombre. */
export const FORMAS_MANO: { forma: FormaMano; nombre: string }[] = [
  { forma: 'palma', nombre: 'Palma' },
  { forma: 'puno', nombre: 'Puño' },
  { forma: 'tijera', nombre: 'Tijera' },
];

export const nombreMano = (forma: FormaMano) => FORMAS_MANO.find((f) => f.forma === forma)?.nombre ?? '';
