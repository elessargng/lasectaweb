import { Pin, PinOff } from 'lucide-react';
import { IconoMascaras } from './IconosJuego';
import { useState } from 'react';
import DialogoFaroles from './DialogoFaroles';
import DialogoPersonaje from './DialogoPersonaje';
import { botonIcono, botonPrincipal, botonSecundario } from './estilos';
import { useFichas } from './fichas';
import CasillaFarol from './CasillaFarol';
import type { SalaEstado, SalaResultado } from './useSala';

interface PanelFarolesProps {
  /**
   * Narrador: los suyos, con «Asignar faroles». Visitante: los del narrador, solo
   * verlos. Jugador (demonio) o esbirro: los suyos, cada uno se cambia y se marca
   * el que está usando.
   */
  modo: 'narrador' | 'visitante' | 'jugador' | 'esbirro';
  /** Las 3 casillas (id de personaje o null). */
  faroles: (string | null)[];
  estado: SalaEstado;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** Confirmar al lector un cambio («Farol 2: Monje.»). */
  onAnuncio: (texto: string) => void;
  /** Fijados arriba de la columna (se ven también con otro panel). */
  fijados: boolean;
  onFijar: (fijados: boolean) => void;
}

const EXPLICACION: Record<PanelFarolesProps['modo'], string> = {
  narrador: 'Saldrán puestos en «Estos personajes no están en juego».',
  visitante: 'Los que el narrador ha preparado para el demonio.',
  jugador: 'Personajes que no están en juego, para hacerte pasar por ellos. Marca el que estés usando.',
  esbirro: 'Personajes por los que hacerte pasar. Marca el que estés usando: lo sabrá el narrador.',
};

/**
 * A la izquierda, en la pestaña Faroles: las 3 fichas de farol. El narrador las
 * prepara para el demonio (con el diálogo de la bolsa); los visitantes las ven;
 * el jugador demonio tiene las suyas (copiadas de lo que le enseña el narrador
 * de noche, o puestas a mano, tenga grimorio o no).
 */
