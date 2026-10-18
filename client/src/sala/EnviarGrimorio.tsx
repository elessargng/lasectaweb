import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import DialogoPersonaje from './DialogoPersonaje';
import DialogoRecordatorio from './DialogoRecordatorio';
import Interruptor from './Interruptor';
import MiniGrimorio, { nombresDeAsientos } from './MiniGrimorio';
import { nombreDeAsiento } from './despertar';
import { botonIcono, botonPrincipal, botonSecundario } from './estilos';
import { alineamientoDe, describirRecordatorio, RECORDATORIO_TEXTO, useFichas } from './fichas';
import type { SalaAlineamiento, SalaEstado, SalaFichaEnviada, SalaRecordatorio, SalaResultado } from './useSala';

/** Los personajes que ven el grimorio del narrador: se les envía desde su despertar. */
export const PERSONAJES_GRIMORIO = ['spy', 'widow'];

/** Una copia del grimorio de ahora, tal como lo ve el narrador. */
const copiaDelGrimorio = (estado: SalaEstado): SalaFichaEnviada[] =>
  estado.asientos.map((a) => ({
    asientoId: a.id,
    personaje: a.personaje,
    alineamiento: a.alineamiento,
    muerto: a.muerto,
    recordatorios: a.recordatorios ?? [],
  }));

interface EnviarGrimorioProps {
  estado: SalaEstado;
  /** El asiento al que se envía (quien se sienta en él lo verá). */
  destino: string;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Se ha enviado: lo que se anuncia. */
  onEnviado: (texto: string) => void;
  onCerrar: () => void;
}

/**
 * Enviar el grimorio al Espía o a la Viuda: un minigrimorio con la copia del de
 * ahora que el narrador puede cambiar antes de enviarlo (solo cambia lo que se
 * envía, no la partida). Se elige una ficha y, al lado, se le cambia el
 * personaje, el alineamiento, si está muerto y sus recordatorios (pulsar uno lo
 * quita). También van los faroles del demonio (los de ahora), que se pueden
 * quitar o cambiar. «Enviar» se lo manda a quien se sienta en ese asiento.
 *
 * Elegir personaje o recordatorio abre su diálogo en lugar de este (un diálogo
 * modal cada vez); al cerrarlo se vuelve aquí, al mismo sitio.
 */
