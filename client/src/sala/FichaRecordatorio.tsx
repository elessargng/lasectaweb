import { Feather } from 'lucide-react';
import { useId } from 'react';
import { urlDelServidor } from '../utils/api';
import type { PersonajeMostrado, Texto } from './guiones';

/**
 * Proporción entre una ficha recordatorio y la de un personaje, siempre a escala
 * de --sala-ficha. En el grimorio de verdad miden 2,5 cm y 4 cm, pero en pantalla
 * así tapaban demasiado: van a la mitad.
 */
export const ESCALA_RECORDATORIO = 0.5;
export const TAMANO_RECORDATORIO = `calc(var(--sala-ficha, 4.5rem) * ${ESCALA_RECORDATORIO})`;

interface FichaRecordatorioProps {
  /** El personaje del que es: su icono (el de por defecto). */
  personaje: PersonajeMostrado | undefined;
  texto: Texto;
  /** Tamaño (CSS); por defecto, a escala de las fichas de la mesa. */
  tamano?: string;
  /** Con texto propio (sin personaje): el texto da la vuelta a la ficha y en el centro va una pluma. */
  libre?: boolean;
}

/**
 * Una ficha recordatorio: redonda, con el fondo violeta de las del juego (el de
 * botc.app), el icono del personaje y el texto del recordatorio en claro,
 * curvado por el borde de abajo. Solo visual: quien la
 * usa dice para el lector qué recordatorio es.
 */
/**
 * El texto va siguiendo el borde de abajo (un arco dentro del aro), como el
 * nombre en las fichas de personaje. Medidas sobre una ficha de 100 de lado: el
 * arco tiene unas 110 unidades útiles y cada letra ocupa unas 0,6 veces su
 * tamaño, así que los textos largos encogen para caber.
 */
const RADIO_TEXTO = 39;
const TAMANO_TEXTO = 17;
const tamanoTexto = (texto: string) => Math.min(TAMANO_TEXTO, 110 / (texto.length * 0.6));

/**
 * Con texto propio, el texto va en redondo por casi toda la ficha, centrado
 * arriba y con las letras mirando hacia fuera: tiene unas 190 unidades útiles,
 * así que los textos cortos se ven grandes y los de 14 letras aún se leen.
 */
const RADIO_LIBRE = 36;
const TAMANO_LIBRE = 22;
const tamanoLibre = (texto: string) => Math.min(TAMANO_LIBRE, 190 / (Math.max(texto.length, 1) * 0.62));
// Desde abajo, en el sentido del reloj: el centro del camino (50 %) queda arriba
const CIRCULO_LIBRE = `M 50 ${50 + RADIO_LIBRE} A ${RADIO_LIBRE} ${RADIO_LIBRE} 0 1 1 50 ${50 - RADIO_LIBRE} A ${RADIO_LIBRE} ${RADIO_LIBRE} 0 1 1 50 ${50 + RADIO_LIBRE}`;

const FichaRecordatorio = ({ personaje, texto, tamano = TAMANO_RECORDATORIO, libre = false }: FichaRecordatorioProps) => {
  // Cada ficha, su arco (los id del SVG son de toda la página)
  const idArco = `arco-rec-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <span
      aria-hidden="true"
      className="relative flex aspect-square items-center justify-center overflow-hidden rounded-full shadow-[0_0_0_1px_rgba(20,12,32,0.6),0_2px_5px_rgba(0,0,0,0.6)]"
      // El fondo violeta de los recordatorios de botc.app (copia local, public/recordatorio.webp),
      // de borde a borde; debajo, un violeta parecido por si tarda en cargar
      style={{ width: tamano, background: "url('/recordatorio.webp') center / cover no-repeat, #3d2a5c" }}
    >
      {libre ? (
        <Feather className="h-[34%] w-[34%] text-[#e9c97a] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" strokeWidth={2.2} />
      ) : (
        personaje?.icono && (
          <img src={urlDelServidor(personaje.icono)} alt="" className="h-[62%] w-[62%] -translate-y-[12%] object-contain" />
        )
      )}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
        {/* De izquierda a derecha por abajo: el texto queda derecho, mirando al centro.
            Con texto propio, la vuelta entera (centrado arriba). */}
        <path
          id={idArco}
          d={libre ? CIRCULO_LIBRE : `M ${50 - RADIO_TEXTO} 50 A ${RADIO_TEXTO} ${RADIO_TEXTO} 0 0 0 ${50 + RADIO_TEXTO} 50`}
          fill="none"
        />
        <text
          lang={texto.lang}
          fontFamily="Georgia, serif"
          fontWeight="bold"
          fontSize={libre ? tamanoLibre(texto.texto) : tamanoTexto(texto.texto)}
          dominantBaseline={libre ? 'central' : undefined}
          // En claro sobre el violeta, con un halo oscuro para que se lea sobre el icono
          fill="#f3e6d0"
          stroke="rgba(18, 10, 28, 0.85)"
          strokeWidth="1.5"
          style={{ paintOrder: 'stroke' }}
        >
          <textPath href={`#${idArco}`} startOffset="50%" textAnchor="middle">
            {texto.texto}
          </textPath>
        </text>
      </svg>
    </span>
  );
};

export default FichaRecordatorio;
