/** Lo que dice el pulpito (ayuda al pasar el ratón y para el lector). */
const AYUDA = 'Ha jugado menos de 10 partidas';

/**
 * El pulpito de los novatos (un pequeño pulpo rojo con bombín negro, como el
 * Little Monster): junto al nombre de quien ha jugado menos de 10 partidas en la
 * sala. Al pasar el ratón sale la ayuda; el lector la oye entre paréntesis.
 */
const PulpitoNovato = ({ className = 'ml-1 inline-block h-[1.1em] w-[1.1em] align-[-0.2em]' }: { className?: string }) => (
  <span title={AYUDA} className="inline-flex shrink-0">
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      {/* Los tentáculos */}
      <g fill="#c8323c" stroke="#5a0f16" strokeWidth="0.8" strokeLinejoin="round">
        <path d="M9 19 C7 23 5 24 4 27 C6 27.5 8 25.5 9.5 23 Z" />
        <path d="M12 21 C11.5 25 10 27 10 30 C12 29.5 13 27 13.8 23.5 Z" />
        <path d="M16 21.5 C16 25.5 15.5 28 16 30.5 C17.5 29 17.8 26 17.6 22 Z" />
        <path d="M20 21 C20.5 25 22 27 22 30 C20 29.5 19 27 18.2 23.5 Z" />
        <path d="M23 19 C25 23 27 24 28 27 C26 27.5 24 25.5 22.5 23 Z" />
      </g>
      {/* La cabeza, con su brillo */}
      <ellipse cx="16" cy="16.5" rx="8.5" ry="7" fill="#e0454e" stroke="#5a0f16" strokeWidth="0.8" />
      <ellipse cx="13" cy="13.5" rx="2.2" ry="1.4" fill="#f58a90" opacity=".7" />
      {/* Los ojos y la sonrisa */}
      <circle cx="12.8" cy="17.5" r="1.9" fill="#fff" />
      <circle cx="19.2" cy="17.5" r="1.9" fill="#fff" />
      <circle cx="13.2" cy="17.8" r="1" fill="#14111f" />
      <circle cx="19.6" cy="17.8" r="1" fill="#14111f" />
      <path d="M14.3 20.4 Q16 21.6 17.7 20.4" fill="none" stroke="#5a0f16" strokeWidth="0.8" strokeLinecap="round" />
      {/* El bombín */}
      <ellipse cx="16" cy="10.6" rx="8.6" ry="1.9" fill="#1b1b1f" stroke="#000" strokeWidth="0.5" />
      <path d="M10.4 10.4 C10.4 4.2 21.6 4.2 21.6 10.4 Z" fill="#1b1b1f" stroke="#000" strokeWidth="0.5" />
      <path d="M10.6 9.2 C13 10 19 10 21.4 9.2" fill="none" stroke="#5b5560" strokeWidth="1.1" />
      <path d="M12.8 6.6 C13.6 5.6 15 5.2 16 5.2" fill="none" stroke="#4a4550" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
    <span className="sr-only"> ({AYUDA.toLocaleLowerCase('es')})</span>
  </span>
);

export default PulpitoNovato;
