import { Flame, Pencil, Plus, X } from 'lucide-react';
import { IconoDestellos } from './IconosJuego';
import { useState } from 'react';
import DialogoBootlegger from './DialogoBootlegger';
import DialogoNpcs from './DialogoNpcs';
import DialogoPersonaje from './DialogoPersonaje';
import { botonPrincipal } from './estilos';
import type { PersonajeMostrado } from './guiones';
import CasillaFarol from './CasillaFarol';
import { colocarDesplegable } from './colocarDesplegable';
import type { SalaResultado } from './useSala';

interface PanelNpcsProps {
  /** Los NPCs en juego (ids), en el orden en que se añadieron. */
  npcs: string[];
  /** Los legendarios y lóricos que se pueden poner (los del guion y los del catálogo). */
  disponibles: PersonajeMostrado[];
  /** Narrador: añade y quita. Los demás, solo los ven. */
  narro: boolean;
  hayGuion: boolean;
  /** Las reglas del Bootlegger (salen en su tarjeta). */
  bootlegger: string[];
  /** El personaje que ha nombrado el Storm Catcher (sale en su tarjeta), o null. */
  rolStormcatcher: PersonajeMostrado | null;
  /** Los personajes buenos del guion, para nombrar el del Storm Catcher. */
  buenos: PersonajeMostrado[];
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
}

const ID_ANADIR = 'sala-npcs-anadir';
const botonNpc =
  'mx-auto mt-1 flex items-center gap-1 rounded px-2 py-0.5 font-ui text-[0.65rem] uppercase tracking-wide text-theme-main hover:bg-theme-main/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main';
const TIPO: Record<string, string> = { fabled: 'Legendario', loric: 'Lórico' };

/**
 * A la izquierda, en la pestaña NPCs: los legendarios y lóricos de la partida,
 * como fichas grandes (tres por fila) con su nombre debajo. Su habilidad sale en
 * una tarjeta al pasar el ratón; además, cada ficha es un desplegable
 * (aria-expanded) que la muestra u oculta: así llega el teclado, el lector y las
 * pantallas táctiles. El narrador los añade con «Añadir NPC» (las fichas, como
 * en la bolsa) y los quita con la ✕ de su esquina. Sin ninguno, lo dice y cómo
 * se añaden.
 */
