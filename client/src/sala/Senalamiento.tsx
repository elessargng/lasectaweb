import { Crosshair } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { botonPrincipal } from './estilos';
import { anguloAsiento } from './geometriaMesa';
import Mano from './Mano';
import type { EstiloMano } from './marcas';
import { resultadoSenalamiento } from './senales';
import { tocarCuentaAtras } from './sonidos';
import type { SalaEstado, SalaSenalamiento } from './useSala';

/** Lo que dura el sonido de la cuenta atrás (3, 2, 1, 0): suena en los últimos segundos. */
const SONIDO_MS = 4000;

/** El radio del círculo de las fichas, en CSS (como posicionFicha de Mesa). */
const RADIO =
  '(50% - var(--sala-avatar, 10rem) / 2 - var(--sala-ficha-distancia, 0.75) * (var(--sala-avatar, 10rem) + var(--sala-ficha, 4.5rem)) / 2)';
const n = (v: number) => v.toFixed(4);

/** Un punto del círculo de las fichas: (px, py) radios desde el centro de la mesa. */
const punto = (px: number, py: number): CSSProperties => ({
  left: `calc(50% + ${n(px)} * ${RADIO})`,
  top: `calc(50% + ${n(py)} * ${RADIO})`,
});

/** Dónde está la ficha `i` en el círculo de radio 1 (x a la derecha, y hacia abajo). */
const enCirculo = (i: number, total: number) => {
  const angulo = anguloAsiento(i, total);
  return { x: Math.sin(angulo), y: -Math.cos(angulo) };
};

interface ManosSenalamientoProps {
  estado: SalaEstado;
  senalamiento: SalaSenalamiento;
  /** Mi asiento, si señalo: mi ficha señalada lleva mi marca. */
  miAsiento: string | null;
}

/**
 * Sobre la mesa, lo que se señala, como las manos al votar: dentro de cada ficha
 * que señala, en grande, una mano (en el estilo de su jugador) girada hacia la
 * señalada; quien se señala a sí mismo, hacia su cuadro (su avatar o su cámara).
 * Dentro de la ficha que he señalado yo, en grande, mi marca (una mira). Se coloca
 * con las mismas variables que las fichas (tamaños y distancia), así que las sigue
 * sola. Todo es visual: lo dice el nombre de cada ficha. No recibe el ratón.
 */
export function ManosSenalamiento({ estado, senalamiento, miAsiento }: ManosSenalamientoProps) {
  const { asientos, participantes } = estado;
  const total = asientos.length;
  const indice = (id: string) => asientos.findIndex((a) => a.id === id);
  if (total === 0) return null;

  const senales = Object.entries(senalamiento.senales).flatMap(([desde, hasta]) => {
    const i = indice(desde);
    const j = indice(hasta);
    if (i < 0 || j < 0) return [];
    const a = enCirculo(i, total);
    const b = enCirculo(j, total);
    const ocupante = participantes.find((p) => p.id === asientos[i].ocupante);
    return [
      {
        desde,
        sitio: punto(a.x, a.y),
        // Grados desde arriba, como las agujas del reloj (la mano dibujada apunta arriba). Las dos
        // fichas están en el mismo círculo: la dirección no depende de su radio. A sí mismo, hacia
        // fuera de la plaza: a su cuadro (su avatar o su cámara), que está detrás de su ficha.
        giro: (i === j ? Math.atan2(a.x, -a.y) : Math.atan2(b.x - a.x, -(b.y - a.y))) * (180 / Math.PI),
        estilo: ocupante?.estiloMano as EstiloMano | undefined,
      },
    ];
  });
  const miObjetivo = miAsiento ? senalamiento.senales[miAsiento] : undefined;
  const iObjetivo = miObjetivo ? indice(miObjetivo) : -1;
  const marca = iObjetivo >= 0 ? enCirculo(iObjetivo, total) : null;
  const enFicha = 'absolute block h-[calc(var(--sala-ficha,4.5rem)*0.78)] w-[calc(var(--sala-ficha,4.5rem)*0.78)]';

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[25]">
      {marca && (
        // Mi marca, debajo de la mano si esa ficha también señala
        <span className={`sala-senal-marca ${enFicha} -translate-x-1/2 -translate-y-1/2 text-gold-bright`} style={punto(marca.x, marca.y)}>
          <Crosshair className="h-full w-full" strokeWidth={2.25} />
        </span>
      )}
      {senales.map((s) => (
        <span key={s.desde} className={`sala-senal-mano ${enFicha}`} style={{ ...s.sitio, transform: `translate(-50%, -50%) rotate(${s.giro}deg)` }}>
          <Mano forma="senalar" estilo={s.estilo} className="block h-full w-full drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]" />
        </span>
      ))}
    </div>
  );
}

