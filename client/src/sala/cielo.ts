/**
 * Cómo se ve el cielo estrellado de la noche (CieloEstrellado), que elige cada
 * uno para sí (Preferencias > Interfaz): sus colores, y los ajustes que se pasan
 * al Galaxy de React Bits. Con los valores iniciales, el cielo de siempre.
 */
import type { GalaxyProps } from '../components/Galaxy';
import type { PreferenciasSala } from './preferencias';

/** Los colores de las estrellas (hasta cuatro; un color repetido sale más), en el orden de las preferencias. */
export const COLORES_CIELO = [
  {
    id: 'natural',
    nombre: 'Natural',
    descripcion: 'Blancas casi todas; alguna azulada y alguna dorada.',
    colores: ['#ffffff', '#ffffff', '#c8dcff', '#ffd6a0'],
  },
  { id: 'blanco', nombre: 'Blanco', descripcion: 'Todas blancas.', colores: ['#ffffff'] },
  {
    id: 'helado',
    nombre: 'Helado',
    descripcion: 'Azules y blancas, de invierno.',
    colores: ['#ffffff', '#c8dcff', '#8fb4ff', '#6fd6ff'],
  },
  {
    id: 'laton',
    nombre: 'Latón',
    descripcion: 'Doradas, como los adornos de la sala.',
    colores: ['#fff1cf', '#d4af6a', '#ffd6a0', '#e8c07a'],
  },
  {
    id: 'sangre',
    nombre: 'Sangre',
    descripcion: 'Rojas, para cuando acecha el demonio.',
    colores: ['#ffd0c8', '#ff6b5a', '#d9362b', '#ff9a7a'],
  },
  {
    id: 'embrujado',
    nombre: 'Embrujado',
    descripcion: 'Violetas y verdes, de aquelarre.',
    colores: ['#e3c8ff', '#b07cff', '#8affc1', '#ffffff'],
  },
] as const;

export type ColoresCielo = (typeof COLORES_CIELO)[number]['id'];
export const COLORES_CIELO_DEFECTO: ColoresCielo = 'natural';
export const esColoresCielo = (v: unknown): v is ColoresCielo => COLORES_CIELO.some((c) => c.id === v);

/** Lo que se elige del cielo (ver preferencias.ts); los numéricos, en % del cielo de siempre. */
export type AjustesCielo = Pick<
  PreferenciasSala,
  'coloresCielo' | 'velocidadCielo' | 'densidadCielo' | 'brilloCielo' | 'parpadeoCielo'
>;

/**
 * Los ajustes del Galaxy para un cielo así. Con velocidad 0, quietas: ni giran ni
 * parpadean. Se elija lo que se elija, no responde al ratón ni a los clics.
 */
export function propsGalaxy(ajustes: AjustesCielo): GalaxyProps {
  const ritmo = ajustes.velocidadCielo / 100;
  return {
    transparent: true,
    mouseInteraction: false,
    mouseRepulsion: false,
    clickWarp: false,
    intro: false,
    starColors: [...(COLORES_CIELO.find((c) => c.id === ajustes.coloresCielo) ?? COLORES_CIELO[0]).colores],
    density: ajustes.densidadCielo / 100,
    starSpeed: 0.15 * ritmo,
    speed: 0.6,
    rotationSpeed: 0.015 * ritmo,
    disableAnimation: ritmo === 0,
    glowIntensity: 0.3 * (ajustes.brilloCielo / 100),
    twinkleIntensity: ajustes.parpadeoCielo / 100,
  };
}
