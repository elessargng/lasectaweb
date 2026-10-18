import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { botonPeligro, botonPrincipal, botonSecundario, campo } from './estilos';
import FichaRecordatorio from './FichaRecordatorio';
import { ICONO_LIBRE_INICIAL, ICONOS_LIBRES, RECORDATORIO_TEXTO_MAX } from './fichas';
import { porTipos, type PersonajeMostrado } from './guiones';

interface DialogoRecordatorioProps {
  /** «asiento 3 (Ana)». */
  ficha: string;
  /** Los personajes en juego (en alguna ficha) y los demás del guion. */
  enJuego: PersonajeMostrado[];
  otros: PersonajeMostrado[];
  /** De los en juego, los que solo lo están probablemente (salen marcados como «posible»). */
  probables?: Set<string>;
  onElegir: (personaje: PersonajeMostrado, indice: number) => void;
  onCerrar: () => void;
  /** Otro título (sin la ficha): «Matar de noche». */
  titulo?: string;
  /** Explicación bajo el título (qué hace elegir uno). */
  explicacion?: string;
  /** Un botón más en el pie, para seguir sin elegir ninguno («Matar sin recordatorio»). */
  sinRecordatorio?: { etiqueta: string; onElegir: () => void };
  /**
   * Con esto sale la pestaña «Texto propio»: un recordatorio con lo que se escriba
   * y el icono elegido (uno de ICONOS_LIBRES o un personaje en juego).
   */
  onTexto?: (texto: string, icono: string) => void;
}

type Pestana = 'enJuego' | 'otros' | 'texto';
const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'enJuego', etiqueta: 'En juego' },
  { id: 'otros', etiqueta: 'Otros personajes' },
  { id: 'texto', etiqueta: 'Texto propio' },
];

/** Lado de las fichas recordatorio en el diálogo (fijo: no depende de la mesa). */
const TAMANO = '4.5rem';

/**
 * Elegir una ficha recordatorio para poner junto a una ficha: de entrada, los
 * recordatorios de los personajes en juego; en la otra pestaña, los del resto
 * del guion. Por personaje (con su nombre de título), cada recordatorio es un
 * botón. Elegir uno lo pone y cierra el diálogo.
 *
 * Con `onTexto`, una pestaña más para escribir uno propio (corto: va en redondo
 * en una ficha pequeña), con la ficha tal como quedará mientras se escribe, y el
 * icono del centro: el logo de La Secta (de entrada), una pluma, un interrogante
 * o el de un personaje en juego. Si no hay ningún personaje (sin guion), se abre en esa.
 *
 * Pestañas como manda ARIA: las flechas van de una a otra y Tab entra en la lista.
 */
