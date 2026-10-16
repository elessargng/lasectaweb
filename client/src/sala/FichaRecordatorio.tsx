import { urlDelServidor } from '../utils/api';
import type { PersonajeMostrado, Texto } from './guiones';

/**
 * Proporción entre una ficha recordatorio y la de un personaje: en el grimorio
 * de verdad miden 2,5 cm y 4 cm. Siempre a escala de --sala-ficha.
 */
export const ESCALA_RECORDATORIO = 2.5 / 4;
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
 * del personaje y el texto del recordatorio debajo. Solo visual: quien la usa
 * dice para el lector qué recordatorio es.
 */
const FichaRecordatorio = ({ personaje, texto, tamano = TAMANO_RECORDATORIO }: FichaRecordatorioProps) => (
  <span
    aria-hidden="true"
    className="relative flex aspect-square flex-col items-center justify-start overflow-hidden rounded-full border border-gold-deep/70 bg-[radial-gradient(circle_at_50%_35%,var(--color-arcano-bright),var(--color-arcano))] shadow-[0_2px_5px_rgba(0,0,0,0.6)]"
    style={{ width: tamano }}
  >
    {personaje?.icono ? (
      <img src={urlDelServidor(personaje.icono)} alt="" className="mt-[6%] h-[58%] w-[58%] object-contain" />
    ) : (
      <span className="mt-[6%] h-[58%] w-[58%]" />
    )}
    <span
      lang={texto.lang}
      // Sombra oscura: sobre el morado claro el pergamino se lee mejor
      className="line-clamp-2 w-[86%] text-center font-semibold leading-[1.05] text-parchment [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]"
      // El texto, a escala de la ficha
      style={{ fontSize: `calc(${tamano} * 0.14)` }}
    >
      {texto.texto}
    </span>
  </span>
);

export default FichaRecordatorio;
