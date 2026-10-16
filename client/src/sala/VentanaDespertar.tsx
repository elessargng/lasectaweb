import { Maximize2, Minimize2, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { nombreDeAsiento } from './despertar';
import { botonSecundario } from './estilos';
import type { PersonajeMostrado } from './guiones';
import { ID_TITULO_DESPERTAR } from './ids';
import { BotoneraDespertar, HistorialDespertar } from './PiezasDespertar';
import type { SalaDespertar, SalaEstado, SalaResultado } from './useSala';

interface VentanaDespertarProps {
  estado: SalaEstado;
  /** Los despertares que el narrador tiene abiertos en la ventana, en orden. */
  abiertos: SalaDespertar[];
  /** El que se ve (id de asiento). */
  activo: string;
  /** Asientos con mensajes del jugador que el narrador aún no ha visto. */
  noLeidos: Set<string>;
  onActivar: (asientoId: string) => void;
  onCerrar: (asientoId: string) => void;
  /** Todos los personajes del guion (y por id, para pintar los mensajes). */
  personajes: PersonajeMostrado[];
  porId: Map<string, PersonajeMostrado>;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  onEnviado: (texto: string) => void;
  /** Visitantes que ven el grimorio: solo leen lo que se dicen (no mandan nada). */
  soloLectura?: boolean;
}

const idPestana = (asientoId: string) => `sala-despertar-pestana-${asientoId}`;
const ID_PANEL = 'sala-despertar-panel';

/**
 * Los despertares que el narrador tiene abiertos: uno por asiento, varios a la
 * vez (una pestaña cada uno). En cada uno, las fichas y tarjetas que puede
 * mandar y lo que se han dicho. «Cerrar» quita la ventana de ese despertar (en
 * este navegador): el despertar sigue y se vuelve a abrir con la luna de la ficha.
 *
 * No es modal: el narrador sigue mirando el grimorio (y puede minimizarla).
 *
 * Un visitante que ve el grimorio la abre igual, pero solo para leer: sin fichas
 * ni tarjetas que mandar.
 */
const VentanaDespertar = ({
  estado,
  abiertos,
  activo,
  noLeidos,
  onActivar,
  onCerrar,
  personajes,
  porId,
  pedir,
  onError,
  onEnviado,
  soloLectura = false,
}: VentanaDespertarProps) => {
  const [minimizada, setMinimizada] = useState(false);
  const actual = abiertos.find((d) => d.asiento === activo) ?? abiertos[0];
  const nombre = nombreDeAsiento(estado, actual.asiento);
  const conPestanas = abiertos.length > 1;

  // Pestañas: flechas para moverse entre ellas (y activarlas), Inicio y Fin.
  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const total = abiertos.length;
    const destinos: Record<string, number> = {
      ArrowRight: (i + 1) % total,
      ArrowLeft: (i - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    const destino = destinos[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const id = abiertos[destino].asiento;
    onActivar(id);
    document.getElementById(idPestana(id))?.focus();
  };

  const boton = `${botonSecundario} flex items-center gap-1 px-2 py-1 text-xs`;
  return (
    <section
      aria-labelledby={ID_TITULO_DESPERTAR}
      className={`fixed left-1/2 top-16 z-40 flex w-[min(94vw,64rem)] -translate-x-1/2 flex-col gap-3 sala-cofre backdrop-blur ${
        minimizada ? 'p-2' : 'max-h-[85vh] overflow-y-auto p-4'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id={ID_TITULO_DESPERTAR}
          tabIndex={-1}
          className="min-w-0 flex-1 font-display text-xl text-gold-bright focus:outline-none"
        >
          {soloLectura ? 'Despertar de ' : 'Despierta a '}
          <strong className="font-normal text-on-surface-bright">{nombre}</strong>
        </h2>
        <button type="button" onClick={() => setMinimizada((m) => !m)} className={boton}>
          {minimizada ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          {minimizada ? 'Ampliar' : 'Minimizar'}
        </button>
        <button type="button" onClick={() => onCerrar(actual.asiento)} className={boton}>
          <X size={14} />
          Cerrar
        </button>
      </div>

      {conPestanas && (
        <div role="tablist" aria-label="Despertares abiertos" className="flex flex-wrap gap-1 border-b border-outline-ghost">
          {abiertos.map((d, i) => {
            const elegida = d.asiento === actual.asiento;
            return (
              <button
                key={d.asiento}
                id={idPestana(d.asiento)}
                type="button"
                role="tab"
                aria-selected={elegida}
                aria-controls={ID_PANEL}
                tabIndex={elegida ? 0 : -1}
                onClick={() => onActivar(d.asiento)}
                onKeyDown={(e) => alTeclear(e, i)}
                className={`-mb-px flex items-center gap-1 rounded-t border border-b-0 px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
                  elegida ? 'border-gold/60 bg-theme-container text-gold-bright' : 'border-outline-ghost text-on-surface-muted hover:text-on-surface-bright'
                }`}
              >
                {nombreDeAsiento(estado, d.asiento)}
                {noLeidos.has(d.asiento) && (
                  <>
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-gold-bright" />
                    <span className="sr-only">, mensajes nuevos</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!minimizada && (
        <div
          id={ID_PANEL}
          role={conPestanas ? 'tabpanel' : undefined}
          aria-labelledby={conPestanas ? idPestana(actual.asiento) : undefined}
          className="flex flex-col gap-3"
        >
          {/* key: al cambiar de despertar, lo que se estaba eligiendo no pasa al otro */}
          {!soloLectura && (
            <BotoneraDespertar
              key={actual.asiento}
              estado={estado}
              asientoId={actual.asiento}
              personajes={personajes}
              conTarjetas
              tituloFichas="Fichas"
              pedir={pedir}
              onError={onError}
              onEnviado={onEnviado}
            />
          )}
          <h3 id="sala-despertar-mensajes" className="font-ui text-sm font-semibold text-theme-main">
            Mensajes
          </h3>
          <HistorialDespertar
            mensajes={actual.mensajes}
            estado={estado}
            personajes={porId}
            tituloId="sala-despertar-mensajes"
          />
        </div>
      )}
    </section>
  );
};

export default VentanaDespertar;
