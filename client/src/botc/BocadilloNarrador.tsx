import { useId, useRef, useState, type AnimationEvent } from 'react';
import { MessageSquareQuote, X } from 'lucide-react';

interface BocadilloNarradorProps {
  /** Lo último que ha dicho el narrador virtual. */
  frase: string;
}

/** Lo que tarda en recogerse solo: lo bastante para leerla con calma, ni menos de 6 s ni más de 14. */
const tiempoDeLectura = (frase: string) => Math.min(14000, Math.max(6000, 2500 + frase.length * 60));

/**
 * Lo que dice el narrador virtual, en un bocadillo de cómic que sale de su
 * retrato hacia la plaza. Cada frase nueva lo abre y, pasado un rato (una línea
 * de latón que se consume lo cuenta), se recoge solo; con el ratón encima o el
 * foco dentro, espera. Se puede recoger antes (la X) y volver a abrir con el
 * medallón de la esquina del retrato; abierto a mano, ya no se recoge solo.
 *
 * Quien lo usa le pone la frase de key: así cada frase nueva empieza abierta y contando.
 *
 * Para el lector: el medallón («Frase del narrador», desplegado o contraído) y,
 * abierto, la frase y «Recoger». No va en aria-live: la frase ya se oye en voz alta.
 */
const BocadilloNarrador = ({ frase }: BocadilloNarradorProps) => {
  const id = useId();
  const medallon = useRef<HTMLButtonElement>(null);
  // abierto: se ve; saliendo: se está recogiendo (la animación lo quita al acabar)
  const [abierto, setAbierto] = useState(true);
  const [saliendo, setSaliendo] = useState(false);
  const [aMano, setAMano] = useState(false);

  const recoger = () => setSaliendo(true);

  const alAcabarAnimacion = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !saliendo) return;
    setAbierto(false);
    setSaliendo(false);
  };

  const alternar = () => {
    if (abierto && !saliendo) {
      recoger();
    } else {
      setAbierto(true);
      setSaliendo(false);
      setAMano(true);
    }
  };

  const desplegado = abierto && !saliendo;

  return (
    <>
      {/* En la esquina de abajo a la derecha del retrato (la caja tiene su tamaño y su sitio) */}
      <div className="pointer-events-none absolute inset-x-0 top-5 z-20 aspect-square">
        <button
          ref={medallon}
          type="button"
          onClick={alternar}
          aria-expanded={desplegado}
          aria-controls={id}
          aria-label="Frase del narrador"
          className="sala-boton-icono sala-bocadillo-medallon pointer-events-auto absolute -right-2 -bottom-2"
        >
          <MessageSquareQuote size={16} />
        </button>
      </div>
      <div id={id} className="contents">
        {abierto && (
          <div
            data-saliendo={saliendo || undefined}
            onAnimationEnd={alAcabarAnimacion}
            className="sala-bocadillo absolute top-5 left-full z-30 ml-4 w-[min(22rem,calc(100vw-var(--sala-avatar,10rem)-3rem))]"
          >
            <span aria-hidden="true" className="sala-bocadillo-cola" />
            <span aria-hidden="true" className="sala-bocadillo-comillas font-display">
              «
            </span>
            <p className="relative pr-7 pl-6 font-body text-[1.15rem] leading-snug text-on-surface-bright italic">{frase}</p>
            <button
              type="button"
              onClick={() => {
                recoger();
                medallon.current?.focus();
              }}
              aria-label="Recoger"
              className="sala-bocadillo-cerrar absolute top-1.5 right-1.5"
            >
              <X size={16} />
            </button>
            {!aMano && (
              <span
                aria-hidden="true"
                className="sala-bocadillo-tiempo"
                style={{ animationDuration: `${tiempoDeLectura(frase)}ms` }}
                onAnimationEnd={(e) => {
                  e.stopPropagation();
                  recoger();
                }}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default BocadilloNarrador;
