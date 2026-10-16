import { createContext, useContext } from 'react';

/**
 * Cómo ve cada uno la calavera de las nominaciones y las manos levantadas
 * (Preferencias > Interfaz). Solo cambia el dibujo: lo que se lee es lo mismo.
 */
export const ESTILOS_CALAVERA = [
  { id: 'clasica', nombre: 'Clásica', descripcion: 'Hueso con contorno de tinta' },
  { id: 'lacre', nombre: 'Sello de lacre', descripcion: 'Estampada en cera roja' },
  { id: 'laton', nombre: 'Latón', descripcion: 'Dorada, con grietas y dientes' },
  { id: 'hueso', nombre: 'Hueso tallado', descripcion: 'Redonda y sencilla' },
] as const;
export type EstiloCalavera = (typeof ESTILOS_CALAVERA)[number]['id'];

export const ESTILOS_MANO = [
  { id: 'laton', nombre: 'Latón', descripcion: 'Dorada, como las agujas del reloj' },
  { id: 'recordatorio', nombre: 'Ficha recordatorio', descripcion: 'En tinta sobre una ficha pequeña' },
  { id: 'medallon', nombre: 'Medallón', descripcion: 'En pergamino sobre el morado del grimorio' },
  { id: 'lacre', nombre: 'Lacre', descripcion: 'Sobre un sello de cera roja' },
] as const;
export type EstiloMano = (typeof ESTILOS_MANO)[number]['id'];

export const CALAVERA_DEFECTO: EstiloCalavera = 'clasica';
export const MANO_DEFECTO: EstiloMano = 'laton';

export const esEstiloCalavera = (v: unknown): v is EstiloCalavera => ESTILOS_CALAVERA.some((e) => e.id === v);
export const esEstiloMano = (v: unknown): v is EstiloMano => ESTILOS_MANO.some((e) => e.id === v);

export const MarcasContexto = createContext<{ calavera: EstiloCalavera; mano: EstiloMano }>({
  calavera: CALAVERA_DEFECTO,
  mano: MANO_DEFECTO,
});

export const useMarcas = () => useContext(MarcasContexto);
