import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  guionesParaJugadores,
  JUGADORES_NARRADOR_VIRTUAL,
  NARRADORES_VIRTUALES,
  type GuionNarradorVirtual,
  type IdNarradorVirtual,
} from '@contrato/sala';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import type { SalaResultado } from './useSala';

interface DialogoNarradorVirtualProps {
  /** Cuántos hay ya sentados: no se puede pedir una partida de menos. */
  sentados: number;
  /** Por qué no se puede elegir alguno ahora (Jarvis sin cuenta o sin su modelo comprobado). */
  noDisponible?: Partial<Record<IdNarradorVirtual, string>>;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

const { min, max } = JUGADORES_NARRADOR_VIRTUAL;
const NUMEROS = Array.from({ length: max - min + 1 }, (_, i) => min + i);

/**
 * En lugar de hacerse narrador: añadir un narrador virtual que lleva la partida
 * solo. Se elige cuántos jugadores, el guion (los que son para ese número: No
 * Greater Joy con 5 o 6, Trouble Brewing con 7 o más) y qué narrador (los que aún
 * no se pueden elegir salen desactivados, con el motivo). Al añadirlo, prepara la
 * mesa y espera a que se llene. Al abrirse, el foco va al título.
 */
const DialogoNarradorVirtual = ({ sentados, noDisponible = {}, pedir, onCerrar }: DialogoNarradorVirtualProps) => {
  const elegible = (n: (typeof NARRADORES_VIRTUALES)[number]) => n.disponible && !noDisponible[n.id];
  const [jugadores, setJugadores] = useState(Math.min(max, Math.max(min, sentados)));
  const guiones = guionesParaJugadores(jugadores);
  const [guionElegido, setGuion] = useState<GuionNarradorVirtual>(guiones[0].id);
  // Al cambiar los jugadores, si el elegido ya no vale, el primero de los que valen
  const guion = guiones.some((g) => g.id === guionElegido) ? guionElegido : guiones[0].id;
  const [narrador, setNarrador] = useState<IdNarradorVirtual>(NARRADORES_VIRTUALES.find(elegible)!.id);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ariaLive = useAriaLive('errores');

  const anadir = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    const r = await pedir('sala:anadirNarradorVirtual', { narrador, guion, jugadores });
    setEnviando(false);
    if (r.ok) onCerrar();
    else setError(r.error);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-virtual-titulo"
        describedBy="sala-virtual-texto"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto sala-cofre sala-cofre-esquinas p-6"
      >
        <form onSubmit={(e) => void anadir(e)} className="flex flex-col gap-4" noValidate>
          <h2 id="sala-virtual-titulo" className="sala-cofre-titulo">
            Añadir narrador virtual
          </h2>
          <p id="sala-virtual-texto" className="text-sm text-on-surface-muted">
            Lleva la partida solo: prepara la mesa, espera a que se llene, reparte y narra las noches y los días.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="sala-virtual-jugadores" className="font-ui text-xs">
              Jugadores
            </label>
            <select
              id="sala-virtual-jugadores"
              value={jugadores}
              onChange={(e) => setJugadores(Number(e.target.value))}
              aria-describedby={sentados > min ? 'sala-virtual-sentados' : undefined}
              className={`${campo} text-sm`}
            >
              {NUMEROS.map((n) => (
                <option key={n} value={n} disabled={n < sentados}>
                  {n}
                </option>
              ))}
            </select>
            {sentados > min && (
              <p id="sala-virtual-sentados" className="text-xs text-on-surface-muted">
                Ya hay {sentados} sentados: como poco, {sentados}.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sala-virtual-guion" className="font-ui text-xs">
              Guion
            </label>
            <select
              id="sala-virtual-guion"
              value={guion}
              onChange={(e) => setGuion(e.target.value as GuionNarradorVirtual)}
              aria-describedby="sala-virtual-guion-ayuda"
              className={`${campo} text-sm`}
            >
              {guiones.map((g) => (
                <option key={g.id} value={g.id} lang="en">
                  {g.nombre}
                </option>
              ))}
            </select>
            <p id="sala-virtual-guion-ayuda" className="text-xs text-on-surface-muted">
              Con 5 o 6 jugadores, No Greater Joy; con 7 o más, Trouble Brewing.
            </p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-ui text-xs">Narrador</legend>
            {NARRADORES_VIRTUALES.map((n) => {
              const motivo = n.disponible ? noDisponible[n.id] : undefined;
              return (
                <label key={n.id} className={`flex items-start gap-2 text-sm ${elegible(n) ? 'cursor-pointer' : 'text-on-surface-muted'}`}>
                  <input
                    type="radio"
                    name="sala-virtual-narrador"
                    value={n.id}
                    checked={narrador === n.id}
                    disabled={!elegible(n)}
                    aria-describedby={motivo ? `sala-virtual-motivo-${n.id}` : undefined}
                    onChange={() => setNarrador(n.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">{n.nombre}</span>
                    <span className="block text-xs text-on-surface-muted">{n.descripcion}</span>
                    {motivo && (
                      <span id={`sala-virtual-motivo-${n.id}`} className="block text-xs text-on-surface-muted">
                        {motivo}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div aria-live={ariaLive}>{error && <p className="text-sm text-blood-pale">{error}</p>}</div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
              Añadir narrador virtual
            </button>
          </div>
        </form>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoNarradorVirtual;
