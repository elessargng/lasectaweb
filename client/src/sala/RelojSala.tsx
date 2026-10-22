import { useEffect, useRef, useState } from 'react';
import { botonPrincipal, botonSecundario } from './estilos';
import { formatoReloj, RELOJ_TRAS_FIN_MS } from './reloj';
import { tocarGong } from './sonidos';
import type { SalaReloj } from './useSala';

interface RelojSalaProps {
  reloj: SalaReloj;
  /** Reloj del servidor menos el de aquí (ms). */
  desfase: number;
  /** Aviso al lector al acabar el tiempo. */
  onAnuncio: (texto: string) => void;
  /** Acabarlo ya, con su gong (solo narradores, mientras está en marcha); si no, no sale el botón. */
  onTerminar?: () => void;
  /** Quitarlo sin más (solo narradores); si no, no sale el botón. */
  onCancelar?: () => void;
}

/** Los últimos segundos se ven en rojo (alerta). */
const AVISO_FINAL_MS = 10_000;

/** El botón de cancelar: al terminar el reloj, el foco pasa a él (el de terminar desaparece). */
export const ID_CANCELAR_RELOJ = 'sala-reloj-cancelar';

/** Lo que queda (ms, puede ser negativo), con el reloj del servidor. */
const queda = (reloj: SalaReloj, desfase: number) => reloj.fin - (Date.now() + desfase);

/**
 * El reloj del narrador, en grande en el centro de la mesa, para todos: lo que
 * queda (minutos:segundos) con una barra que se vacía y, debajo, su mensaje. Al
 * acabar (o si el narrador lo termina antes) suena el gong y pone «¡Tiempo!» un
 * rato; luego desaparece. Quien la usa la monta con `key` = su inicio, así que un
 * reloj nuevo empieza de cero (y vuelve a sonar).
 *
 * Al lector no se le leen los segundos (sería un aviso por segundo): se avisa al
 * ponerlo (avisosSala) y al acabar (`onAnuncio`). Lo que queda se lee al llegar
 * aquí, por su título «Reloj».
 */
const RelojSala = ({ reloj, desfase, onAnuncio, onTerminar, onCancelar }: RelojSalaProps) => {
  const [restante, setRestante] = useState(() => queda(reloj, desfase));
  // Si ya había acabado al aparecer (p. ej. al entrar en la sala), ni suena ni se avisa
  const acabadoRef = useRef(queda(reloj, desfase) <= 0);

  useEffect(() => {
    const intervalo = window.setInterval(() => setRestante(queda(reloj, desfase)), 250);
    return () => window.clearInterval(intervalo);
  }, [reloj, desfase]);

  // Al acabar: el gong, una vez
  useEffect(() => {
    if (restante > 0 || acabadoRef.current) return;
    acabadoRef.current = true;
    tocarGong();
    onAnuncio(`Se acabó el tiempo${reloj.mensaje ? `: ${reloj.mensaje}` : ''}.`);
  }, [restante, reloj.mensaje, onAnuncio]);

  if (restante < -RELOJ_TRAS_FIN_MS) return null;
  const acabado = restante <= 0;
  const total = reloj.fin - reloj.inicio;
  const lleno = total > 0 ? Math.min(1, Math.max(0, restante / total)) : 0;
  const urgente = acabado || restante <= AVISO_FINAL_MS;

  return (
    <section aria-labelledby="sala-reloj-titulo" className="flex max-w-64 flex-col items-center gap-2 text-center">
      <h2 id="sala-reloj-titulo" className="sr-only">
        Reloj
      </h2>
      <p
        className={`font-teutonic1 text-6xl leading-none tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
          urgente ? 'text-blood-bright' : 'text-gold-bright'
        }`}
      >
        {acabado ? '¡Tiempo!' : formatoReloj(restante)}
      </p>
      {/* Lo que queda, de un vistazo (el número ya lo dice) */}
      <div aria-hidden="true" className="h-1 w-40 overflow-hidden rounded-full bg-surface-container-high">
        <div className={`h-full ${urgente ? 'bg-blood-bright' : 'bg-theme-main'}`} style={{ width: `${lleno * 100}%` }} />
      </div>
      {reloj.mensaje && (
        <p className="break-words font-ui text-base font-semibold tracking-wide text-on-surface-bright drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          {reloj.mensaje}
        </p>
      )}
      {(onTerminar || onCancelar) && (
        <div className="flex flex-wrap justify-center gap-2">
          {onTerminar && !acabado && (
            <button key="terminar" type="button" onClick={onTerminar} className={`${botonPrincipal} font-ui`}>
              Terminar reloj
            </button>
          )}
          {onCancelar && (
            <button key="cancelar" id={ID_CANCELAR_RELOJ} type="button" onClick={onCancelar} className={`${botonSecundario} font-ui`}>
              {acabado ? 'Quitar reloj' : 'Cancelar reloj'}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default RelojSala;