const PanelFaroles = ({ modo, faroles, estado, pedir, onError, onAnuncio, fijados, onFijar }: PanelFarolesProps) => {
  const { personajes, todosPorId } = useFichas();
  const [asignando, setAsignando] = useState(false);
  // La casilla que el jugador está cambiando (índice), o null
  const [cambiando, setCambiando] = useState<number | null>(null);
  const propios = modo === 'jugador' || modo === 'esbirro';
  const enUso = propios ? (estado.asientos.find((a) => a.ocupante === estado.yo)?.farolEnUso ?? null) : null;

  const usar = async (personajeId: string | null) => {
    const r = await pedir('jugador:usarFarol', { personajeId });
    if (!r.ok) return onError(r.error);
    const nombre = personajeId ? todosPorId.get(personajeId)?.nombre.texto : undefined;
    onAnuncio(nombre ? `Usando el farol ${nombre}.` : 'Sin farol en uso.');
  };

  const ponerMio = async (posicion: number, personajeId: string | null) => {
    const r = await pedir('jugador:farol', { posicion, personajeId });
    if (!r.ok) return onError(r.error);
    const nombre = personajeId ? todosPorId.get(personajeId)?.nombre.texto : undefined;
    onAnuncio(nombre ? `Farol ${posicion + 1}: ${nombre}.` : `Farol ${posicion + 1} vacío.`);
  };

  return (
    <section aria-labelledby="sala-faroles-titulo" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="sala-faroles-titulo" className="flex items-center gap-2 rotulo">
            <IconoMascaras size={16} />
            Faroles
          </h2>
          <p className="text-xs text-on-surface-muted">{EXPLICACION[modo]}</p>
        </div>
        {/* Fijar: un interruptor (pulsado o no); aquí no cambia nada, se ven arriba en los otros paneles */}
        <button
          type="button"
          aria-pressed={fijados}
          aria-label="Fijar faroles"
          onClick={() => onFijar(!fijados)}
          className={`${botonIcono} h-8 w-8 shrink-0 text-on-surface-muted aria-pressed:bg-theme-container aria-pressed:text-theme-main`}
        >
          <Pin size={16} className={fijados ? 'fill-current' : ''} />
        </button>
      </header>

      <ul className="grid grid-cols-3 gap-3">
        {faroles.map((id, i) => {
          const personaje = id ? todosPorId.get(id) : undefined;
          return (
            // Las casillas son fijas (la 1, la 2 y la 3): su clave es su posición
            <li key={i} className="flex min-w-0 flex-col items-center gap-1">
              {propios ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCambiando(i)}
                    className="group flex w-full min-w-0 rounded-lg p-1 hover:bg-theme-main/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
                  >
                    <span className="sr-only">Farol {i + 1}: </span>
                    <CasillaFarol personaje={personaje} />
                    <span className="sr-only">, cambiar</span>
                  </button>
                  {/* Cuál está usando: un interruptor por farol (pulsado, ese; solo uno a la vez) */}
                  {id && personaje && (
                    <button
                      type="button"
                      aria-pressed={enUso === id}
                      onClick={() => void usar(enUso === id ? null : id)}
                      className={`${botonSecundario} px-2 py-1 text-[0.65rem] aria-pressed:bg-theme-container aria-pressed:text-theme-main`}
                    >
                      <span className="sr-only">
                        <span lang={personaje.nombre.lang}>{personaje.nombre.texto}</span>:{' '}
                      </span>
                      Lo estoy usando
                    </button>
                  )}
                </>
              ) : (
                <span className="flex w-full min-w-0 p-1">
                  <span className="sr-only">Farol {i + 1}: </span>
                  <CasillaFarol personaje={personaje} />
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {modo === 'narrador' && (
        <button type="button" onClick={() => setAsignando(true)} className={`${botonPrincipal} self-center font-ui`}>
          Asignar faroles
        </button>
      )}

      {asignando && (
        <DialogoFaroles
          faroles={faroles}
          bolsa={estado.bolsa}
          asientos={estado.asientos}
          pedir={pedir}
          onCerrar={() => setAsignando(false)}
        />
      )}
      {cambiando !== null && (
        <DialogoPersonaje
          ficha={`Farol ${cambiando + 1}`}
          titulo="Cambiar farol"
          personajes={personajes}
          actual={faroles[cambiando] ?? null}
          onElegir={(personajeId) => void ponerMio(cambiando, personajeId)}
          onCerrar={() => setCambiando(null)}
        />
      )}
    </section>
  );
};

/**
 * Los faroles fijados arriba de la columna, con otro panel a la vista: solo las
 * 3 fichas, pequeñas y sin texto, y el botón para desfijarlos. Para el lector,
 * un título oculto («Faroles fijados») y cada ficha con su nombre.
 */
export const FarolesFijados = ({ faroles, onDesfijar }: { faroles: (string | null)[]; onDesfijar: () => void }) => {
  const { todosPorId } = useFichas();
  return (
    <section
      aria-labelledby="sala-faroles-fijados-titulo"
      className="flex shrink-0 items-center gap-2 border-b border-outline-ghost bg-background/40 px-3 py-2"
    >
      <h2 id="sala-faroles-fijados-titulo" className="sr-only">
        Faroles fijados
      </h2>
      <ul className="grid min-w-0 flex-1 grid-cols-3 gap-2">
        {faroles.map((id, i) => {
          const personaje = id ? todosPorId.get(id) : undefined;
          return (
            // Las casillas son fijas (la 1, la 2 y la 3): su clave es su posición
            <li key={i} className="flex min-w-0">
              <span className="sr-only">
                Farol {i + 1}: {personaje ? <span lang={personaje.nombre.lang}>{personaje.nombre.texto}</span> : 'vacío'}
              </span>
              <CasillaFarol personaje={personaje} tamano="3.5rem" conNombre={false} />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        aria-label="Desfijar faroles"
        onClick={onDesfijar}
        className={`${botonIcono} h-8 w-8 shrink-0 self-start text-theme-main`}
      >
        <PinOff size={16} />
      </button>
    </section>
  );
};

export default PanelFaroles;
