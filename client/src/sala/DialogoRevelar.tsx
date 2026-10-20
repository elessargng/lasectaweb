import { useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { CAUSAS_FINAL } from './causasFinal';
import { botonSecundario, campo } from './estilos';
import { describirAsiento } from './nombresAsiento';
import { identidadDe, useFichas } from './fichas';
import Interruptor from './Interruptor';
import type { SalaAlineamiento, SalaEstado, SalaResultado } from './useSala';

interface DialogoRevelarProps {
  estado: SalaEstado;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

/**
 * Revelar el grimorio (final de la partida): primero, qué bando ha ganado y, de
 * los personajes en juego que pueden acabarla (o que conviene dejar dicho, ver
 * CAUSAS_FINAL), lo que ha pasado. Al elegir el bando, todas las fichas se dan la
 * vuelta y el narrador las va revelando; lo marcado se ve con el bando ganador.
 */
const DialogoRevelar = ({ estado, pedir, onCerrar }: DialogoRevelarProps) => {
  const { todosPorId } = useFichas();
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [causas, setCausas] = useState<string[]>([]);
  // Las causas de esbirro (la Doncel descubierta): qué esbirro fue (id de asiento)
  const [esbirros, setEsbirros] = useState<Record<string, string>>({});
  const ariaLive = useAriaLive('errores');

  // Los de la lista que están en juego: quien es de verdad cada uno (su «Is The …»)
  const enJuego = new Set(estado.asientos.map((a) => identidadDe(a).personaje));
  const posibles = CAUSAS_FINAL.filter((c) => enJuego.has(c.personaje));
  // Los asientos que son esbirros de verdad, para elegir cuál descubrió a la Doncel
  const asientosEsbirro = estado.asientos.flatMap((a, i) => {
    const quien = identidadDe(a).personaje;
    if (!quien || todosPorId.get(quien)?.tipo !== 'minion') return [];
    const ocupante = estado.participantes.find((p) => p.id === a.ocupante);
    return [{ id: a.id, texto: `${describirAsiento(i + 1, ocupante ?? null)}: ${todosPorId.get(quien)?.nombre.texto ?? quien}` }];
  });

  const elegir = async (ganador: SalaAlineamiento) => {
    if (enviando) return;
    const sinEsbirro = CAUSAS_FINAL.find((c) => c.esbirro && causas.includes(c.personaje) && !esbirros[c.personaje]);
    if (sinEsbirro) {
      setError('Elige qué esbirro descubrió a la Doncel.');
      document.getElementById(`sala-revelar-esbirro-${sinEsbirro.personaje}`)?.focus();
      return;
    }
    setEnviando(true);
    setError('');
    const r = await pedir('narrador:revelarGrimorio', {
      ganador,
      causas,
      esbirros: Object.fromEntries(Object.entries(esbirros).filter(([c]) => causas.includes(c))),
    });
    setEnviando(false);
    if (r.ok) onCerrar();
    else setError(r.error);
  };

  const bando = 'flex-1 rounded border-2 px-4 py-6 text-lg font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-revelar-titulo"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto sala-cofre sala-cofre-esquinas p-6"
      >
        <h2 id="sala-revelar-titulo" className="mb-2 sala-cofre-titulo">
          Revelar grimorio
        </h2>
        {posibles.length > 0 && (
          <fieldset className="mb-5 flex flex-col gap-3">
            <legend className="mb-1 font-ui text-sm font-semibold text-theme-main">¿Qué ha pasado?</legend>
            <p className="-mt-1 text-xs text-on-surface-muted">
              Lo que marques se verá con el bando ganador, al terminar de revelar.
            </p>
            {posibles.map((c) => {
              const p = todosPorId.get(c.personaje);
              const interruptor = (
                <Interruptor
                  key={c.personaje}
                  activo={causas.includes(c.personaje)}
                  onCambiar={(activo) =>
                    setCausas((cs) => (activo ? [...cs, c.personaje] : cs.filter((x) => x !== c.personaje)))
                  }
                  arriba
                  textoClassName="text-sm"
                >
                  <span lang={p?.nombre.lang} className="font-semibold">
                    {p?.nombre.texto ?? c.personaje}
                  </span>
                  : {c.texto.charAt(0).toLocaleLowerCase('es') + c.texto.slice(1)}
                  {!c.terminaPartida && <span className="text-on-surface-muted"> (no acaba la partida)</span>}
                </Interruptor>
              );
              // La Doncel: qué esbirro la descubrió (el logro es suyo)
              const elegirEsbirro = c.esbirro && causas.includes(c.personaje) && (
                <div className="ml-12 flex flex-col gap-1">
                  <label htmlFor={`sala-revelar-esbirro-${c.personaje}`} className="font-ui text-xs">
                    ¿Qué esbirro la descubrió?
                  </label>
                  <select
                    id={`sala-revelar-esbirro-${c.personaje}`}
                    value={esbirros[c.personaje] ?? ''}
                    onChange={(e) => setEsbirros((es) => ({ ...es, [c.personaje]: e.target.value }))}
                    aria-invalid={!!error && !esbirros[c.personaje]}
                    aria-describedby={error && !esbirros[c.personaje] ? 'sala-revelar-error' : undefined}
                    className={`${campo} text-sm`}
                  >
                    <option value="">Elige un esbirro</option>
                    {asientosEsbirro.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.texto}
                      </option>
                    ))}
                  </select>
                </div>
              );
              return elegirEsbirro ? (
                <div key={c.personaje} className="flex flex-col gap-2">
                  {interruptor}
                  {elegirEsbirro}
                </div>
              ) : (
                interruptor
              );
            })}
          </fieldset>
        )}
        <p className="mb-4 text-sm text-on-surface-muted">
          ¿Qué bando ha ganado? Todas las fichas se darán la vuelta y las irás revelando una a una.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void elegir('bueno')}
            aria-disabled={enviando}
            className={`${bando} border-good bg-good/20 text-good-bright hover:bg-good/35`}
          >
            Bando bueno
          </button>
          <button
            type="button"
            onClick={() => void elegir('malvado')}
            aria-disabled={enviando}
            className={`${bando} border-blood-bright bg-blood-deep/60 text-blood-pale hover:bg-blood-deep`}
          >
            Bando malvado
          </button>
        </div>
        <div aria-live={ariaLive}>{error && <p id="sala-revelar-error" className="mt-4 text-sm text-blood-pale">{error}</p>}</div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoRevelar;
