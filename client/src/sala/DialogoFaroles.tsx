import { X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonSecundario } from './estilos';
import { TIPOS_REPARTO, useFichas } from './fichas';
import type { PersonajeMostrado } from './guiones';
import CasillaFarol from './CasillaFarol';
import RejillaFichas from './RejillaFichas';
import type { SalaAsiento, SalaResultado } from './useSala';

interface DialogoFarolesProps {
  /** Los faroles del narrador (3 casillas). */
  faroles: (string | null)[];
  /** La bolsa y las fichas de la mesa: lo que está en juego («asignado»). */
  bolsa: string[];
  asientos: SalaAsiento[];
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

/**
 * Asignar los faroles del demonio (narradores), con las fichas de la bolsa:
 * arriba las 3 casillas (pulsar una la vacía); debajo, los personajes por tipos.
 * Pulsar uno lo pone en la primera casilla libre, o lo quita si ya es farol.
 *
 * El interruptor «Solo roles sin asignar» (activado al abrir) deja solo los que
 * no están en la bolsa ni en ninguna ficha; desactivado, salen todos y los que
 * están en juego llevan el sello «Asignado» (se pueden elegir igual).
 */
const DialogoFaroles = ({ faroles, bolsa, asientos, pedir, onCerrar }: DialogoFarolesProps) => {
  const { personajes, todosPorId } = useFichas();
  const [soloSinAsignar, setSoloSinAsignar] = useState(true);
  const [error, setError] = useState('');
  const ariaLiveErrores = useAriaLive('errores');

  const asignados = new Set([...bolsa, ...asientos.flatMap((a) => (a.personaje ? [a.personaje] : []))]);
  const llenas = faroles.every(Boolean);

  const poner = async (posicion: number, personajeId: string | null) => {
    setError('');
    const r = await pedir('narrador:farol', { posicion, personajeId });
    if (!r.ok) setError(r.error);
  };

  const pulsar = (p: PersonajeMostrado) => {
    const ya = faroles.indexOf(p.id);
    if (ya >= 0) return void poner(ya, null);
    const libre = faroles.indexOf(null);
    if (libre < 0) return setError('Ya hay 3 faroles: quita uno antes.');
    void poner(libre, p.id);
  };

  const grupos = TIPOS_REPARTO.map(({ tipo, nombre, color }) => ({
    tipo,
    color,
    titulo: nombre,
    personajes: personajes.filter((p) => p.tipo === tipo && !(soloSinAsignar && asignados.has(p.id) && !faroles.includes(p.id))),
  }));
  const vacia = grupos.every((g) => g.personajes.length === 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-dialogo-faroles-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded border border-outline-ghost bg-surface shadow-2xl"
      >
        <h2 id="sala-dialogo-faroles-titulo" className="border-b border-outline-ghost px-6 py-4 text-xl font-semibold">
          Asignar faroles
        </h2>

        {/* Las 3 casillas: pulsar una con farol lo quita */}
        <div className="border-b border-outline-ghost bg-background/40 px-6 py-4">
          <h3 id="sala-dialogo-faroles-casillas" className="sr-only">
            Faroles elegidos
          </h3>
          <ul aria-labelledby="sala-dialogo-faroles-casillas" className="mx-auto grid max-w-sm grid-cols-3 gap-4">
            {faroles.map((id, i) => {
              const personaje = id ? todosPorId.get(id) : undefined;
              return (
                // Las casillas son fijas (la 1, la 2 y la 3): su clave es su posición
                <li key={i} className="flex min-w-0">
                  {personaje ? (
                    <button
                      type="button"
                      onClick={() => void poner(i, null)}
                      className="group relative flex w-full min-w-0 rounded-lg p-1 hover:bg-blood/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
                    >
                      <span className="sr-only">Quitar farol {i + 1}: </span>
                      <CasillaFarol personaje={personaje} />
                      <X
                        size={16}
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-on-surface-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                      />
                    </button>
                  ) : (
                    <span className="flex w-full min-w-0 p-1">
                      <span className="sr-only">Farol {i + 1}: </span>
                      <CasillaFarol personaje={undefined} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 pt-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              role="switch"
              checked={soloSinAsignar}
              onChange={(e) => setSoloSinAsignar(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-5 w-9 shrink-0 rounded-full border border-outline-ghost bg-background transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-on-surface-muted after:transition-transform peer-checked:border-theme-main peer-checked:bg-theme-container peer-checked:after:translate-x-4 peer-checked:after:bg-theme-main peer-focus-visible:ring-2 peer-focus-visible:ring-theme-main motion-reduce:transition-none motion-reduce:after:transition-none"
            />
            <span className="font-ui text-sm">Solo roles sin asignar</span>
          </label>
          <p className="text-sm text-on-surface-muted">
            <span className="tabular-nums">{faroles.filter(Boolean).length}</span> de 3
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {vacia ? (
            <p className="text-on-surface-muted">
              {personajes.length === 0 ? 'Antes hay que elegir un guion.' : 'Todos los personajes del guion están asignados.'}
            </p>
          ) : (
            <RejillaFichas
              idBase="sala-dialogo-faroles"
              grupos={grupos}
              marca={(p) => {
                const pulsada = faroles.includes(p.id);
                return { pulsada, asignada: asignados.has(p.id), bloqueada: llenas && !pulsada };
              }}
              onPulsar={pulsar}
            />
          )}
        </div>

        <div aria-live={ariaLiveErrores} className="px-6">
          {error && <p className="pb-3 text-sm text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end border-t border-outline-ghost px-6 py-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cerrar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoFaroles;
