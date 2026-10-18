/** Lo que dice el pulpito (ayuda al pasar el ratón y para el lector). */
const AYUDA = 'Ha jugado menos de 10 partidas';

/**
 * El pulpito de los novatos: el Lil' Monsta de Blood on the Clocktower con el
 * bombín pintado de negro (public/novato.png), junto al nombre de quien juega y
 * ha jugado menos de 10 partidas en la sala. Al pasar el ratón sale la ayuda; el
 * lector la oye entre paréntesis.
 *
 * Va centrado con el nombre y, aunque es más alto que el texto, no hace más alta
 * la línea (márgenes negativos): así no sobresale por arriba ni se corta en los
 * asientos pegados al borde de la mesa.
 */
const PulpitoNovato = ({ tamano = 'h-[1.75em] w-[1.75em]' }: { tamano?: string }) => (
  <span title={AYUDA} className="ml-1 inline-flex shrink-0 -my-[0.375em] align-middle">
    <img src="/novato.png" alt="" className={`object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${tamano}`} />
    <span className="sr-only"> ({AYUDA.toLocaleLowerCase('es')})</span>
  </span>
);

export default PulpitoNovato;