const EnviarGrimorio = ({ estado, destino, pedir, onEnviado, onCerrar }: EnviarGrimorioProps) => {
  const { personajes, viajeros, todos, todosPorId } = useFichas();
  // La copia, de cuando se abre (si la partida cambia mientras, no se pisa lo editado)
  const [copia] = useState(() => copiaDelGrimorio(estado));
  const [nombres] = useState(() => nombresDeAsientos(estado));
  const nombreDestino = nombreDeAsiento(estado, destino);
  const [fichas, setFichas] = useState(copia);
  const [elegida, setElegida] = useState<string | null>(copia[0]?.asientoId ?? null);
  const [eligiendo, setEligiendo] = useState<'personaje' | 'recordatorio' | null>(null);
  // Los faroles de la copia; y cuál se está eligiendo (su posición, o una nueva al final)
  const [farolesCopia] = useState(() => estado.faroles.filter((id): id is string => !!id && todosPorId.has(id)));
  const [faroles, setFaroles] = useState(farolesCopia);
  const [eligiendoFarol, setEligiendoFarol] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const volverRef = useRef<HTMLButtonElement>(null);
  const venimosDe = useRef<'personaje' | 'recordatorio' | null>(null);

  // Al volver de elegir, el foco al botón de lo que se estaba cambiando
  useEffect(() => {
    if (eligiendo === null && venimosDe.current) {
      volverRef.current?.focus();
      venimosDe.current = null;
    }
  }, [eligiendo]);

  const ficha = fichas.find((f) => f.asientoId === elegida) ?? null;
  const numero = ficha ? fichas.indexOf(ficha) + 1 : 0;
  const nombreFicha = ficha ? `asiento ${numero} (${nombres[ficha.asientoId] ?? ''})` : '';
  const personaje = ficha?.personaje ? todosPorId.get(ficha.personaje) : undefined;
  const cambiar = (cambio: Partial<SalaFichaEnviada>) =>
    setFichas((fs) => fs.map((f) => (f.asientoId === elegida ? { ...f, ...cambio } : f)));
  const ponerRecordatorio = (r: Omit<SalaRecordatorio, 'id'>) =>
    setFichas((fs) =>
      fs.map((f) => (f.asientoId === elegida ? { ...f, recordatorios: [...f.recordatorios, { id: crypto.randomUUID(), ...r }] } : f)),
    );
  const quitarRecordatorio = (asientoId: string, r: SalaRecordatorio) =>
    setFichas((fs) => fs.map((f) => (f.asientoId === asientoId ? { ...f, recordatorios: f.recordatorios.filter((x) => x.id !== r.id) } : f)));
  const elegir = (que: 'personaje' | 'recordatorio') => {
    venimosDe.current = que;
    setEligiendo(que);
  };

  const enviar = async () => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    const r = await pedir('narrador:enviarGrimorio', { asientoId: destino, fichas, faroles });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onEnviado(`Grimorio enviado a ${nombreDestino}.`);
    onCerrar();
  };

  if (eligiendoFarol !== null) {
    return (
      <DialogoPersonaje
        ficha={`farol ${eligiendoFarol + 1}`}
        titulo="Elegir farol"
        personajes={personajes}
        actual={faroles[eligiendoFarol] ?? null}
        onElegir={(id) =>
          setFaroles((fs) => (id ? Object.assign([...fs], { [eligiendoFarol]: id }) : fs.filter((_, i) => i !== eligiendoFarol)))
        }
        onCerrar={() => setEligiendoFarol(null)}
      />
    );
  }
  if (eligiendo === 'personaje' && ficha) {
    return (
      <DialogoPersonaje
        ficha={nombreFicha}
        personajes={personajes}
        viajeros={viajeros}
        actual={ficha.personaje}
        onElegir={(id) => cambiar({ personaje: id, alineamiento: null })}
        onCerrar={() => setEligiendo(null)}
      />
    );
  }
  if (eligiendo === 'recordatorio' && ficha) {
    const enCopia = new Set(fichas.map((f) => f.personaje).filter(Boolean));
    return (
      <DialogoRecordatorio
        ficha={nombreFicha}
        enJuego={todos.filter((p) => enCopia.has(p.id))}
        otros={todos.filter((p) => !enCopia.has(p.id))}
        onElegir={(p, indice) => ponerRecordatorio({ personaje: p.id, indice, texto: p.recordatorios[indice]?.texto ?? '' })}
        onTexto={(texto, icono) => ponerRecordatorio({ personaje: RECORDATORIO_TEXTO, indice: -1, texto, icono })}
        onCerrar={() => setEligiendo(null)}
      />
    );
  }

  const alineamiento: SalaAlineamiento | null = personaje ? alineamientoDe(personaje, ficha!.alineamiento) : (ficha?.alineamiento ?? null);
  const boton = (que: 'personaje' | 'recordatorio') => (venimosDe.current === que ? volverRef : undefined);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-enviar-grimorio-titulo"
        describedBy="sala-enviar-grimorio-ayuda"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col sala-cofre sala-cofre-esquinas"
      >
        <div className="flex items-center gap-3 px-6 pt-4">
          <h2 id="sala-enviar-grimorio-titulo" className="flex-1 sala-cofre-titulo">
            Enviar grimorio <span className="font-ui text-base font-normal text-on-surface-muted">a {nombreDestino}</span>
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className={`${botonIcono} h-8 w-8 shrink-0`}>
            <X size={16} />
          </button>
        </div>
        <p id="sala-enviar-grimorio-ayuda" className="px-6 pb-2 pt-1 text-sm text-on-surface-muted">
          Es una copia del grimorio de ahora. Lo que cambies aquí solo cambia lo que verá; la partida sigue igual.
        </p>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-2 md:grid-cols-[1fr_17rem]">
          <MiniGrimorio
            fichas={fichas}
            faroles={faroles}
            nombres={nombres}
            elegida={elegida}
            onElegir={setElegida}
            onQuitarRecordatorio={quitarRecordatorio}
          />
          {/* Lo que se cambia de la ficha elegida */}
          <section aria-labelledby="sala-enviar-grimorio-ficha" className="flex flex-col gap-3 self-start rounded border border-outline-ghost bg-background/40 p-4">
            {ficha ? (
              <>
                <h3 id="sala-enviar-grimorio-ficha" className="rotulo">
                  Asiento {numero} · {nombres[ficha.asientoId]}
                </h3>
                <p className="text-sm">
                  {personaje ? <span lang={personaje.nombre.lang}>{personaje.nombre.texto}</span> : <span className="text-on-surface-muted">Sin personaje</span>}
                </p>
                <div className="flex gap-2">
                  <button type="button" ref={boton('personaje')} onClick={() => elegir('personaje')} className={`${botonSecundario} flex-1`}>
                    Cambiar personaje
                  </button>
                  {/* Una ficha vacía: sin personaje, alineamiento ni recordatorios */}
                  <button
                    type="button"
                    onClick={() => cambiar({ personaje: null, alineamiento: null, recordatorios: [] })}
                    aria-disabled={(!ficha.personaje && !ficha.alineamiento && ficha.recordatorios.length === 0) || undefined}
                    className={botonSecundario}
                  >
                    Vaciar ficha
                  </button>
                </div>
                <fieldset className="flex gap-2">
                  <legend className="mb-1 text-xs text-on-surface-muted">Alineamiento</legend>
                  {(['bueno', 'malvado'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={alineamiento === a}
                      onClick={() => cambiar({ alineamiento: a })}
                      className={`${botonSecundario} flex-1 aria-pressed:border-gold aria-pressed:text-gold-bright`}
                    >
                      {a === 'bueno' ? 'Bueno' : 'Malvado'}
                    </button>
                  ))}
                </fieldset>
                <Interruptor activo={ficha.muerto} onCambiar={(muerto) => cambiar({ muerto })}>
                  Muerto
                </Interruptor>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-on-surface-muted">Recordatorios</span>
                  {ficha.recordatorios.length === 0 ? (
                    <span className="text-sm text-on-surface-muted">Ninguno</span>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {ficha.recordatorios.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">{describirRecordatorio(r, todosPorId.get(r.personaje))}</span>
                          <button
                            type="button"
                            onClick={() => quitarRecordatorio(ficha.asientoId, r)}
                            aria-label={`Quitar ${describirRecordatorio(r, todosPorId.get(r.personaje))}`}
                            className="rounded p-0.5 text-on-surface-muted hover:text-blood-pale focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" ref={boton('recordatorio')} onClick={() => elegir('recordatorio')} className={`${botonSecundario} mt-1`}>
                    Poner recordatorio
                  </button>
                </div>
              </>
            ) : (
              <p id="sala-enviar-grimorio-ficha" className="text-sm text-on-surface-muted">
                Elige una ficha para cambiarla.
              </p>
            )}
          </section>
          {/* Los faroles del demonio: van en el centro del grimorio que se envía */}
          <section aria-labelledby="sala-enviar-grimorio-faroles" className="flex flex-col gap-2 self-start rounded border border-outline-ghost bg-background/40 p-4 md:col-start-2">
            <h3 id="sala-enviar-grimorio-faroles" className="rotulo">
              Faroles
            </h3>
            {faroles.length === 0 ? (
              <span className="text-sm text-on-surface-muted">Ninguno</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {faroles.map((id, i) => {
                  const p = todosPorId.get(id);
                  return (
                    <li key={`${id}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                      <button type="button" onClick={() => setEligiendoFarol(i)} className="min-w-0 truncate text-left hover:text-gold-bright" aria-label={`Cambiar el farol ${p?.nombre.texto ?? id}`}>
                        <span lang={p?.nombre.lang}>{p?.nombre.texto ?? id}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFaroles((fs) => fs.filter((_, j) => j !== i))}
                        aria-label={`Quitar el farol ${p?.nombre.texto ?? id}`}
                        className="rounded p-0.5 text-on-surface-muted hover:text-blood-pale focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
                      >
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {faroles.length < estado.faroles.length && (
              <button type="button" onClick={() => setEligiendoFarol(faroles.length)} className={`${botonSecundario} mt-1`}>
                Poner farol
              </button>
            )}
          </section>
        </div>
        {error && (
          <p role="alert" className="px-6 pt-2 text-sm text-blood-pale">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3 sala-cofre-pie px-6 py-3">
          <button
            type="button"
            onClick={() => {
              setFichas(copia);
              setFaroles(farolesCopia);
            }}
            className={`${botonSecundario} mr-auto`}
          >
            Volver a la copia
          </button>
          <button type="button" onClick={() => void enviar()} aria-disabled={enviando || undefined} className={botonPrincipal}>
            <Send size={16} />
            Enviar
          </button>
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default EnviarGrimorio;
