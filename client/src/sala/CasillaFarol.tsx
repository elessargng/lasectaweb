import type { CSSProperties } from 'react';
import FichaRedonda from './FichaRedonda';
import type { PersonajeMostrado } from './guiones';
import PersonajeEnFicha from './PersonajeEnFicha';

/** El diámetro de una ficha de farol, como mucho: si su casilla es más estrecha, encoge hasta caber. */
const TAMANO_FAROL = '5.25rem';

/**
 * Una casilla de farol: una ficha del juego (la misma que en la mesa, con el
 * icono y el nombre curvado), del tamaño de un farol, y el nombre otra vez
 * debajo, más legible. Vacía, la ficha está boca abajo (se ve el reverso) y, al
 * ponerle un personaje, se da la vuelta. Solo es dibujo: el nombre accesible lo
 * pone quien la usa (el texto de debajo se lee; la ficha, no).
 */
const CasillaFarol = ({
  personaje,
  tamano = TAMANO_FAROL,
  conNombre = true,
}: {
  personaje: PersonajeMostrado | undefined;
  tamano?: string;
  /** El nombre debajo (sin él, solo la ficha: quien la usa dice al lector cuál es). */
  conNombre?: boolean;
}) => (
  // El ancho de la ficha es un porcentaje del de la casilla (con su máximo): nunca se sale de ella
  <span className="flex w-full min-w-0 flex-col items-center gap-1.5" style={{ '--sala-ficha': `min(${tamano}, 100%)` } as CSSProperties}>
    <span aria-hidden="true" className="flex w-full justify-center">
      <FichaRedonda bocaAbajo={!personaje}>
        {personaje && <PersonajeEnFicha personaje={personaje} alineamiento={null} />}
      </FichaRedonda>
    </span>
    {conNombre && (
      <span className="w-full truncate text-center text-xs leading-tight">
        {personaje ? (
          <span lang={personaje.nombre.lang}>{personaje.nombre.texto}</span>
        ) : (
          <span className="text-on-surface-muted">Vacío</span>
        )}
      </span>
    )}
  </span>
);

export default CasillaFarol;
