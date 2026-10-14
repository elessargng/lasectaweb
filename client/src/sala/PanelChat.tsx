import { SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { useAriaLive } from './avisosConfig';
import { canalesComunes, esPrivado, LARGO_MAXIMO_MENSAJE, nombreCanal, otroDelPrivado, type SalaMensaje } from './chat';
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
 * Secta (claros, para leerse sobre las burbujas oscuras): lavanda, oro viejo,
 * salvia, rosa antiguo, azul acero, ámbar, malva y verde agua.
 */
const COLORES_AUTOR = ['#c9b6ec', '#d9b45a', '#9fc7a4', '#e3a1b4', '#9db8e0', '#e8a96b', '#d79fd8', '#86c9c1'];
function colorDeAutor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_AUTOR[h % COLORES_AUTOR.length];
}

/** Dos mensajes seguidos de la misma persona (en menos de 5 minutos) van juntos, sin repetir nombre. */
const vaJunto = (m: SalaMensaje, anterior: SalaMensaje | undefined) =>
  !!anterior && anterior.autor === m.autor && m.hora - anterior.hora < 5 * 60 * 1000;

/**
 * A la izquierda de la sala: los mensajes de texto. Una pestaña por conversación
 * (General para jugadores, Visitantes para visitantes, las dos para los
 * narradores, y las privadas), con los que no se han leído; debajo, los
 * mensajes de la elegida y el campo para escribir.
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
  const privados = [...new Set([...mensajes.map((m) => m.canal).filter(esPrivado), ...abiertos])];
  const canales = [...canalesComunes(yo), ...privados];
  const actual = activo && canales.includes(activo) ? activo : canales[0];
  const delActual = mensajes.filter((m) => m.canal === actual);
  const nombre = (canal: string) => nombreCanal(canal, yo.id, estado.participantes, mensajes);
  const sinLeer = (canal: string) =>
    canal === actual ? 0 : mensajes.filter((m) => m.canal === canal && m.autor !== yo.id && m.hora > (leidoHasta[canal] ?? 0)).length;
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
    <section
      aria-labelledby="sala-chat-titulo"
      className="flex h-[26rem] w-full flex-col rounded border border-outline-ghost bg-surface"
    >
      <h2 id="sala-chat-titulo" className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-theme-main">
        Mensajes
      </h2>
      <div role="tablist" aria-label="Conversaciones" className="flex flex-wrap gap-1 border-b border-outline-ghost px-2 py-2">
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
              className={`max-w-[10rem] truncate rounded px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
                elegida ? 'bg-theme-container font-semibold text-white' : 'text-on-surface-muted hover:bg-theme-container/40'
              }`}
            >
              {nombre(canal)}
              {pendientes > 0 && (
                <span className="ml-1 rounded-full bg-theme-main px-1.5 text-[0.65rem] font-bold text-background">
                  {pendientes}
                  <span className="sr-only"> sin leer</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div id="sala-chat-panel" role="tabpanel" aria-labelledby={idPestana(actual)} className="flex min-h-0 flex-1 flex-col">
        {/* Las burbujas, como en un móvil: las propias a la derecha (morado), las de los
            demás a la izquierda (gris cálido), con un piquito en la primera de cada tanda */}
        <ol
          ref={listaRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0f0d12] px-3 py-2 text-sm"
          style={{
            backgroundImage: 'radial-gradient(rgba(177,156,217,0.06) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        >
          {delActual.length === 0 ? (
            <li className="m-auto rounded-full bg-surface px-3 py-1 text-xs text-on-surface-muted">Todavía no hay mensajes.</li>
          ) : (
            delActual.map((m, i) => {
              const propio = m.autor === yo.id;
              const junto = vaJunto(m, delActual[i - 1]);
              // En los grupos, el nombre (con su color) en la primera de cada tanda; en privado no hace falta
              const conNombre = !propio && !junto && !esPrivado(actual);
              return (
                <li key={m.id} className={`flex ${propio ? 'justify-end' : 'justify-start'} ${junto ? 'mt-0.5' : 'mt-2'}`}>
                  <div
                    className={`relative max-w-[85%] rounded-lg px-2.5 pb-1 pt-1.5 shadow-sm ${
                      propio ? 'bg-[#4a3b69] text-[#f1ecfa]' : 'bg-[#26222b] text-on-surface'
                    } ${!junto ? (propio ? 'rounded-tr-none' : 'rounded-tl-none') : ''}`}
                  >
                    {!junto && (
                      // Piquito de la burbuja, hacia quien habla
                      <span
                        aria-hidden="true"
                        className={`absolute top-0 h-2.5 w-2.5 ${propio ? '-right-2 bg-[#4a3b69]' : '-left-2 bg-[#26222b]'}`}
                        style={{ clipPath: propio ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(0 0, 100% 0, 100% 100%)' }}
                      />
                    )}
                    {conNombre ? (
                      <p className="text-xs font-semibold" style={{ color: colorDeAutor(m.autor) }}>
                        {m.autorNombre}
                      </p>
                    ) : (
                      // Para el lector, siempre quién lo dice (a la vista lo dicen el lado y la tanda)
                      <span className="sr-only">{propio ? 'Tú' : m.autorNombre}: </span>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-snug">
                      {m.texto}
                      {/* La hora, abajo a la derecha dentro de la burbuja */}
                      <time
                        dateTime={new Date(m.hora).toISOString()}
                        className={`float-right ml-2 mt-1 translate-y-0.5 text-[0.65rem] ${propio ? 'text-[#c9b6ec]' : 'text-on-surface-muted'}`}
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
        <form onSubmit={enviar} className="flex flex-col gap-1 border-t border-outline-ghost bg-surface p-2">
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
              className="min-w-0 flex-1 rounded-full border border-outline-ghost bg-[#26222b] px-4 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
            />
            <button
              type="submit"
              aria-label="Enviar"
              aria-disabled={enviando || sinDestino}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4a3b69] text-[#f1ecfa] hover:bg-theme-main hover:text-background focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-disabled:opacity-50"
            >
              <SendHorizontal size={18} />
            </button>
          </div>
          <div aria-live={ariaLive}>
            {error && (
              <p id="sala-chat-error" className="text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
};

export default PanelChat;
