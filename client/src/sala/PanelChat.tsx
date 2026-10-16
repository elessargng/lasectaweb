import { MessagesSquare, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { useAriaLive } from './avisosConfig';
import { botonIcono } from './estilos';
import {
  CANAL_GENERAL,
  CANAL_SUSURROS,
  CANAL_VISITANTES,
  canalesComunes,
  deQuienAQuien,
  esPrivado,
  LARGO_MAXIMO_MENSAJE,
  mensajesDe,
  nombreCanal,
  sinLeerDe,
  otroDelPrivado,
  privadosPropios,
  type SalaMensaje,
} from './chat';
import type { SalaEstado, SalaParticipante, SalaResultado } from './useSala';

interface PanelChatProps {
  estado: SalaEstado;
  yo: SalaParticipante;
  mensajes: SalaMensaje[];
  /** La conversación que se ve (un canal), o null: la primera. */
  activo: string | null;
  /** Conversaciones privadas abiertas aunque aún no tengan mensajes. */
  abiertos: string[];
  /** Hasta cuándo (ms) se ha leído cada canal: lo que llegue después cuenta como sin leer. */
  leidoHasta: Record<string, number>;
  onElegir: (canal: string) => void;
  onEnviar: (para: string, texto: string) => Promise<SalaResultado>;
  /** El campo de escribir: quien abre una conversación le lleva el foco. */
  entradaRef: RefObject<HTMLInputElement | null>;
}

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

/**
 * Colores para el nombre de cada autor en los chats de grupo, de la paleta de La
 * Secta (claros, para leerse sobre las burbujas de tinta): lavanda del grimorio,
 * latón, salvia, lacre claro, azul aldeano, ámbar, malva y verde agua.
 */
const COLORES_AUTOR = ['#b9acee', '#ecd29a', '#a9cfa9', '#f0a0a5', '#8dbbec', '#eab07a', '#d7a6dc', '#8fd0c6'];
function colorDeAutor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_AUTOR[h % COLORES_AUTOR.length];
}

/** Dos mensajes seguidos de la misma persona (a quien sea, en menos de 5 minutos) van juntos, sin repetir nombre. */
const vaJunto = (m: SalaMensaje, anterior: SalaMensaje | undefined) =>
  !!anterior && anterior.autor === m.autor && anterior.canal === m.canal && m.hora - anterior.hora < 5 * 60 * 1000;

/**
 * A la izquierda de la sala: los mensajes de texto. Una pestaña por conversación
 * (General para jugadores, Visitantes para visitantes, las dos para los
 * narradores, y las privadas), con los que no se han leído; debajo, los
 * mensajes de la elegida y el campo para escribir. Los narradores tienen además
 * Susurros: todos los privados entre jugadores, juntos y solo para leer.
 *
 * Pestañas como manda ARIA: las flechas van de una a otra y Tab entra en los
 * mensajes. Los mensajes que llegan se anuncian aparte (avisos de la sala),
 * no con una región viva aquí, para no leerlos dos veces.
 */
