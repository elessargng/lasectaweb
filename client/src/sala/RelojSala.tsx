import { useEffect, useRef, useState } from 'react';
import { botonSecundario } from './estilos';
import { formatoReloj, RELOJ_TRAS_FIN_MS } from './reloj';
import { tocarGong } from './sonidos';
import type { SalaReloj } from './useSala';

interface RelojSalaProps {
  reloj: SalaReloj;
  /** Reloj del servidor menos el de aquí (ms). */
  desfase: number;
  /** Aviso al lector al acabar el tiempo. */
  onAnuncio: (texto: string) => void;
  /** Quitar el reloj (solo narradores); si no, no sale el botón. */
  onQuitar?: () => void;
}

/** Los últimos segundos se ven en rojo (alerta). */
const AVISO_FINAL_MS = 10_000;

/** Lo que queda (ms, puede ser negativo), con el reloj del servidor. */
const queda = (reloj: SalaReloj, desfase: number) => reloj.fin - (Date.now() + desfase);

/**
 * El reloj del narrador, al lado del reparto de la partida, para todos: su mensaje
 * y lo que queda (minutos:segundos), con una barra que se vacía. Al acabar suena
 * el gong y pone «¡Tiempo!» un rato; luego desaparece. Quien la usa la monta con
 * `key` = su inicio, así que un reloj nuevo empieza de cero (y vuelve a sonar).
 *
 * Al lector no se le leen los segundos (sería un aviso por segundo): se avisa al
 * ponerlo (avisosSala) y al acabar (`onAnuncio`). Lo que queda se lee al llegar
 * aquí, por su título «Reloj».
 */
const RelojSala = ({ reloj, desfase, onAnuncio, onQuitar }: RelojSalaProps) => {
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
    <section aria-labelledby="sala-reloj-titulo" className="sala-aviso self-end px-3 py-2 text-sm">
      <h2 id="sala-reloj-titulo" className="rotulo">
        Reloj
      </h2>
      {reloj.mensaje && <p className="max-w-56 break-words text-on-surface">{reloj.mensaje}</p>}
      <p className={`font-ui text-3xl leading-tight tabular-nums ${urgente ? 'text-blood-bright' : 'text-theme-main'}`}>
        {acabado ? '¡Tiempo!' : formatoReloj(restante)}
      </p>
      {/* Lo que queda, de un vistazo (el número ya lo dice) */}
      <div aria-hidden="true" className="mt-1 h-1 w-full min-w-32 overflow-hidden rounded-full bg-surface-container-high">
        <div className={`h-full ${urgente ? 'bg-blood-bright' : 'bg-theme-main'}`} style={{ width: `${lleno * 100}%` }} />
      </div>
      {onQuitar && (
        <button type="button" onClick={onQuitar} className={`${botonSecundario} mt-2 w-full font-ui`}>
          Quitar reloj
        </button>
      )}
    </section>
  );
};

export default RelojSala;
