import type { ReactNode } from 'react';
import Calavera from './Calavera';
import { useMarcas } from './marcas';
import VelaVoto from './VelaVoto';

interface FichaRedondaProps {
  /** Lo que lleva dentro (más adelante, el rol). */
  children?: ReactNode;
  /** Jugador muerto: lleva el sudario. */
  muerto?: boolean;
  /** Muerto de noche, por anunciar: el sudario, semitransparente (solo lo ve quien ve el grimorio). */
  muertePendiente?: boolean;
  /** Muerto, ya ha gastado su voto: su vela, apagada, o el círculo azul en el sudario (Preferencias > Interfaz). */
  votoGastado?: boolean;
  /** Lleva la marca de la calavera (nominación). */
  marcado?: boolean;
  /** En una votación: los votos acumulados si votó, null (✗) si no; sin definir si aún no le ha tocado. */
  voto?: number | null;
  /** Boca abajo (revelando el grimorio): se ve el reverso. Al cambiar, gira. */
  bocaAbajo?: boolean;
  /**
   * En una nominación: se ve el reverso (la esfera del reloj) como boca abajo,
   * pero con la calavera y los votos encima.
   */
  reloj?: boolean;
  /**
   * Boca abajo, se gira al pasar el ratón o con el foco en el botón que la
   * contiene (con la clase group): el narrador la mira antes de revelarla.
   */
  asomar?: boolean;
}

/**
 * Una ficha redonda del juego, con la textura de las de Blood on the Clocktower
 * (la de botc.app) y relieve. Su diámetro es la variable
 * CSS --sala-ficha (Preferencias > Interfaz).
 *
 * Muerto, lleva el sudario: una banderola negra de dos picos que cae desde las
 * 12 hasta la mitad de la ficha, asomando un poco por arriba. Marcado (en una
 * nominación), lleva una calavera grande en el centro. En una votación, el
 * número de votos que lleva (si votó) o una ✗.
 *
 * Muerto (ya anunciado), además se ve si le queda el voto, como haya elegido
 * cada uno: su vela negra en la esquina de abajo a la izquierda (encendida
 * mientras lo tiene, apagada al gastarlo) o, al perderlo, un círculo azul con
 * halo en lo alto del sudario.
 *
 * Tiene dos caras: boca abajo se ve el reverso (el de botc.app; muerta, el
 * violeta) y al darle la vuelta gira sobre sí misma (sin animación si se pide menos movimiento).
 *
 * Solo visual: quien la use dice para el lector de quién es y si está muerto.
 */
const FichaRedonda = ({ children, muerto = false, muertePendiente = false, votoGastado = false, marcado = false, voto, bocaAbajo = false, reloj = false, asomar = false }: FichaRedondaProps) => {
  const estiloVoto = useMarcas().voto;
  return (
  // span (de bloque) y no div: la ficha puede ir dentro de un botón
  <span className="relative block aspect-square w-[var(--sala-ficha,4.5rem)] [perspective:40rem]">
    <span
      className={`relative block h-full w-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d] motion-reduce:transition-none ${
        bocaAbajo || reloj ? '[transform:rotateY(180deg)]' : ''
      } ${bocaAbajo && asomar ? 'group-hover:[transform:rotateY(0deg)] group-focus-visible:[transform:rotateY(0deg)]' : ''}`}
    >
      {/* Cara: la textura y el personaje */}
      <span
        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full [backface-visibility:hidden]"
        style={{
          // La textura de las fichas de botc.app (copia local, public/ficha.webp),
          // agrandada al 110% (su círculo no llega al borde de la imagen y así el aro
          // oscuro queda justo en el borde de la ficha). Debajo, el color del
          // pergamino por si tarda en cargar.
          background: "url('/ficha.webp') center / 110% no-repeat, #d8c59c",
          // Solo la sombra sobre la mesa: el relieve ya lo trae la textura
          boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
        }}
      >
        {children}
      </span>
      {/* Reverso (los de botc.app, copias locales en public): la esfera del reloj o, si
          está muerta, el mármol violeta (ficha-reverso-muerta.webp) */}
      <span
        className="absolute inset-0 rounded-full [backface-visibility:hidden] [transform:rotateY(180deg)]"
        style={{
          background: muerto
            ? "url('/ficha-reverso-muerta.webp') center / 100% no-repeat, #4a4170"
            : "url('/ficha-reverso.webp') center / 100% no-repeat, #d9cfb4",
          boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
        }}
      />
    </span>
    {(muerto || muertePendiente) && (
      // Sudario (el de botc.app, copia local en public/sudario.webp): de un poco
      // por encima de la ficha (-6%) hasta su mitad (50%), con su proporción.
      // Semitransparente si la muerte (de la noche) aún no se ha anunciado
      <span
        className={`absolute left-1/2 top-[-6%] block aspect-[143/200] h-[56%] -translate-x-1/2 ${muerto ? '' : 'opacity-45'}`}
      >
        <img src="/sudario.webp" alt="" className="block h-full w-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]" />
        {muerto && votoGastado && estiloVoto === 'sudario' && (
          // Sin voto: un círculo azul en lo alto del sudario, con un halo de luz alrededor
          <span className="sala-voto-perdido absolute left-1/2 top-[28%] block aspect-square w-[58%] rounded-full" />
        )}
      </span>
    )}
    {muerto && estiloVoto === 'vela' && (
      // La vela del muerto, de pie junto a la ficha (la mano va en la esquina contraria)
      <VelaVoto encendida={!votoGastado} className="absolute -left-[24%] bottom-[-13%] z-[1] h-[54%] w-[50%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]" />
    )}
    {marcado && !bocaAbajo && (
      // La calavera, en el estilo que haya elegido cada uno (Preferencias > Interfaz),
      // centrada y grande: se lee encima del personaje
      <Calavera className="absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]" />
    )}
    {voto !== undefined && !bocaAbajo && (
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
};

export default FichaRedonda;