const PanelChat = ({
  estado,
  yo,
  mensajes,
  activo,
  abiertos,
  leidoHasta,
  onElegir,
  onEnviar,
  entradaRef,
}: PanelChatProps) => {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<HTMLOListElement>(null);
  const ariaLive = useAriaLive('errores');

  // Conversaciones: las comunes de su papel y las privadas (con mensajes o abiertas)
  const privados = privadosPropios(mensajes, abiertos, yo.id);
  const canales = [...canalesComunes(yo), ...privados];
  const actual = activo && canales.includes(activo) ? activo : canales[0];
  const delActual = mensajesDe(mensajes, actual, yo.id);
  const susurros = actual === CANAL_SUSURROS;
  const nombre = (canal: string) => nombreCanal(canal, yo.id, estado.participantes, mensajes);
  // La conversación que se ve no tiene pendientes
  const sinLeer = (canal: string) => (canal === actual ? 0 : sinLeerDe(mensajes, canal, yo.id, leidoHasta));
  const idPestana = (canal: string) => `sala-chat-pestana-${canal.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  // Al llegar mensajes (o cambiar de conversación), se ve el último
  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [actual, delActual.length]);

  // Flechas, Inicio y Fin entre pestañas (y la elegida es la que tiene el foco)
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = canales.indexOf(actual);
    const destinos: Record<string, number> = {
      ArrowRight: (i + 1) % canales.length,
      ArrowLeft: (i - 1 + canales.length) % canales.length,
      Home: 0,
      End: canales.length - 1,
    };
    if (!(e.key in destinos)) return;
    e.preventDefault();
    const canal = canales[destinos[e.key]];
    onElegir(canal);
    window.setTimeout(() => document.getElementById(idPestana(canal))?.focus(), 0);
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || !texto.trim()) return;
    setEnviando(true);
    setError('');
    const para = esPrivado(actual) ? (otroDelPrivado(actual, yo.id) ?? '') : actual;
    const r = await onEnviar(para, texto);
    setEnviando(false);
    if (r.ok) setTexto('');
    else setError(r.error);
  };

  const otro = esPrivado(actual) ? estado.participantes.find((p) => p.id === otroDelPrivado(actual, yo.id)) : null;
  const sinDestino = esPrivado(actual) && !otro;

  return (
    <section aria-labelledby="sala-chat-titulo" className="flex h-full w-full flex-col">
      <h2 id="sala-chat-titulo" className="px-3 pt-3 rotulo">
        Mensajes
      </h2>
      <div className="flex min-h-0 flex-1 flex-col">
        <div role="tablist" aria-label="Conversaciones" className="flex flex-wrap gap-1 border-b border-gold/15 px-2 py-2">
          {canales.map((canal) => {
            const elegida = canal === actual;
            const pendientes = sinLeer(canal);
            return (
              <button
                key={canal}
                id={idPestana(canal)}
                type="button"
                role="tab"
                aria-selected={elegida}
                aria-controls="sala-chat-panel"
                tabIndex={elegida ? 0 : -1}
                onClick={() => onElegir(canal)}
                onKeyDown={alTeclear}
                className={`max-w-[10rem] truncate rounded-full border px-2.5 py-1 font-ui text-xs tracking-wide transition-colors motion-reduce:transition-none ${
                  elegida
                    ? 'border-gold/60 bg-theme-container font-semibold text-gold-bright'
                    : 'border-transparent text-on-surface-muted hover:border-gold/25 hover:text-on-surface'
                }`}
              >
                {nombre(canal)}
                {pendientes > 0 && (
                  <span className="sala-contador ml-1 rounded-full px-1.5 text-[0.65rem] font-bold">
                    {pendientes}
                    <span className="sr-only"> sin leer</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div id="sala-chat-panel" role="tabpanel" aria-labelledby={idPestana(actual)} className="flex min-h-0 flex-1 flex-col">
          {/* Las burbujas, como en un móvil: las propias a la derecha (morado del grimorio, con
              filo de latón), las de los demás a la izquierda (tinta), con un piquito en la
              primera de cada tanda */}
          <ol
            ref={listaRef}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background/70 px-3 py-2 text-[0.95rem]"
            style={{
              backgroundImage: 'radial-gradient(rgba(212,175,106,0.05) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
            }}
          >
            {delActual.length === 0 ? (
              // Vacía: como los demás paneles sin nada (el círculo es decoración: no se lee)
              <li className="m-auto flex flex-col items-center gap-3 px-4 py-6 text-center">
                <span
                  aria-hidden="true"
                  className="sala-medallon-vacio"
                >
                  <MessagesSquare size={28} strokeWidth={1.25} />
                </span>
                <p className="font-display text-lg text-on-surface-bright">Todavía no hay mensajes</p>
                <p className="max-w-[15rem] text-xs leading-relaxed text-on-surface-muted">
                  {susurros
                    ? 'Aquí aparecerá lo que los jugadores se escriban en privado.'
                    : actual === CANAL_GENERAL
                      ? 'Sé el primero en escribir a la mesa.'
                      : actual === CANAL_VISITANTES
                        ? 'Sé el primero en escribir a los demás visitantes.'
                        : otro
                          ? `Empieza la conversación con ${otro.nombre}.`
                          : 'Esta conversación está vacía.'}
                </p>
              </li>
            ) : (
              delActual.map((m, i) => {
                const propio = m.autor === yo.id;
                const junto = vaJunto(m, delActual[i - 1]);
                // En los grupos, el nombre (con su color) en la primera de cada tanda; en privado no hace
                // falta. En Susurros, quién a quién.
                const conNombre = !propio && !junto && !esPrivado(actual);
                const quien = susurros ? deQuienAQuien(m, estado.participantes, mensajes) : m.autorNombre;
                return (
                  <li key={m.id} className={`flex ${propio ? 'justify-end' : 'justify-start'} ${junto ? 'mt-0.5' : 'mt-2'}`}>
                    <div
                      className={`relative max-w-[85%] rounded-lg border px-2.5 pb-1 pt-1.5 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.8)] ${
                        propio
                          ? 'border-gold/25 bg-theme-container text-on-surface-bright'
                          : 'border-outline-ghost bg-surface-high text-on-surface'
                      } ${!junto ? (propio ? 'rounded-tr-none' : 'rounded-tl-none') : ''}`}
                    >
                      {!junto && (
                        // Piquito de la burbuja, hacia quien habla
                        <span
                          aria-hidden="true"
                          className={`absolute -top-px h-2.5 w-2.5 ${propio ? '-right-2 bg-theme-container' : '-left-2 bg-surface-high'}`}
                          style={{ clipPath: propio ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)' }}
                        />
                      )}
                      {conNombre ? (
                        <p className="font-ui text-xs font-semibold tracking-wide" style={{ color: colorDeAutor(m.autor) }}>
                          {quien}
                        </p>
                      ) : (
                        // Para el lector, siempre quién lo dice (a la vista lo dicen el lado y la tanda)
                        <span className="sr-only">{propio ? 'Tú' : quien}: </span>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-snug">
                        {m.texto}
                        {/* La hora, abajo a la derecha dentro de la burbuja */}
                        <time
                          dateTime={new Date(m.hora).toISOString()}
                          className={`float-right ml-2 mt-1 translate-y-0.5 text-[0.65rem] ${propio ? 'text-grimorio-bright' : 'text-on-surface-muted'}`}
                        >
                          <span className="sr-only">, </span>
                          {hora(m.hora)}
                        </time>
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ol>
          {susurros ? (
            <p className="border-t border-gold/15 bg-surface p-2 text-xs text-on-surface-muted">
              Los mensajes privados entre jugadores. Solo para leer: no se puede escribir aquí.
            </p>
          ) : (
            <form onSubmit={enviar} className="flex flex-col gap-1 border-t border-gold/15 bg-surface p-2">
              <label htmlFor="sala-chat-texto" className="sr-only">
                Mensaje para {nombre(actual)}
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={entradaRef}
                  id="sala-chat-texto"
                  type="text"
                  value={texto}
                  maxLength={LARGO_MAXIMO_MENSAJE}
                  autoComplete="off"
                  disabled={sinDestino}
                  placeholder={sinDestino ? 'Ya no está en la sala' : `Mensaje para ${nombre(actual)}`}
                  onChange={(e) => setTexto(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'sala-chat-error' : undefined}
                  className="campo min-w-0 flex-1 rounded-full! px-4! py-2!"
                />
                <button
                  type="submit"
                  aria-label="Enviar"
                  aria-disabled={enviando || sinDestino}
                  className={botonIcono}
                >
                  <SendHorizontal size={18} />
                </button>
              </div>
              <div aria-live={ariaLive}>
                {error && (
                  <p id="sala-chat-error" className="text-xs text-blood-pale">
                    {error}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default PanelChat;
