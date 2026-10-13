import type { ReactNode } from 'react';

interface FichaRedondaProps {
  /** Lo que lleva dentro (más adelante, el rol). */
  children?: ReactNode;
  /** Jugador muerto: lleva el sudario. */
  muerto?: boolean;
  /** Lleva la marca de la calavera (nominación). */
  marcado?: boolean;
  /** En una votación: los votos acumulados si votó, null (✗) si no; sin definir si aún no le ha tocado. */
  voto?: number | null;
}

/**
 * Una ficha redonda del juego, con la textura de las de Blood on the Clocktower:
 * pergamino claro con el borde oscurecido y relieve. Su diámetro es la variable
 * CSS --sala-ficha (Preferencias > Interfaz).
 *
 * Muerto, lleva el sudario: una banderola negra de dos picos que cae desde las
 * 12 hasta la mitad de la ficha, asomando un poco por arriba. Marcado (en una
 * nominación), lleva una calavera grande en el centro. En una votación, el
 * número de votos que lleva (si votó) o una ✗.
 *
 * Solo visual: quien la use dice para el lector de quién es y si está muerto.
 */
const FichaRedonda = ({ children, muerto = false, marcado = false, voto }: FichaRedondaProps) => (
  // span (de bloque) y no div: la ficha puede ir dentro de un botón
  <span className="relative block aspect-square w-[var(--sala-ficha,4.5rem)]">
    <span
      className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
      style={{
        // Pergamino: más claro en el centro, tostado hacia el borde, y un fino aro oscuro
        background:
          'radial-gradient(circle at 50% 45%, #f4ecd8 0%, #ebdfc2 45%, #dccaa0 72%, #b89c68 88%, #6e5634 97%, #4a3a22 100%)',
        // Relieve: luz arriba, sombra abajo, y sombra sobre la mesa
        boxShadow:
          'inset 0 2px 3px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(74,58,34,0.45), 0 2px 6px rgba(0,0,0,0.6)',
      }}
    >
      {children}
    </span>
    {muerto && (
      // Sudario: de un poco por encima de la ficha (-6%) hasta su mitad (50%)
      <svg
        viewBox="0 0 40 56"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute left-1/2 top-[-6%] h-[56%] w-[36%] -translate-x-1/2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]"
      >
        {/* Banderola con dos picos abajo y un pliegue claro en el centro */}
        <path d="M0 0 H40 V56 L20 44 L0 56 Z" fill="#0d0d0d" />
        <path d="M18 0 H22 V44 L20 44 L18 44 Z" fill="#262626" />
      </svg>
    )}
    {marcado && (
      // Calavera color hueso, centrada y grande
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]"
      >
        <path
          d="M12 2.2C6.9 2.2 3.4 5.9 3.4 10.4c0 2.8 1.3 5 3.3 6.3v2.6c0 1.2.9 2.1 2.1 2.1h6.4c1.2 0 2.1-.9 2.1-2.1v-2.6c2-1.3 3.3-3.5 3.3-6.3 0-4.5-3.5-8.2-8.6-8.2Z"
          fill="#efe6d2"
          stroke="#3b2f25"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* Cuencas, nariz, mandíbula y dientes */}
        <ellipse cx="8.7" cy="11" rx="2.3" ry="2.5" fill="#2b211a" />
        <ellipse cx="15.3" cy="11" rx="2.3" ry="2.5" fill="#2b211a" />
        <path d="M12 13.7l-1.1 2.3h2.2Z" fill="#2b211a" />
        <path d="M6.9 16.8c1.6.9 3.3 1.3 5.1 1.3s3.5-.4 5.1-1.3" fill="none" stroke="#3b2f25" strokeWidth=".7" />
        <path d="M10.2 18.3v3M12 18.3v3M13.8 18.3v3" stroke="#3b2f25" strokeWidth=".8" strokeLinecap="round" />
      </svg>
    )}
    {voto !== undefined && (
      // El voto, grande en el centro: el número de votos que lleva la votación, o una ✗
      <span
        className={`absolute inset-0 flex items-center justify-center font-teutonic1 leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] text-[calc(var(--sala-ficha,4.5rem)*0.55)] ${
          voto === null ? 'text-[#8b1a1a]' : 'text-[#2b1d0e]'
        }`}
      >
        {voto === null ? '✗' : voto}
      </span>
    )}
  </span>
);

export default FichaRedonda;
