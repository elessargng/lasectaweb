import { createPortal } from 'react-dom';
import { ID_GANADOR } from './ids';
import type { SalaAlineamiento } from './useSala';

/**
 * Al terminar de revelar el grimorio: el bando ganador, en grande y en una sola
 * línea, en una franja de tinta a un tercio de la altura de la ventana. Entra con
 * un rótulo, unos filos de latón que se abren desde el centro y el título que se
 * enfoca, y luego lo cruza un destello; a los pocos segundos sube y encoge hasta
 * quedarse como estandarte bajo la cabecera, para que se vean las fichas
 * reveladas (sala.css; con menos movimiento, quieto ya en su sitio). No recibe el
 * ratón. Es el destino del foco al terminar (se anuncia aparte).
 *
 * Debajo, lo que ha pasado (ver causasFinal.ts): «Exterminador: ha matado al demonio…».
 */
const AnuncioGanador = ({ ganador, causas = [] }: { ganador: SalaAlineamiento; causas?: { nombre: string; lang: string; texto: string }[] }) =>
  createPortal(
    <div className="sala-ganador pointer-events-none fixed inset-x-0 top-[30vh] z-30 flex justify-center" data-bando={ganador}>
      <div className="sala-ganador-franja flex w-full flex-col items-center gap-2 px-4 py-5">
        <span aria-hidden="true" className="sala-ganador-rotulo font-ui text-xs font-semibold uppercase tracking-[0.4em] text-gold">
          Fin de la partida
        </span>
        <span aria-hidden="true" className="sala-ganador-filo" />
        <p id={ID_GANADOR} tabIndex={-1} className="sala-ganador-titulo whitespace-nowrap font-display leading-none focus:outline-none">
          {ganador === 'bueno' ? 'Gana el bando bueno' : 'Gana el bando malo'}
        </p>
        <span aria-hidden="true" className="sala-ganador-filo" />
        {causas.length > 0 && (
          <ul className="flex flex-col items-center gap-0.5 text-center font-body text-sm text-on-surface">
            {causas.map((c) => (
              <li key={c.nombre}>
                <span lang={c.lang} className="font-semibold text-gold-bright">
                  {c.nombre}
                </span>
                : {c.texto.charAt(0).toLocaleLowerCase('es') + c.texto.slice(1)}.
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );

export default AnuncioGanador;