const PanelNpcs = ({ npcs, disponibles, narro, hayGuion, bootlegger, rolStormcatcher, buenos, pedir, onError }: PanelNpcsProps) => {
  const [anadiendo, setAnadiendo] = useState(false);
  // Los diálogos de los NPCs con algo que decidir (el narrador)
  const [editandoReglas, setEditandoReglas] = useState(false);
  const [nombrandoRol, setNombrandoRol] = useState(false);
  // El NPC con la habilidad desplegada (con el teclado, el lector o en pantallas táctiles), o null
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const porId = new Map(disponibles.map((p) => [p.id, p]));
  const enJuego = npcs.flatMap((id) => (porId.get(id) ? [porId.get(id)!] : []));

  // La tarjeta de la habilidad del NPC de esa ficha (en su mismo elemento de la lista)
  const colocar = (ficha: HTMLElement) => {
    const li = ficha.closest('li');
    const tarjeta = li?.querySelector<HTMLElement>('[data-tarjeta-npc]');
    if (li && tarjeta) colocarDesplegable(li, tarjeta);
  };

  const quitar = async (p: PersonajeMostrado) => {
    const r = await pedir('narrador:npc', { personajeId: p.id });
    if (!r.ok) return onError(r.error);
    // Su botón desaparece: el foco va a «Añadir NPC»
    window.setTimeout(() => document.getElementById(ID_ANADIR)?.focus(), 0);
  };

  return (
    <section aria-labelledby="sala-npcs-titulo" className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <header className="flex items-center gap-2">
        <h2 id="sala-npcs-titulo" className="flex flex-1 items-center gap-2 rotulo">
          <IconoDestellos size={16} />
          NPCs
        </h2>
        {narro && hayGuion && (
          <button
            id={ID_ANADIR}
            type="button"
            onClick={() => setAnadiendo(true)}
            className={`${botonPrincipal} flex items-center gap-1 px-2 py-1 font-ui text-xs`}
          >
            <Plus size={14} />
            Añadir NPC
          </button>
        )}
      </header>

      {enJuego.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <span
            aria-hidden="true"
            className="sala-medallon-vacio"
          >
            <IconoDestellos size={28} strokeWidth={1.25} />
          </span>
          <p className="font-display text-lg text-on-surface-bright">Sin NPCs en juego</p>
          <p className="max-w-[15rem] text-xs leading-relaxed text-on-surface-muted">
            {!narro
              ? 'Si el narrador pone legendarios o lóricos en la partida, aparecerán aquí con su habilidad.'
              : hayGuion
                ? 'Pon en la partida legendarios o lóricos con «Añadir NPC»: todos verán aquí su habilidad.'
                : 'Elige antes un guion para poder añadir legendarios y lóricos.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
          {enJuego.map((p, i) => {
            const abierta = abiertaId === p.id;
            const idHabilidad = `sala-npc-habilidad-${p.id}`;
            // La tarjeta de la habilidad, alineada con su columna para no salirse del panel
            const alineada = ['left-0', 'left-1/2 -translate-x-1/2', 'right-0'][i % 3];
            return (
              <li key={p.id} className="group relative flex min-w-0 flex-col">
                {/* La ficha muestra la habilidad (desplegable): al pasar el ratón se ve sola */}
                <button
                  type="button"
                  aria-expanded={abierta}
                  aria-controls={idHabilidad}
                  onClick={() => setAbiertaId(abierta ? null : p.id)}
                  // Antes de verse (al pasar el ratón o llevar el foco): hacia arriba si abajo no cabe
                  onMouseEnter={(e) => colocar(e.currentTarget)}
                  onFocus={(e) => colocar(e.currentTarget)}
                  className="flex w-full min-w-0 rounded-lg p-1 hover:bg-theme-main/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
                >
                  <CasillaFarol personaje={p} />
                  <span className="sr-only">, {TIPO[p.tipo] ?? ''}</span>
                </button>
                {narro && (
                  <button
                    type="button"
                    onClick={() => void quitar(p)}
                    aria-label={`Quitar ${p.nombre.texto}`}
                    className="absolute right-0 top-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-outline-ghost bg-surface text-on-surface-muted opacity-0 transition-opacity hover:text-blood-bright focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-theme-main group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
                  >
                    <X size={12} />
                  </button>
                )}
                <div
                  id={idHabilidad}
                  data-tarjeta-npc=""
                  className={`absolute top-full z-20 mt-1 w-56 rounded border border-theme-main/60 bg-surface p-3 text-left shadow-2xl data-[arriba=true]:bottom-full data-[arriba=true]:top-auto data-[arriba=true]:mb-1 data-[arriba=true]:mt-0 ${alineada} ${
                    abierta ? 'visible' : 'invisible group-hover:visible'
                  }`}
                >
                  {/* El nombre ya lo dice la ficha al lector: aquí, solo a la vista */}
                  <p aria-hidden="true" className="font-display text-base leading-tight text-on-surface-bright">
                    <span lang={p.nombre.lang}>{p.nombre.texto}</span>
                  </p>
                  <p className="mb-1 font-ui text-[0.6rem] uppercase tracking-wide text-theme-main">{TIPO[p.tipo] ?? ''}</p>
                  <p lang={p.habilidad.lang} className="text-xs leading-snug text-on-surface">
                    {p.habilidad.texto}
                  </p>
                  {/* Bootlegger: las reglas propias del guion */}
                  {p.id === 'bootlegger' && bootlegger.length > 0 && (
                    <ul className="mt-2 list-disc border-t border-outline-ghost pl-4 pt-2 text-xs leading-snug text-on-surface">
                      {bootlegger.map((r, k) => (
                        // Las reglas pueden repetirse: su clave es su posición
                        <li key={k}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {/* Storm Catcher: el personaje que ha nombrado el narrador */}
                  {p.id === 'stormcatcher' && (
                    <p className="mt-2 border-t border-outline-ghost pt-2 text-xs text-on-surface">
                      Personaje nombrado:{' '}
                      {rolStormcatcher ? (
                        <strong lang={rolStormcatcher.nombre.lang} className="text-on-surface-bright">
                          {rolStormcatcher.nombre.texto}
                        </strong>
                      ) : (
                        <span className="text-on-surface-muted">todavía ninguno</span>
                      )}
                    </p>
                  )}
                </div>
                {/* Lo que el narrador decide de algunos NPCs, debajo de su ficha */}
                {narro && p.id === 'bootlegger' && (
                  <button type="button" onClick={() => setEditandoReglas(true)} className={botonNpc}>
                    <Pencil size={12} />
                    Reglas
                  </button>
                )}
                {narro && p.id === 'ferryman' && (
                  // El Barquero: todos los muertos recuperan su voto (sus velas se encienden;
                  // a todos les llega el aviso)
                  <button
                    type="button"
                    onClick={() => void pedir('narrador:barquero').then((r) => !r.ok && onError(r.error))}
                    className={botonNpc}
                  >
                    <Flame size={12} />
                    Recuperar votos
                  </button>
                )}
                {narro && p.id === 'stormcatcher' && (
                  <button type="button" onClick={() => setNombrandoRol(true)} className={botonNpc}>
                    <Pencil size={12} />
                    Nombrar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editandoReglas && (
        <DialogoBootlegger
          reglas={bootlegger}
          onGuardar={async (reglas) => {
            const r = await pedir('narrador:bootlegger', { reglas });
            if (!r.ok) onError(r.error);
            return r.ok;
          }}
          onCerrar={() => setEditandoReglas(false)}
        />
      )}
      {nombrandoRol && (
        <DialogoPersonaje
          ficha="Storm Catcher"
          titulo="Nombrar un personaje bueno"
          personajes={buenos}
          actual={rolStormcatcher?.id ?? null}
          onElegir={(personajeId) => {
            void pedir('narrador:stormcatcher', { personajeId }).then((r) => {
              if (!r.ok) onError(r.error);
            });
          }}
          onCerrar={() => setNombrandoRol(false)}
        />
      )}
      {anadiendo && (
        <DialogoNpcs npcs={npcs} disponibles={disponibles} pedir={pedir} onCerrar={() => setAnadiendo(false)} />
      )}
    </section>
  );
};

export default PanelNpcs;
