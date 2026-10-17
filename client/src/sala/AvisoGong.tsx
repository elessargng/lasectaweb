import { useEffect, useId, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { tocarGong } from './sonidos';

/** Lo que dura el aviso en pantalla (ms); sala.css lo reparte entre entrar, girar y salir. */
const DURACION_MS = 8000;

/** El texto del aviso: da la vuelta entera a la mesa, con un adorno donde se cierra. */
export const TEXTO_GONG = '¡Por favor, regresad a la plaza del pueblo YA!';

// El círculo del texto, en las unidades del viewBox (0 0 200 200): empieza arriba y va
// en el sentido del reloj, así las letras miran hacia fuera, como en la mesa del juego.
const RADIO = 86;
const CIRCULO = `M100,${100 - RADIO} a${RADIO},${RADIO} 0 1,1 0,${2 * RADIO} a${RADIO},${RADIO} 0 1,1 0,${-2 * RADIO}`;
const VUELTA = 2 * Math.PI * RADIO;

/**
 * El gong del narrador: cuando cambia `gong` (hora del servidor del último), suena
 * y, sobre la mesa, sale el aviso de volver a la plaza: un golpe de ondas de latón
 * desde el centro y el texto en dorado alrededor de la mesa, girando despacio,
 * hasta que se desvanece (sala.css; con menos movimiento, quieto). No recibe el
 * ratón. Solo cuenta si es reciente: al entrar en la sala no suena uno de hace rato.
 *
 * Va encima de todo (también de las ventanas de las conversaciones privadas): se
 * pinta en el body, fuera de la capa de la mesa, justo encima de ella (`mesaRef`),
 * siguiéndola si cambia de tamaño o se desplaza la página.
 */
const AvisoGong = ({
  gong,
  ahora,
  mesaRef,
  onAnuncio,
}: {
  gong: number | null;
  ahora: number;
  mesaRef: RefObject<HTMLDivElement | null>;
  onAnuncio: (mensaje: string) => void;
}) => {
  const [visible, setVisible] = useState<number | null>(null);
  const [sitio, setSitio] = useState<CSSProperties | null>(null);
  const id = useId();

  // Dónde está la mesa en la ventana, con sus tamaños de asiento y ficha (los usa sala.css)
  useLayoutEffect(() => {
    const mesa = mesaRef.current;
    if (visible === null || !mesa) return;
    const medir = () => {
      const r = mesa.getBoundingClientRect();
      const estilo = getComputedStyle(mesa);
      setSitio({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        '--sala-avatar': estilo.getPropertyValue('--sala-avatar'),
        '--sala-ficha': estilo.getPropertyValue('--sala-ficha'),
      } as CSSProperties);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(mesa);
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [visible, mesaRef]);

  useEffect(() => {
    if (gong === null || ahora - gong > DURACION_MS / 2) return;
    setVisible(gong);
    tocarGong();
    onAnuncio(`El narrador ha sonado el gong: ${TEXTO_GONG}`);
    const t = window.setTimeout(() => setVisible(null), DURACION_MS);
    return () => window.clearTimeout(t);
    // Solo al llegar un gong nuevo (ahora cambia con cada mensaje de la sala)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gong]);

  if (visible === null || !sitio) return null;
  const relleno = `${id}-relleno`;
  const brillo = `${id}-brillo`;
  const camino = `${id}-camino`;
  return createPortal(
    <div key={visible} aria-hidden="true" className="sala-gong pointer-events-none fixed z-[100]" style={sitio}>
      <div className="sala-gong-velo absolute inset-0 rounded-full" />
      {[0, 1, 2].map((k) => (
        <span key={k} className="sala-gong-onda absolute left-1/2 top-1/2 rounded-full" style={{ animationDelay: `${k * 0.35}s` }} />
      ))}
      <div className="sala-gong-anillo absolute">
        <svg viewBox="0 0 200 200" className="sala-gong-giro h-full w-full overflow-visible">
          <defs>
            <path id={camino} d={CIRCULO} />
            {/* Latón: claro arriba, hondo abajo de cada letra */}
            <linearGradient id={relleno} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff6dc" />
              <stop offset="45%" stopColor="#f1cf7d" />
              <stop offset="100%" stopColor="#b07a24" />
            </linearGradient>
            {/* El destello que recorre el texto */}
            <linearGradient id={brillo} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="60" y2="30">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              <animateTransform attributeName="gradientTransform" type="translate" from="-80 -40" to="220 110" dur="2.4s" begin="0.9s" repeatCount="indefinite" />
            </linearGradient>
          </defs>
          {/* Filetes de latón por dentro y por fuera del texto */}
          <circle cx="100" cy="100" r={RADIO + 11} className="sala-gong-filete" />
          <circle cx="100" cy="100" r={RADIO - 11} className="sala-gong-filete" strokeDasharray="1 3.2" />
          {[relleno, brillo].map((pintura) => (
            <text key={pintura} className={pintura === brillo ? 'sala-gong-texto sala-gong-destello' : 'sala-gong-texto'} fill={`url(#${pintura})`} dominantBaseline="central">
              <textPath href={`#${camino}`} textLength={VUELTA * 0.985} lengthAdjust="spacing">
                {TEXTO_GONG.toUpperCase()} ✦
              </textPath>
            </text>
          ))}
        </svg>
      </div>
    </div>,
    document.body,
  );
};

export default AvisoGong;
