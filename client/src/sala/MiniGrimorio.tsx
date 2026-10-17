import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import FichaRedonda from './FichaRedonda';
import PersonajeEnFicha from './PersonajeEnFicha';
import RecordatoriosFicha from './RecordatoriosFicha';
import { ESCALA_RECORDATORIO } from './FichaRecordatorio';
import { describirRecordatorio, useFichas } from './fichas';
import type { SalaEstado, SalaFichaEnviada, SalaRecordatorio } from './useSala';

/** El nombre corto de cada asiento: quien se sienta, o «Asiento 3» si está libre. */
export const nombresDeAsientos = (estado: SalaEstado): Record<string, string> =>
  Object.fromEntries(
    estado.asientos.map((a, i) => [a.id, estado.participantes.find((p) => p.id === a.ocupante)?.nombre ?? `Asiento ${i + 1}`]),
  );

interface MiniGrimorioProps {
  fichas: SalaFichaEnviada[];
  /** El nombre corto de cada asiento («Ana», o «Asiento 3» si está libre). */
  nombres: Record<string, string>;
  /** Para editar: la ficha elegida y cómo elegir otra (las fichas son botones). Sin esto, solo se ven. */
  elegida?: string | null;
  onElegir?: (asientoId: string) => void;
  /** Quitar un recordatorio pulsándolo (al editar). */
  onQuitarRecordatorio?: (asientoId: string, r: SalaRecordatorio) => void;
}

/**
 * Un grimorio en pequeño (el que el narrador envía al Espía o a la Viuda): las
 * fichas en círculo, como en la mesa (la 1 a las 12), cada una con su personaje,
 * su sudario si está muerto, el nombre de quien se sienta y sus recordatorios
 * hacia el centro. Las fichas encogen cuantas más hay. Usa las mismas piezas que
 * la mesa (FichaRedonda, PersonajeEnFicha, RecordatoriosFicha), con su propio
 * --sala-ficha.
 */
const MiniGrimorio = ({ fichas, nombres, elegida, onElegir, onQuitarRecordatorio }: MiniGrimorioProps) => {
  const { todosPorId } = useFichas();
  const ref = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(480);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLado(el.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const total = fichas.length;
  // Cuantas más fichas, más pequeñas (sin pasar de un sexto del lado)
  const ficha = Math.round(lado * Math.min(0.17, 1.75 / Math.max(total, 1)));
  const recordatorio = ficha * ESCALA_RECORDATORIO;

  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-square w-full max-w-[34rem]"
      style={{ '--sala-ficha': `${ficha}px` } as CSSProperties}
    >
      {/* El tapete: un círculo de tinta morada con filo de latón */}
      <div aria-hidden="true" className="absolute inset-[4%] rounded-full border border-gold/25 bg-[radial-gradient(circle,rgba(75,60,134,0.35),rgba(11,9,20,0.6))]" />
      {total === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-on-surface-muted">La mesa no tiene asientos.</p>}
      <ol className="contents">
        {fichas.map((f, i) => {
          const angulo = (2 * Math.PI * i) / total;
          const x = Math.sin(angulo);
          const y = -Math.cos(angulo);
          // El centro de la ficha, dejando sitio para el nombre por fuera
          const radio = lado / 2 - ficha * 0.72;
          const personaje = f.personaje ? todosPorId.get(f.personaje) : undefined;
          const nombre = nombres[f.asientoId] ?? `Asiento ${i + 1}`;
          const descripcion = [
            `${i + 1}, ${nombre}`,
            personaje ? personaje.nombre.texto : 'sin personaje',
            f.alineamiento ? (f.alineamiento === 'bueno' ? 'bueno' : 'malvado') : '',
            f.muerto ? 'muerto' : '',
            f.recordatorios.length ? `recordatorios: ${f.recordatorios.map((r) => describirRecordatorio(r, todosPorId.get(r.personaje))).join(', ')}` : '',
          ]
            .filter(Boolean)
            .join(', ');
          const contenido = (
            <FichaRedonda muerto={f.muerto}>{personaje && <PersonajeEnFicha personaje={personaje} alineamiento={f.alineamiento} />}</FichaRedonda>
          );
          // Los recordatorios, por dentro de la ficha, apilados hacia el centro
          const radioRec = radio - ficha / 2 - recordatorio / 2 - 2;
          return (
            <li key={f.asientoId} className="contents">
              <div
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: lado / 2 + x * radio, top: lado / 2 + y * radio }}
              >
                {onElegir ? (
                  <button
                    type="button"
                    aria-pressed={elegida === f.asientoId}
                    aria-label={descripcion}
                    onClick={() => onElegir(f.asientoId)}
                    className={`block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${
                      elegida === f.asientoId ? 'ring-2 ring-gold-bright ring-offset-2 ring-offset-background' : 'hover:brightness-110'
                    }`}
                  >
                    {contenido}
                  </button>
                ) : (
                  <span role="img" aria-label={descripcion} className="block">
                    {contenido}
                  </span>
                )}
                <span aria-hidden="true" className="mt-0.5 max-w-[calc(var(--sala-ficha)*1.4)] truncate text-center text-[0.7rem] leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
                  {nombre}
                </span>
              </div>
              <RecordatoriosFicha
                recordatorios={f.recordatorios}
                style={{ left: lado / 2 + x * radioRec, top: lado / 2 + y * radioRec }}
                hacia={{ x: -x, y: -y }}
                puedeQuitar={() => !!onQuitarRecordatorio}
                onQuitar={(r) => onQuitarRecordatorio?.(f.asientoId, r)}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default MiniGrimorio;