const DialogoRecordatorio = ({ ficha, enJuego, otros, probables, onElegir, onCerrar, titulo, explicacion, sinRecordatorio, onTexto }: DialogoRecordatorioProps) => {
  const pestanas = PESTANAS.filter((t) => t.id !== 'texto' || onTexto);
  const sinPersonajes = enJuego.length === 0 && otros.length === 0;
  const [pestana, setPestana] = useState<Pestana>(onTexto && sinPersonajes ? 'texto' : 'enJuego');
  const refs = useRef<Record<Pestana, HTMLButtonElement | null>>({ enJuego: null, otros: null, texto: null });
  const [texto, setTexto] = useState('');
  const [icono, setIcono] = useState<string>(ICONO_LIBRE_INICIAL);
  const conIcono = enJuego.filter((p) => p.icono);
  const personajeIcono = conIcono.find((p) => p.id === icono);
  const limpio = texto.replace(/\s+/g, ' ').trim();
  const largo = [...texto].length;

  const ponerTexto = (e: FormEvent) => {
    e.preventDefault();
    if (!limpio || !onTexto) return;
    onTexto(limpio, icono);
    onCerrar();
  };

  const elegir = (p: PersonajeMostrado, indice: number) => {
    onElegir(p, indice);
    onCerrar();
  };

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = pestanas.findIndex((t) => t.id === pestana);
    const n = pestanas.length;
    const destino = pestanas[
      e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : e.key === 'ArrowRight' ? (i + 1) % n : (i - 1 + n) % n
    ].id;
    setPestana(destino);
    refs.current[destino]?.focus();
  };

  const lista = (pestana === 'enJuego' ? enJuego : pestana === 'otros' ? otros : []).filter((p) => p.recordatorios.length > 0);

  // En el body: la ficha está en una capa con transform, y dentro de ella «fixed» no sería la pantalla.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-recordatorio-titulo"
        describedBy={explicacion ? 'sala-recordatorio-explicacion' : undefined}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col sala-cofre sala-cofre-esquinas"
      >
        <h2 id="sala-recordatorio-titulo" className="px-6 py-4 sala-cofre-titulo">
          {titulo ?? 'Poner recordatorio'} <span className="font-ui text-base font-normal text-on-surface-muted">({ficha})</span>
        </h2>
        {explicacion && (
          <p id="sala-recordatorio-explicacion" className="-mt-2 px-6 pb-3 text-sm text-on-surface-muted">
            {explicacion}
          </p>
        )}
        <div role="tablist" aria-label="Personajes" className="flex gap-1 border-b border-outline-ghost px-6 py-2">
          {pestanas.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              id={`sala-recordatorio-pestana-${t.id}`}
              type="button"
              role="tab"
              aria-selected={pestana === t.id}
              aria-controls="sala-recordatorio-panel"
              tabIndex={pestana === t.id ? 0 : -1}
              onClick={() => setPestana(t.id)}
              onKeyDown={alTeclear}
              className={`rounded px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
                pestana === t.id ? 'bg-theme-container font-semibold text-gold-bright shadow-[inset_2px_0_0_var(--color-theme-main)]' : 'text-on-surface-muted hover:bg-grimorio/25'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        <div
          id="sala-recordatorio-panel"
          role="tabpanel"
          aria-labelledby={`sala-recordatorio-pestana-${pestana}`}
          className="overflow-y-auto px-6 py-4"
        >
          {pestana === 'texto' ? (
            <form onSubmit={ponerTexto} className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              {/* Cómo quedará: la ficha, en grande, con lo que se va escribiendo */}
              <div className="flex shrink-0 flex-col items-center gap-2">
                <FichaRecordatorio personaje={personajeIcono} texto={{ texto: limpio || 'Tu texto', lang: 'es' }} tamano="7rem" libre icono={icono} />
                <span aria-hidden="true" className="text-xs text-on-surface-muted">
                  Así se verá
                </span>
              </div>
              <div className="flex w-full flex-col gap-2">
                <label htmlFor="sala-recordatorio-texto" className="campo-etiqueta">
                  Texto del recordatorio
                </label>
                <input
                  id="sala-recordatorio-texto"
                  type="text"
                  value={texto}
                  autoFocus
                  autoComplete="off"
                  maxLength={RECORDATORIO_TEXTO_MAX}
                  onChange={(e) => setTexto(e.target.value)}
                  aria-describedby="sala-recordatorio-texto-ayuda"
                  className={campo}
                />
                <p id="sala-recordatorio-texto-ayuda" className="flex justify-between gap-3 text-xs text-on-surface-muted">
                  <span>Corto: va escrito en redondo alrededor de la ficha.</span>
                  <span aria-live="polite" className={largo >= RECORDATORIO_TEXTO_MAX ? 'text-gold-bright' : ''}>
                    {largo}/{RECORDATORIO_TEXTO_MAX}
                  </span>
                </p>
                {/* El icono del centro: radios, uno por icono (se ve la ficha con cada uno) */}
                <fieldset className="mt-2 flex flex-col gap-2">
                  <legend className="campo-etiqueta mb-2">Icono</legend>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ...ICONOS_LIBRES.map((i) => ({ id: i.id as string, nombre: i.nombre, lang: 'es', personaje: undefined })),
                      ...conIcono.map((p) => ({ id: p.id, nombre: p.nombre.texto, lang: p.nombre.lang, personaje: p })),
                    ].map((o) => (
                      <label key={o.id} title={o.nombre} className="relative block cursor-pointer rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-theme-main has-[:checked]:ring-2 has-[:checked]:ring-gold-bright has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-surface hover:brightness-125">
                        <input
                          type="radio"
                          name="sala-recordatorio-icono"
                          value={o.id}
                          checked={icono === o.id}
                          onChange={() => setIcono(o.id)}
                          className="sr-only"
                        />
                        <span lang={o.lang} className="sr-only">{o.nombre}</span>
                        <FichaRecordatorio personaje={o.personaje} texto={{ texto: '', lang: 'es' }} tamano="2.75rem" libre icono={o.id} />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-2 flex justify-end">
                  <button type="submit" aria-disabled={!limpio || undefined} className={botonPrincipal}>
                    Poner recordatorio
                  </button>
                </div>
              </div>
            </form>
          ) : lista.length === 0 ? (
            <p className="text-on-surface-muted">
              {pestana === 'enJuego'
                ? 'Ningún personaje en juego tiene recordatorios. Mira en «Otros personajes».'
                : 'Ningún otro personaje del guion tiene recordatorios.'}
              {onTexto && ' También puedes escribir uno en «Texto propio».'}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {porTipos(lista).map(({ titulo, personajes }) => (
                <section key={titulo} aria-labelledby={`sala-recordatorio-${pestana}-${titulo}`}>
                  <h3
                    id={`sala-recordatorio-${pestana}-${titulo}`}
                    className="rotulo mb-2"
                  >
                    {titulo}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {personajes.map((p) => (
                      <li key={p.id}>
                        <h4 className="mb-1 text-sm">
                          <span lang={p.nombre.lang}>{p.nombre.texto}</span>
                          {pestana === 'enJuego' && probables?.has(p.id) && (
                            <span className="ml-2 font-ui text-xs text-on-surface-muted">
                              posible: el reparto no cuadra
                            </span>
                          )}
                        </h4>
                        <ul className="flex flex-wrap gap-2">
                          {p.recordatorios.map((r, i) => (
                            <li key={i}>
                              <button
                                type="button"
                                onClick={() => elegir(p, i)}
                                aria-label={`${r.texto}, ${p.nombre.texto}`}
                                className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main focus-visible:ring-offset-2 focus-visible:ring-offset-surface hover:brightness-125"
                              >
                                <FichaRecordatorio personaje={p} texto={r} tamano={TAMANO} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 sala-cofre-pie px-6 py-3">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Cancelar
          </button>
          {sinRecordatorio && (
            <button
              type="button"
              onClick={() => {
                sinRecordatorio.onElegir();
                onCerrar();
              }}
              className={botonPeligro}
            >
              {sinRecordatorio.etiqueta}
            </button>
          )}
        </div>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoRecordatorio;
