/** Lo que dice el pulpito (ayuda al pasar el ratón y para el lector). */
const AYUDA = 'Ha jugado menos de 10 partidas';

/**
 * El pulpito de los novatos: el Lil' Monsta de Blood on the Clocktower con el
 * bombín pintado de negro (public/novato.png), junto al nombre de quien juega y
 * ha jugado menos de 10 partidas en la sala. Al pasar el ratón sale la ayuda; el
 * lector la oye entre paréntesis.
 */
const PulpitoNovato = ({ className = 'ml-1 inline-block h-[1.75em] w-[1.75em] align-[-0.65em]' }: { className?: string }) => (
  <span title={AYUDA} className="inline-flex shrink-0">
    <img src="/novato.png" alt="" className={`object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${className}`} />
    <span className="sr-only"> ({AYUDA.toLocaleLowerCase('es')})</span>
  </span>
);

export default PulpitoNovato;
