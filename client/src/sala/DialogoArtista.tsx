import { useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  describirPreguntaArtista,
  MAX_PREGUNTA_ARTISTA,
  PREGUNTAS_ARTISTA,
  RESPUESTAS_ARTISTA,
  TIPOS_ARTISTA,
  type PreguntaArtista,
  type QuienArtista,
  type RespuestaArtista,
  type TipoArtista,
  type TipoPreguntaArtista,
} from '@contrato/artista';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import { TIPOS_REPARTO, useFichas } from './fichas';
import { nombreDeAsiento } from './despertar';
import type { SalaEstado, SalaResultado } from './useSala';

interface DialogoArtistaProps {
  estado: SalaEstado;
  /** Mi asiento: de él se dice «tú». */
  miAsiento: string;
  /** Pregunta libre (Jarvis la entiende); si no, se monta con piezas. */
  libre: boolean;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

const NOMBRE_TIPO: Record<string, string> = { townsfolk: 'Aldeano', outsider: 'Forastero', minion: 'Esbirro', demon: 'Demonio' };

/** Lo que se elige en el desplegable de «quién»: «alineamiento:malvado», «tipo:demon», «personaje:imp». */
const leerQuien = (valor: string): QuienArtista => {
  const [por, id] = valor.split(':');
  if (por === 'personaje') return { por, personaje: id };
  if (por === 'tipo') return { por, tipo: id as TipoArtista };
  return { por: 'alineamiento', alineamiento: id === 'malvado' ? 'malvado' : 'bueno' };
};

/**
 * La pregunta del Artista al narrador virtual (una vez por partida, de día; lo sea
 * o no, como en la mesa). Con Jarvis se escribe libre; con «Tonto y tú», que no
 * entiende una pregunta libre, se monta con piezas, como en un despertar: qué se
 * pregunta y de quién (un bando, un tipo o un personaje), los jugadores, la letra…
 * Debajo se lee la pregunta tal como la recibirá el narrador. Al contestar, la
 * respuesta sale en la ventana y el foco va a ella; si pide que la reformule, no
 * se gasta y se puede volver a preguntar.
 */
const DialogoArtista = ({ estado, miAsiento, libre, pedir, onCerrar }: DialogoArtistaProps) => {
  const { personajes, todosPorId } = useFichas();
  const asientos = estado.asientos;
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<TipoPreguntaArtista>('es');
  const [quien, setQuien] = useState('tipo:demon');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [todos, setTodos] = useState(false);
  const [letra, setLetra] = useState('');
  const [par, setPar] = useState(true);
  const [desde, setDesde] = useState(asientos[0]?.id ?? '');
  const [hasta, setHasta] = useState(asientos[asientos.length - 1]?.id ?? '');
  const [a, setA] = useState(miAsiento);
  const [cuando, setCuando] = useState<'anoche' | 'algunaNoche'>('anoche');
  const [respuesta, setRespuesta] = useState<RespuestaArtista | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const respuestaRef = useRef<HTMLParagraphElement>(null);
  const ariaLive = useAriaLive('errores');

  const nombres = {
    asiento: (id: string) => nombreDeAsiento(estado, id),
    personaje: (id: string) => todosPorId.get(id)?.nombre.texto ?? id,
    yo: miAsiento,
  };
  const letraValida = /^\p{L}$/u.test(letra);
  /** La pregunta con lo elegido; null si falta algo (ningún jugador, ninguna letra). */
  const montar = (): PreguntaArtista | null => {
    const q = leerQuien(quien);
    switch (tipo) {
      case 'enJuego':
        return { tipo, quien: q };
      case 'es':
        // En el orden de la mesa
        return elegidos.length ? { tipo, quien: q, asientos: asientos.filter((x) => elegidos.includes(x.id)).map((x) => x.id), todos } : null;
      case 'inicial':
        return letraValida ? { tipo, quien: q, letra: letra.toUpperCase() } : null;
      case 'silla':
        return { tipo, quien: q, par };
      case 'entre':
        return { tipo, quien: q, desde, hasta };
      case 'eligio':
        return { tipo, quien: q, a, cuando };
    }
  };
  const pregunta = montar();
  const contestada = respuesta !== null && respuesta !== 'reformular';

  const preguntar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || contestada) return;
    if (libre ? !texto.trim() : !pregunta) {
      setError(libre ? 'Escribe la pregunta.' : tipo === 'es' ? 'Elige al menos un jugador.' : 'Escribe una letra.');
      return;
    }
    setEnviando(true);
    setError('');
    const r = await pedir('jugador:artista', libre ? { texto: texto.trim() } : { pregunta });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    setRespuesta((r.valor as RespuestaArtista) ?? 'reformular');
    window.setTimeout(() => respuestaRef.current?.focus(), 0);
  };

  const alternar = (id: string) => setElegidos((ya) => (ya.includes(id) ? ya.filter((x) => x !== id) : [...ya, id]));
  const selectorAsiento = (id: string, etiqueta: string, valor: string, cambiar: (v: string) => void) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-ui text-xs">
        {etiqueta}
      </label>
      <select id={id} value={valor} onChange={(e) => cambiar(e.target.value)} className={`${campo} text-sm`}>
        {asientos.map((x) => (
          <option key={x.id} value={x.id}>
            {x.id === miAsiento ? `${nombreDeAsiento(estado, x.id)}, tú` : nombreDeAsiento(estado, x.id)}
          </option>
        ))}
      </select>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-artista-titulo"
        describedBy="sala-artista-texto"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto sala-cofre sala-cofre-esquinas p-6"
      >
        <form onSubmit={(e) => void preguntar(e)} className="flex flex-col gap-4" noValidate>
          <h2 id="sala-artista-titulo" className="sala-cofre-titulo">
            Pregunta de Artista
          </h2>
          <p id="sala-artista-texto" className="text-sm text-on-surface-muted">
            {libre
              ? 'Una pregunta de sí o no al narrador, en privado. Si no la puede contestar, te pedirá que la reformules y no la gastas.'
              : 'Monta una pregunta de sí o no al narrador, en privado. Cuentan todos los asientos, vivos o muertos.'}
          </p>
          {libre ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="sala-artista-libre" className="font-ui text-xs">
                Tu pregunta
              </label>
              <textarea
                id="sala-artista-libre"
                value={texto}
                maxLength={MAX_PREGUNTA_ARTISTA}
                rows={3}
                disabled={contestada}
                onChange={(e) => setTexto(e.target.value)}
                aria-invalid={!!error && !texto.trim()}
                aria-describedby={error ? 'sala-artista-error' : undefined}
                className={`${campo} text-sm`}
              />
            </div>
          ) : (
            <fieldset disabled={contestada} className="flex flex-col gap-3">
              <legend className="sr-only">Tu pregunta</legend>
              <div className="flex flex-col gap-1">
                <label htmlFor="sala-artista-tipo" className="font-ui text-xs">
                  Qué preguntas
                </label>
                <select id="sala-artista-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPreguntaArtista)} className={`${campo} text-sm`}>
                  {PREGUNTAS_ARTISTA.map((p) => (
                    <option key={p.tipo} value={p.tipo}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {tipo === 'es' && (
                <>
                  <fieldset className="flex flex-col gap-1" aria-describedby={error && !elegidos.length ? 'sala-artista-error' : undefined}>
                    <legend className="mb-1 font-ui text-xs">Jugadores</legend>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {asientos.map((x) => (
                        <label key={x.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" checked={elegidos.includes(x.id)} onChange={() => alternar(x.id)} />
                          {x.id === miAsiento ? `${nombreDeAsiento(estado, x.id)}, tú` : nombreDeAsiento(estado, x.id)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {elegidos.length > 1 && (
                    <fieldset className="flex flex-wrap gap-4">
                      <legend className="mb-1 font-ui text-xs">De los elegidos</legend>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="radio" name="sala-artista-todos" checked={!todos} onChange={() => setTodos(false)} />
                        Alguno
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="radio" name="sala-artista-todos" checked={todos} onChange={() => setTodos(true)} />
                        Todos
                      </label>
                    </fieldset>
                  )}
                </>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor="sala-artista-quien" className="font-ui text-xs">
                  {tipo === 'es' ? 'Si son' : tipo === 'eligio' ? 'Quién eligió' : 'De quién'}
                </label>
                <select id="sala-artista-quien" value={quien} onChange={(e) => setQuien(e.target.value)} className={`${campo} text-sm`}>
                  <optgroup label="Bando">
                    <option value="alineamiento:bueno">Bueno</option>
                    <option value="alineamiento:malvado">Malvado</option>
                  </optgroup>
                  <optgroup label="Tipo">
                    {TIPOS_ARTISTA.map((t) => (
                      <option key={t} value={`tipo:${t}`}>
                        {NOMBRE_TIPO[t]}
                      </option>
                    ))}
                  </optgroup>
                  {TIPOS_REPARTO.map(({ tipo: t, nombre }) => (
                    <optgroup key={t} label={nombre}>
                      {personajes
                        .filter((p) => p.tipo === t)
                        .map((p) => (
                          <option key={p.id} value={`personaje:${p.id}`} lang={p.nombre.lang}>
                            {p.nombre.texto}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {tipo === 'inicial' && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="sala-artista-letra" className="font-ui text-xs">
                    Letra
                  </label>
                  <input
                    id="sala-artista-letra"
                    value={letra}
                    maxLength={1}
                    autoComplete="off"
                    onChange={(e) => setLetra(e.target.value)}
                    aria-invalid={!!error && !letraValida}
                    aria-describedby={error ? 'sala-artista-error' : undefined}
                    className={`${campo} w-16 text-sm`}
                  />
                </div>
              )}
              {tipo === 'silla' && (
                <fieldset className="flex flex-wrap gap-4">
                  <legend className="mb-1 font-ui text-xs">Silla (la 1 es la de arriba y se cuenta en el sentido de las agujas del reloj)</legend>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="sala-artista-silla" checked={par} onChange={() => setPar(true)} />
                    Par
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="sala-artista-silla" checked={!par} onChange={() => setPar(false)} />
                    Impar
                  </label>
                </fieldset>
              )}
              {tipo === 'entre' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectorAsiento('sala-artista-desde', 'Desde', desde, setDesde)}
                  {selectorAsiento('sala-artista-hasta', 'Hasta (en el sentido de las agujas del reloj)', hasta, setHasta)}
                </div>
              )}
              {tipo === 'eligio' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectorAsiento('sala-artista-a', 'A quién', a, setA)}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="sala-artista-cuando" className="font-ui text-xs">
                      Cuándo
                    </label>
                    <select
                      id="sala-artista-cuando"
                      value={cuando}
                      onChange={(e) => setCuando(e.target.value === 'algunaNoche' ? 'algunaNoche' : 'anoche')}
                      className={`${campo} text-sm`}
                    >
                      <option value="anoche">Anoche</option>
                      <option value="algunaNoche">Alguna noche</option>
                    </select>
                  </div>
                </div>
              )}
              {pregunta && (
                <p className="text-sm">
                  <span className="font-ui text-xs text-on-surface-muted">Preguntarás: </span>
                  {describirPreguntaArtista(pregunta, nombres)}
                </p>
              )}
            </fieldset>
          )}
          <div aria-live={ariaLive}>
            {error && (
              <p id="sala-artista-error" className="text-sm text-blood-pale">
                {error}
              </p>
            )}
          </div>
          {respuesta && (
            <p ref={respuestaRef} tabIndex={-1} className="rounded border border-gold p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main">
              <span className="font-ui text-xs text-on-surface-muted">El narrador contesta: </span>
              {RESPUESTAS_ARTISTA[respuesta]}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              {contestada ? 'Cerrar' : 'Cancelar'}
            </button>
            {!contestada && (
              <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
                {enviando ? 'Preguntando…' : 'Preguntar'}
              </button>
            )}
          </div>
        </form>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoArtista;
