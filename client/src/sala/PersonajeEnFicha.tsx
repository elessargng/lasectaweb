import { useId } from 'react';
import { urlDelServidor } from '../utils/api';
import { iconoDe } from './fichas';
import type { PersonajeMostrado } from './guiones';
import type { SalaAlineamiento } from './useSala';

/**
 * El nombre va en mayúsculas siguiendo el borde de abajo de la ficha (un arco
 * dentro del aro), como en las fichas impresas. Medidas sobre una ficha de 100
 * de lado: el arco tiene unas 100 unidades útiles y cada mayúscula ocupa
 * unas 0,72 veces su tamaño, así que los nombres largos encogen para caber.
 */
const RADIO_NOMBRE = 44;
const TAMANO_NOMBRE = 14;
const tamanoNombre = (nombre: string) => Math.min(TAMANO_NOMBRE, 100 / (nombre.length * 0.72));

/**
 * El personaje dentro de la ficha: su icono (el bueno o el malvado, según su
 * alineamiento) y su nombre curvado abajo. Solo visual: la ficha lo dice en su descripción.
 */
const PersonajeEnFicha = ({
  personaje,
  alineamiento,
}: {
  personaje: PersonajeMostrado;
  alineamiento: SalaAlineamiento | null;
}) => {
  const icono = iconoDe(personaje, alineamiento);
  // Cada ficha, su arco (los id del SVG son de toda la página)
  const idArco = `arco-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const nombre = personaje.nombre.texto.toLocaleUpperCase(personaje.nombre.lang);
  return (
    <span aria-hidden="true" className="relative flex h-full w-full items-center justify-center">
      {icono && <img src={urlDelServidor(icono)} alt="" className="h-[83%] w-[83%] -translate-y-[7%] object-contain" />}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
        {/* De izquierda a derecha por abajo: el texto queda derecho, mirando al centro */}
        <path id={idArco} d={`M ${50 - RADIO_NOMBRE} 50 A ${RADIO_NOMBRE} ${RADIO_NOMBRE} 0 0 0 ${50 + RADIO_NOMBRE} 50`} fill="none" />
        <text
          className="sala-ficha-nombre"
          lang={personaje.nombre.lang}
          fontFamily="Georgia, serif"
          fontWeight="bold"
          fontSize={tamanoNombre(nombre)}
          letterSpacing="0.5"
          fill="#2b211a"
          style={{ paintOrder: 'stroke' }}
          stroke="rgba(243, 230, 208, 0.7)"
          strokeWidth="1.5"
        >
          <textPath href={`#${idArco}`} startOffset="50%" textAnchor="middle">
            {nombre}
          </textPath>
        </text>
      </svg>
    </span>
  );
};

export default PersonajeEnFicha;
