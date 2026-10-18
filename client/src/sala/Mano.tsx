import { useId } from 'react';
import { urlDelServidor } from '../utils/api';
import { useFichas } from './fichas';
import { useMarcas, type EstiloMano } from './marcas';
import {
  MANO_CUERNOS,
  MANO_LAGARTO,
  MANO_PALMA,
  MANO_PAZ,
  MANO_PEINETA,
  MANO_PERRITO,
  MANO_PUNO,
  MANO_SPOCK,
  MANO_TIJERA,
  type TrazoCaja,
} from './trazos';
import type { FormaMano } from './useSala';

const EN_256 = (d: string): TrazoCaja => ({ d, ancho: 256, alto: 256 });

/** Las formas de la mano (ver FORMAS_MANO), cada una con su caja. */
const FORMAS: Record<string, TrazoCaja> = {
  palma: EN_256(MANO_PALMA),
  tijera: EN_256(MANO_TIJERA),
  puno: EN_256(MANO_PUNO),
  peineta: MANO_PEINETA,
  paz: MANO_PAZ,
  cuernos: MANO_CUERNOS,
  lagarto: MANO_LAGARTO,
  spock: MANO_SPOCK,
  perrito: MANO_PERRITO,
};

/** Lleva el trazo de su caja a la de 256 × 256, centrado: la escala y cómo colocarlo. */
function encajar({ ancho, alto }: TrazoCaja) {
  const escala = 256 / Math.max(ancho, alto);
  return { escala, transform: `translate(${(256 - ancho * escala) / 2} ${(256 - alto * escala) / 2}) scale(${escala})` };
}

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
  const { todosPorId } = useFichas();
  // Un personaje del guion: su icono en lugar de la mano (si no se conoce, la palma)
  const icono = FORMAS[forma] ? null : todosPorId.get(forma)?.icono;
  const caja = FORMAS[forma] ?? FORMAS.palma;
  const { escala, transform } = encajar(caja);
  // El grosor del contorno, el mismo en todas (está en unidades de 256 × 256)
  const trazo = <path d={caja.d} transform={transform} />;

  if (icono) {
    const imagen = <image href={urlDelServidor(icono)} x="0" y="0" width="256" height="256" preserveAspectRatio="xMidYMid meet" />;
    if (elegido === 'laton') {
      return (
        <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
          {imagen}
        </svg>
      );
    }
    const { aro } = FONDOS[elegido];
    return (
      <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
        <circle cx="128" cy="128" r="120" fill="#1d1638" />
        <circle cx="128" cy="128" r="121" fill="none" stroke={aro} strokeWidth="8" />
        <circle cx="128" cy="128" r="126" fill="none" stroke="#0b0914" strokeWidth="3" opacity=".8" />
        <g transform="translate(28 28) scale(.78)">{imagen}</g>
      </svg>
    );
  }

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
        <g fill={`url(#${id}-oro)`} stroke="#1a1206" strokeWidth={16 / escala} strokeLinejoin="round" paintOrder="stroke">
          {trazo}
        </g>
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
      <g fill={mano} transform="translate(42 36) scale(.67)">
        {trazo}
      </g>
    </svg>
  );
};

export default Mano;