interface PanelSenalamientoProps {
  estado: SalaEstado;
  senalamiento: SalaSenalamiento;
  congelado: boolean;
  /** Reloj del servidor menos el de aquí (ms). */
  desfase: number;
  /** Puedo señalar ahora (soy de los que señalan y no se ha congelado). */
  puedoSenalar: boolean;
  /** Narrador: el botón de terminarlo. */
  onTerminar?: () => void;
  /** Ancho máximo (px), para no tapar las fichas. */
  anchoMax: number;
}

/**
 * En el centro de la plaza: el mensaje, en grande y en latón; la cuenta atrás
 * (de día, con su sonido en los últimos 4 segundos; de noche, en silencio); qué
 * hacer, si me toca, y al congelarse, el resultado. El narrador lo termina con
 * su botón. Lo que se ve aquí se anuncia aparte (Mesa), así que es solo visual
 * salvo el botón.
 */
export function PanelSenalamiento({ estado, senalamiento: s, congelado, desfase, puedoSenalar, onTerminar, anchoMax }: PanelSenalamientoProps) {
  const [quedan, setQuedan] = useState<number | null>(null);
  useEffect(() => {
    if (s.fin === null) return;
    const fin = s.fin;
    const medir = () => setQuedan(Math.max(0, Math.ceil((fin - (Date.now() + desfase)) / 1000)));
    const intervalo = window.setInterval(medir, 200);
    const primero = window.setTimeout(medir, 0);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(primero);
    };
  }, [s.fin, desfase]);

  // De día, el sonido de la cuenta atrás en los últimos 4 segundos (quien entra tarde, desde
  // donde vaya); de noche, nada. Si se termina antes, se para.
  useEffect(() => {
    if (!s.publico || s.fin === null || s.congelado) return;
    const terminaEn = s.fin - desfase;
    if (terminaEn - Date.now() < 1000) return;
    return tocarCuentaAtras(terminaEn - SONIDO_MS);
  }, [s.publico, s.fin, s.congelado, desfase]);

  const mensaje = s.mensaje || (s.tipo === 'lilmonsta' ? "Lil' Monsta" : 'Señalad');
  return (
    <div className="sala-senal-placa flex flex-col items-center gap-2 text-center" style={{ maxWidth: anchoMax }}>
      <div aria-hidden="true" className="flex flex-col items-center gap-1">
        <span className="sala-senal-rotulo font-ui text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-gold">
          {s.publico ? 'Señalamiento' : 'Señalamiento · noche'}
        </span>
        <span className="sala-ganador-filo !w-full" />
        <p
          key={s.id}
          className="sala-senal-mensaje font-display leading-tight"
          style={{ fontSize: `clamp(1.5rem, ${Math.round(anchoMax / 7.5)}px, 3.5rem)` }}
        >
          {mensaje}
        </p>
        <span className="sala-ganador-filo !w-full" />
        {s.fin !== null && (
          <p
            className={`font-teutonic1 leading-none text-gold-bright tabular-nums drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] ${
              congelado ? 'text-3xl' : 'text-5xl'
            }`}
          >
            {congelado ? '¡Tiempo!' : (quedan ?? '')}
          </p>
        )}
        <p className="max-w-full rounded border border-gold/30 bg-background/80 px-3 py-1 text-sm text-on-surface-bright">
          {congelado
            ? resultadoSenalamiento(estado, s)
            : puedoSenalar
              ? 'Pulsa la ficha que señalas.'
              : s.tipo === 'lilmonsta'
                ? 'Hasta que todos los esbirros señalen al mismo.'
                : 'Señalando…'}
        </p>
      </div>
      {onTerminar && (
        <button type="button" onClick={onTerminar} className={botonPrincipal}>
          Finalizar señalamiento
        </button>
      )}
    </div>
  );
}
