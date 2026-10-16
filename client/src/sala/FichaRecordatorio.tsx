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
}

/**
 * Una ficha recordatorio: redonda, de un morado claro (el arcano de la paleta), con el icono
 * del personaje y el texto del recordatorio curvado por el borde de abajo. Solo visual: quien la usa
 * dice para el lector qué recordatorio es.
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

const FichaRecordatorio = ({ personaje, texto, tamano = TAMANO_RECORDATORIO }: FichaRecordatorioProps) => {
  // Cada ficha, su arco (los id del SVG son de toda la página)
  const idArco = `arco-rec-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <span
      aria-hidden="true"
      className="relative flex aspect-square items-center justify-center overflow-hidden rounded-full border border-gold-deep/70 shadow-[0_2px_5px_rgba(0,0,0,0.6)]"
      // El fondo, en estilo: la clase arbitraria con el degradado no se generaba
      style={{
        width: tamano,
        background: 'radial-gradient(circle at 50% 35%, var(--color-arcano-bright), var(--color-arcano))',
      }}
    >
      {personaje?.icono && (
        <img src={urlDelServidor(personaje.icono)} alt="" className="h-[62%] w-[62%] -translate-y-[12%] object-contain" />
      )}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
        {/* De izquierda a derecha por abajo: el texto queda derecho, mirando al centro */}
        <path id={idArco} d={`M ${50 - RADIO_TEXTO} 50 A ${RADIO_TEXTO} ${RADIO_TEXTO} 0 0 0 ${50 + RADIO_TEXTO} 50`} fill="none" />
        <text
          lang={texto.lang}
          fontFamily="Georgia, serif"
          fontWeight="bold"
          fontSize={tamanoTexto(texto.texto)}
          fill="var(--color-parchment)"
          // Un borde oscuro: sobre el morado claro el pergamino se lee mejor
          stroke="rgba(30, 12, 45, 0.85)"
          strokeWidth="2"
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
