import type { CSSProperties } from 'react';

interface AgujasProps {
  /** Número de asientos de la mesa. */
  total: number;
  /** Asiento (desde 0) de quien nomina: la aguja de los segundos. */
  desde: number;
  /** Asiento (desde 0) del nominado: la aguja de las horas, fija. */
  hasta: number;
  /**
   * Fichas que ha avanzado la aguja de los minutos al votar (en el sentido de
   * las agujas del reloj, desde el nominado) y lo que tarda en cada una, en segundos.
   */
  votacion?: { paso: number; segundosPorFicha: number };
}

/**
 * Las agujas de reloj de botc.app (copias locales en public/agujas). Cada imagen
 * tiene el eje en su centro y la aguja hacia arriba en la mitad de arriba; a la
 * misma escala, la de las horas es más corta que la de los minutos.
 */
const IMAGENES = { horas: '/agujas/horas.webp', minutos: '/agujas/minutos.webp', segundos: '/agujas/segundos.webp' };

/**
 * Las agujas de una nominación, desde el centro de la mesa hacia los asientos.
 * Cada asiento está en su ángulo (el 1 a las 12, como en un reloj), así que basta
 * girarlas:
 * - Horas: fija en el nominado.
 * - Minutos: sale del nominado y, al votar, avanza de ficha en ficha.
 * - Segundos: fija en quien nomina.
 * La de los minutos, la más larga, llega hasta cerca de las fichas.
 *
 * Solo visual: quién nomina a quién se anuncia aparte.
 */
const Agujas = ({ total, desde, hasta, votacion }: AgujasProps) => {
  // Hasta la cara interior de las fichas, más o menos; nunca menos de un 15% de la mesa.
  const larga = 'max(15%, calc(50% - var(--sala-avatar, 10rem) - var(--sala-ficha, 4.5rem) / 2))';
  // El ángulo siempre crece (hasta + paso, sin volver a 0 al pasar las 12), así la
  // aguja da la vuelta en el sentido del reloj en lugar de retroceder.
  const giro = (asiento: number, duracion?: number): CSSProperties => ({
    // La imagen mide el doble que la aguja: el eje está en su centro
    height: `calc(2 * ${larga})`,
    transform: `translate(-50%, -50%) rotate(${(360 * asiento) / total}deg)`,
    // Al votar, a velocidad constante, para llegar a cada ficha cuando el servidor la cuenta
    ...(duracion ? { transitionDuration: `${duracion}s`, transitionTimingFunction: 'linear' } : {}),
  });

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
      {/* De abajo arriba, como en un reloj: horas, minutos y segundos */}
      <Aguja imagen={IMAGENES.horas} estilo={giro(hasta)} />
      <Aguja imagen={IMAGENES.minutos} estilo={giro(hasta + (votacion?.paso ?? 0), votacion?.segundosPorFicha)} />
      <Aguja imagen={IMAGENES.segundos} estilo={giro(desde)} />
    </div>
  );
};

/** Una aguja, centrada en el eje de la mesa y girada sobre él. */
const Aguja = ({ imagen, estilo }: { imagen: string; estilo: CSSProperties }) => (
  <img
    src={imagen}
    alt=""
    className="absolute left-1/2 top-1/2 w-auto max-w-none origin-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] transition-transform duration-500 motion-reduce:transition-none"
    style={estilo}
  />
);

export default Agujas;
