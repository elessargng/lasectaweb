import { useId } from 'react';
import { useMarcas, type EstiloMano } from './marcas';
import { MANO_PALMA, MANO_PUNO, MANO_TIJERA } from './trazos';
import type { FormaMano } from './useSala';

/** Las formas de la mano que puede levantar un jugador (como en piedra, papel o tijera). */
const FORMAS: Record<FormaMano, string> = { palma: MANO_PALMA, puno: MANO_PUNO, tijera: MANO_TIJERA };

/** Fondo de las manos que van sobre una ficha pequeña (recordatorio, medallón, lacre). */
const FONDOS: Record<Exclude<EstiloMano, 'laton'>, { mano: string; aro: string }> = {
  recordatorio: { mano: '#3a2414', aro: '#9c7536' },
  medallon: { mano: '#ebe2cc', aro: '#d4af6a' },
  lacre: { mano: '#f3d9c0', aro: '#5e0f16' },
};

/**
 * Una mano levantada, en el estilo que haya elegido cada uno (Preferencias >
 * Interfaz) o en el que se le pase: de latón, o sobre una ficha pequeña. Solo
 * visual: quien la usa dice para el lector de quién es y qué forma tiene.
 */
const Mano = ({ forma, estilo, className = '' }: { forma: FormaMano; estilo?: EstiloMano; className?: string }) => {
  const preferido = useMarcas().mano;
  const elegido = estilo ?? preferido;
  const id = useId();
  const trazo = FORMAS[forma];

  if (elegido === 'laton') {
    return (
      <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
        <defs>
          <linearGradient id={`${id}-oro`} x1="0" y1="0" x2=".2" y2="1">
            <stop offset="0" stopColor="#f8e9c2" />
            <stop offset=".45" stopColor="#d4af6a" />
            <stop offset="1" stopColor="#8a6428" />
          </linearGradient>
        </defs>
        <path d={trazo} fill={`url(#${id}-oro)`} stroke="#1a1206" strokeWidth="16" strokeLinejoin="round" paintOrder="stroke" />
      </svg>
    );
  }

  const { mano, aro } = FONDOS[elegido];
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <clipPath id={`${id}-circulo`}>
          <circle cx="128" cy="128" r="120" />
        </clipPath>
        {elegido === 'medallon' && (
          <radialGradient id={`${id}-fondo`} cx=".5" cy=".35" r=".75">
            <stop offset="0" stopColor="#4b3c86" />
            <stop offset="1" stopColor="#1d1638" />
          </radialGradient>
        )}
        {elegido === 'lacre' && (
          <radialGradient id={`${id}-fondo`} cx=".4" cy=".35" r=".75">
            <stop offset="0" stopColor="#c9343f" />
            <stop offset=".55" stopColor="#9e1b25" />
            <stop offset="1" stopColor="#5e0f16" />
          </radialGradient>
        )}
      </defs>
      {elegido === 'recordatorio' ? (
        // La textura de las fichas (la misma que las del grimorio)
        <image href="/ficha.webp" x="-14" y="-14" width="284" height="284" clipPath={`url(#${id}-circulo)`} />
      ) : (
        <circle cx="128" cy="128" r="120" fill={`url(#${id}-fondo)`} />
      )}
      <circle cx="128" cy="128" r="121" fill="none" stroke={aro} strokeWidth="8" />
      <circle cx="128" cy="128" r="126" fill="none" stroke="#0b0914" strokeWidth="3" opacity=".8" />
      <path d={trazo} fill={mano} transform="translate(42 36) scale(.67)" />
    </svg>
  );
};

export default Mano;
