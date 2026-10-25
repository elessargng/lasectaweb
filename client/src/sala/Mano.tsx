import { useId } from 'react';
import { urlDelServidor } from '../utils/api';
import { useFichas } from './fichas';
import { emojiDeMano } from './formasMano';
import { useMarcas, type EstiloMano } from './marcas';
import {
  MANO_CUERNOS,
  MANO_LAGARTO,
  MANO_PALMA,
  MANO_PAZ,
  MANO_PEINETA,
  MANO_PUNO,
  MANO_SENALAR,
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
  // El dedo levantado; también es la mano que señala (ver ManosSenalamiento)
  senalar: EN_256(MANO_SENALAR),
};

/** Lleva el trazo de su caja a la de 256 × 256, centrado: la escala y cómo colocarlo. */
function encajar({ ancho, alto }: TrazoCaja) {
  const escala = 256 / Math.max(ancho, alto);
  return { escala, transform: `translate(${(256 - ancho * escala) / 2} ${(256 - alto * escala) / 2}) scale(${escala})` };
}

/**
 * Los estilos con dibujo propio (Preferencias > Interfaz), un dibujo por gesto en
 * public/manos/<estilo>/<forma>: la dibujada (la de por defecto), la de cinco dedos (Microsoft Fluent Emoji, en 3D;
 * licencia MIT), el guante blanco de los dibujos animados, la mano esquelética y
 * el guantelete dorado de las seis gemas (estos tres, de client/scripts/generar-manos.cjs).
 */
const DIBUJO_DE: Partial<Record<EstiloMano, (forma: string) => string>> = {
  defecto: (forma) => `/manos/defecto/${forma}.webp`,
  cinco: (forma) => `/manos/cinco/${forma}.png`,
  guante: (forma) => `/manos/guante/${forma}.svg`,
  esqueleto: (forma) => `/manos/esqueleto/${forma}.svg`,
  guantelete: (forma) => `/manos/guantelete/${forma}.svg`,
};

/**
 * Una mano levantada, en el estilo que haya elegido cada uno (Preferencias >
 * Interfaz) o en el que se le pase: dibujada, amarilla (como las de los Simpson), de cinco
 * dedos, el guante o esquelética, cada gesto con su dibujo. Un personaje o un
 * emoticono se ven igual en todos. Solo
 * visual: quien la usa dice para el lector de quién es y qué forma tiene.
 */
const Mano = ({ forma, estilo, className = '' }: { forma: FormaMano; estilo?: EstiloMano; className?: string }) => {
  const preferido = useMarcas().mano;
  const elegido = estilo ?? preferido;
  const id = useId();
  const { todosPorId } = useFichas();
  // Un personaje del guion: su icono en lugar de la mano (si no se conoce, la palma)
  const icono = FORMAS[forma] ? null : todosPorId.get(forma)?.icono;
  // Un emoticono: el emoji del sistema, del tamaño de la mano
  const emoji = emojiDeMano(forma);
  if (icono || emoji) {
    return (
      <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
        {emoji ? (
          <text x="128" y="134" textAnchor="middle" dominantBaseline="central" fontSize="200">
            {emoji}
          </text>
        ) : (
          <image href={urlDelServidor(icono!)} x="0" y="0" width="256" height="256" preserveAspectRatio="xMidYMid meet" />
        )}
      </svg>
    );
  }

  // Los estilos con dibujo propio: el de ese gesto (una forma que ya no existe, la palma)
  const dibujo = DIBUJO_DE[elegido]?.(FORMAS[forma] ? forma : 'palma');
  if (dibujo) {
    return (
      <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
        <image href={dibujo} x="0" y="0" width="256" height="256" preserveAspectRatio="xMidYMid meet" />
      </svg>
    );
  }

  // Las demás: su trazo, en amarillo con un contorno de tinta (el grosor, el mismo en todas)
  const caja = FORMAS[forma] ?? FORMAS.palma;
  const { escala, transform } = encajar(caja);
  return (
    <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={`${id}-amarillo`} x1="0" y1="0" x2=".2" y2="1">
          <stop offset="0" stopColor="#fff6a8" />
          <stop offset=".45" stopColor="#ffd90f" />
          <stop offset="1" stopColor="#d39e00" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-amarillo)`} stroke="#1a1206" strokeWidth={16 / escala} strokeLinejoin="round" paintOrder="stroke">
        <path d={caja.d} transform={transform} />
      </g>
    </svg>
  );
};

export default Mano;
