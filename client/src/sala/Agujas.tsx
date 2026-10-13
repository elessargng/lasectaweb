import { useId, type CSSProperties } from 'react';

interface AgujasProps {
  /** Número de asientos de la mesa. */
  total: number;
  /** Asiento (desde 0) de quien nomina: aguja corta, de hierro. */
  desde: number;
  /** Asiento (desde 0) del nominado: aguja larga, de latón con un rubí. */
  hasta: number;
  /**
   * Fichas que ha avanzado la aguja larga al votar (en el sentido de las agujas
   * del reloj, desde el nominado) y lo que tarda en cada una, en segundos.
   */
  votacion?: { paso: number; segundosPorFicha: number };
}

/** Metales de las agujas: degradado de izquierda a derecha (con brillo) y trazo. */
const METALES = {
  laton: { tonos: ['#6b4317', '#e2b04f', '#f8e3a3', '#7a4f1d'], trazo: '#3a2408', joya: '#9b111e', brillo: '#f8e3a3' },
  hierro: { tonos: ['#111111', '#7d7d7d', '#e0e0e0', '#1c1c1c'], trazo: '#000000', joya: '#e8e8e8', brillo: '#111111' },
};
type Metal = keyof typeof METALES;

/**
 * Las dos agujas de una nominación, de estilo steampunk, desde el centro de la
 * mesa hacia los asientos: la corta (hierro) hacia quien nomina y la larga
 * (latón, con un rubí) hacia el nominado. Cada asiento está en su ángulo (el 1
 * a las 12, como las agujas del reloj), así que basta girarlas. Llegan hasta
 * cerca de las fichas. Al votar, la larga avanza de ficha en ficha.
 *
 * Solo visual: quién nomina a quién se anuncia aparte.
 */
const Agujas = ({ total, desde, hasta, votacion }: AgujasProps) => {
  // Para los degradados: sin caracteres que puedan romper url(#…).
  const id = `agujas${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Hasta la cara interior de las fichas, más o menos; nunca menos de un 15% de la mesa.
  const larga = 'max(15%, calc(50% - var(--sala-avatar, 10rem) - var(--sala-ficha, 4.5rem) / 2))';
  // El ángulo siempre crece (hasta + paso, sin volver a 0 al pasar las 12), así la
  // aguja da la vuelta en el sentido del reloj en lugar de retroceder.
  const giro = (asiento: number, largo: string, ancho: string, duracion?: number): CSSProperties => ({
    height: largo,
    width: ancho,
    transform: `translateX(-50%) rotate(${(360 * asiento) / total}deg)`,
    // Al votar, a velocidad constante, para llegar a cada ficha cuando el servidor la cuenta
    ...(duracion ? { transitionDuration: `${duracion}s`, transitionTimingFunction: 'linear' } : {}),
  });

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
      <svg width="0" height="0" className="absolute">
        <defs>
          {(Object.keys(METALES) as Metal[]).map((m) => (
            <linearGradient key={m} id={`${id}-${m}`} x1="0" x2="1">
              {METALES[m].tonos.map((tono, i) => (
                <stop key={tono + i} offset={[0, 0.45, 0.6, 1][i]} stopColor={tono} />
              ))}
            </linearGradient>
          ))}
        </defs>
      </svg>
      <Aguja metal="hierro" gradiente={`${id}-hierro`} estilo={giro(desde, `calc(${larga} * 0.65)`, '1.75rem')} />
      <Aguja
        metal="laton"
        gradiente={`${id}-laton`}
        estilo={giro(hasta + (votacion?.paso ?? 0), larga, '2.1rem', votacion?.segundosPorFicha)}
      />
      {/* El eje: un engranaje de latón */}
      <svg
        viewBox="0 0 24 24"
        className="absolute left-1/2 top-1/2 w-9 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
      >
        <path
          d="M10.6 1h2.8l.5 3 2 .8 2.4-1.8 2 2-1.8 2.4.8 2 3 .5v2.8l-3 .5-.8 2 1.8 2.4-2 2-2.4-1.8-2 .8-.5 3h-2.8l-.5-3-2-.8-2.4 1.8-2-2 1.8-2.4-.8-2-3-.5v-2.8l3-.5.8-2L3.7 5l2-2 2.4 1.8 2-.8Z"
          fill={`url(#${id}-laton)`}
          stroke={METALES.laton.trazo}
          strokeWidth=".5"
        />
        <circle cx="12" cy="12" r="3.2" fill="#2a1a08" stroke={METALES.laton.brillo} strokeWidth=".6" />
      </svg>
    </div>
  );
};

/**
 * Una aguja (apuntando hacia arriba, girada desde abajo): la cabeza (punta de
 * pica y un anillo calado con una joya) y el contrapeso del eje mantienen su
 * forma; solo la varilla de en medio se estira con el largo.
 */
const Aguja = ({ metal, gradiente, estilo }: { metal: Metal; gradiente: string; estilo: CSSProperties }) => {
  const { tonos, trazo, joya } = METALES[metal];
  const relleno = `url(#${gradiente})`;
  return (
    <div
      className="absolute bottom-1/2 left-1/2 flex origin-bottom flex-col drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] transition-transform duration-500 motion-reduce:transition-none"
      style={estilo}
    >
      <svg viewBox="0 0 20 46" className="block w-full">
        {/* Punta de pica */}
        <path
          d="M10 0C12.6 5 16.5 8.6 14.6 13.2 13.8 15 12 15.6 11 16.6V22H9V16.6C8 15.6 6.2 15 5.4 13.2 3.5 8.6 7.4 5 10 0Z"
          fill={relleno}
          stroke={trazo}
          strokeWidth=".6"
        />
        {/* Anillo calado, con una cruz y la joya en el centro */}
        <path
          fillRule="evenodd"
          d="M10 25a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17Zm0 3.2a5.3 5.3 0 1 0 0 10.6a5.3 5.3 0 1 0 0-10.6Z"
          fill={relleno}
          stroke={trazo}
          strokeWidth=".6"
        />
        <path d="M10 28.2V38.8M4.7 33.5H15.3" stroke={relleno} strokeWidth="1.2" />
        <circle cx="10" cy="33.5" r="2.3" fill={joya} stroke={trazo} strokeWidth=".5" />
        <rect x="9" y="42" width="2" height="4" fill={relleno} />
      </svg>
      {/* Varilla: lo único que se estira */}
      <div
        className="mx-auto w-[12%] flex-1"
        style={{ background: `linear-gradient(90deg, ${tonos[0]}, ${tonos[2]}, ${tonos[3]})`, boxShadow: `0 0 0 0.5px ${trazo}` }}
      />
      {/* Contrapeso, junto al eje */}
      <svg viewBox="0 0 20 18" className="block w-full">
        <rect x="9" y="0" width="2" height="4" fill={relleno} />
        <path
          fillRule="evenodd"
          d="M10 3a6 6 0 1 1 0 12a6 6 0 1 1 0-12Zm0 4a2 2 0 1 0 0 4a2 2 0 1 0 0-4Z"
          fill={relleno}
          stroke={trazo}
          strokeWidth=".6"
        />
        <rect x="9" y="15" width="2" height="3" fill={relleno} />
      </svg>
    </div>
  );
};

export default Agujas;
