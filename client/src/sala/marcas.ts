import { createContext, useContext } from 'react';

/**
 * Cómo ve cada uno la calavera de las nominaciones, las manos levantadas, las
 * sillas de los asientos libres y el voto de los muertos (Preferencias > Interfaz). Solo cambia el dibujo:
 * lo que se lee es lo mismo.
 * «Al azar» elige uno distinto en cada partida (ver estiloDePartida).
 */
export const ESTILOS_CALAVERA = [
  { id: 'defecto', nombre: 'Dibujada', descripcion: 'Una calavera de verdad, a tinta y color' },
  { id: 'punisher', nombre: 'Punisher', descripcion: 'Ojos rasgados y dientes largos' },
  { id: 'terminator', nombre: 'Terminator', descripcion: 'De metal, con los ojos rojos' },
  { id: 'clasica', nombre: 'Clásica', descripcion: 'Hueso con contorno de tinta' },
  { id: 'lacre', nombre: 'Sello de lacre', descripcion: 'Estampada en cera roja' },
  { id: 'laton', nombre: 'Latón', descripcion: 'Dorada, con grietas y dientes' },
  { id: 'hueso', nombre: 'Hueso tallado', descripcion: 'Redonda y sencilla' },
  { id: 'azar', nombre: 'Al azar', descripcion: 'Una distinta en cada partida' },
] as const;
/** Lo que se elige en las preferencias (también «al azar»). */
export type PreferenciaCalavera = (typeof ESTILOS_CALAVERA)[number]['id'];
/** El dibujo que se pinta (uno de verdad). */
export type EstiloCalavera = Exclude<PreferenciaCalavera, 'azar'>;

export const ESTILOS_MANO = [
  { id: 'defecto', nombre: 'Dibujada', descripcion: 'Una mano de verdad, a tinta y color' },
  // (El id «laton» se queda: es el de antes, ahora en amarillo; los que se quitaron vuelven a este)
  { id: 'laton', nombre: 'Amarilla', descripcion: 'Como las de los Simpson' },
  { id: 'cinco', nombre: 'Cinco dedos', descripcion: 'Una mano abierta de verdad, en 3D' },
  { id: 'guante', nombre: 'Guante', descripcion: 'El guante blanco de los dibujos animados' },
  { id: 'esqueleto', nombre: 'Esquelética', descripcion: 'Hueso a hueso' },
  { id: 'guantelete', nombre: 'Guantelete', descripcion: 'Dorado, con sus seis gemas' },
  { id: 'azar', nombre: 'Al azar', descripcion: 'Una distinta en cada partida' },
] as const;
export type PreferenciaMano = (typeof ESTILOS_MANO)[number]['id'];
export type EstiloMano = Exclude<PreferenciaMano, 'azar'>;

/**
 * Las sillas de los asientos libres: la de botc.app (public/sillas) o una de las
 * propias (public/sillas/<id>), cada una en sus cinco ángulos (ver Asiento).
 */
export const ESTILOS_SILLA = [
  { id: 'comedor', nombre: 'Silla de comedor', descripcion: 'Respaldo de damasco, entre candelabros' },
  { id: 'clasica', nombre: 'Clásica', descripcion: 'La silla tapizada de siempre' },
  { id: 'tronos', nombre: 'Trono de espadas', descripcion: 'Forjado con espadas, en un nicho de piedra' },
  { id: 'azar', nombre: 'Al azar', descripcion: 'Una distinta en cada partida' },
] as const;
export type PreferenciaSilla = (typeof ESTILOS_SILLA)[number]['id'];
export type EstiloSilla = Exclude<PreferenciaSilla, 'azar'>;

/**
 * Cómo se ve si a un muerto le queda su voto: su vela negra (encendida o
 * apagada) o, sobre el sudario, un círculo azul cuando lo ha perdido. Sin
 * «al azar»: es información de la partida y tiene que leerse siempre igual.
 */
export const ESTILOS_VOTO = [
  { id: 'vela', nombre: 'Vela', descripcion: 'Negra: encendida con voto, apagada sin él' },
  { id: 'sudario', nombre: 'Sudario', descripcion: 'Un círculo azul en el sudario al perder el voto' },
] as const;
export type EstiloVoto = (typeof ESTILOS_VOTO)[number]['id'];

/** La carpeta de las imágenes de una silla (con su barra final), en public/. */
export const carpetaSilla = (silla: EstiloSilla) => (silla === 'clasica' ? '/sillas/' : `/sillas/${silla}/`);

export const CALAVERA_DEFECTO: PreferenciaCalavera = 'defecto';
export const MANO_DEFECTO: PreferenciaMano = 'defecto';
export const SILLA_DEFECTO: PreferenciaSilla = 'comedor';
export const VOTO_DEFECTO: EstiloVoto = 'vela';

export const esEstiloCalavera = (v: unknown): v is PreferenciaCalavera => ESTILOS_CALAVERA.some((e) => e.id === v);
export const esEstiloMano = (v: unknown): v is PreferenciaMano => ESTILOS_MANO.some((e) => e.id === v);
export const esEstiloSilla = (v: unknown): v is PreferenciaSilla => ESTILOS_SILLA.some((e) => e.id === v);
export const esEstiloVoto = (v: unknown): v is EstiloVoto => ESTILOS_VOTO.some((e) => e.id === v);

/**
 * El estilo que se pinta en esta partida: el elegido o, «al azar», uno de los
 * demás según `semilla` (quien mira y el número de partida): el mismo durante
 * toda la partida, también al recargar, y otro (probablemente) en la siguiente.
 */
export function estiloDePartida<T extends string>(
  preferencia: T | 'azar',
  estilos: readonly { id: T | 'azar' }[],
  semilla: string,
): T {
  if (preferencia !== 'azar') return preferencia;
  const concretos = estilos.map((e) => e.id).filter((id): id is T => id !== 'azar');
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return concretos[h % concretos.length];
}

export const MarcasContexto = createContext<{ calavera: EstiloCalavera; mano: EstiloMano; silla: EstiloSilla; voto: EstiloVoto }>({
  calavera: 'defecto',
  mano: 'defecto',
  silla: 'comedor',
  voto: 'vela',
});

export const useMarcas = () => useContext(MarcasContexto);
