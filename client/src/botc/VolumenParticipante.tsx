import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

interface VolumenParticipanteProps {
  nombre: string;
  /** Al que se le oye ahora (0 a 1). */
  volumen: number;
  onCambiar: (volumen: number) => void;
}

const porCiento = (v: number) => Math.round(v * 100);

/**
 * El volumen al que se oye a alguien (en la lista de participantes): un altavoz
 * junto a su nombre, que se ve al pasar el ratón por la fila o al llegarle el foco
 * (siempre, en pantallas táctiles, o si ya se le ha cambiado el volumen). Al
 * pulsarlo se abre un deslizador de 0 a 100 %, con el foco en él; Escape, o
 * pulsar fuera, lo cierra y el foco vuelve al altavoz.
 *
 * El botón dice a qué volumen está («Volumen de Ana, 50 %»); el deslizador, su valor.
 */
const VolumenParticipante = ({ nombre, volumen, onCambiar }: VolumenParticipanteProps) => {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const cajaRef = useRef<HTMLSpanElement>(null);
  const deslizadorRef = useRef<HTMLInputElement>(null);
  const valor = porCiento(volumen);
  const cambiado = valor !== 100;
  const Icono = valor === 0 ? VolumeX : valor < 50 ? Volume1 : Volume2;

  useEffect(() => {
    if (!abierto) return;
    deslizadorRef.current?.focus();
    // Pulsar fuera lo cierra (sin mover el foco: ya está donde se ha pulsado)
    const fuera = (e: PointerEvent) => {
      if (!cajaRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  // Escape solo cierra el deslizador (no el panel de participantes, que también lo escucha)
  const alTeclear = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !abierto) return;
    e.preventDefault();
    e.stopPropagation();
    setAbierto(false);
    botonRef.current?.focus();
  };

  return (
    <span ref={cajaRef} className="relative inline-flex">
      <button
        ref={botonRef}
        type="button"
        aria-label={`Volumen de ${nombre}, ${valor} %`}
        aria-expanded={abierto}
        aria-controls={`${id}-panel`}
        onClick={() => setAbierto((a) => !a)}
        className={`flex h-6 w-6 items-center justify-center rounded hover:text-gold-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main focus:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100 ${
          // Con el volumen cambiado, a la vista y en latón; si no, solo al pasar por la fila
          cambiado ? 'text-gold opacity-100' : 'text-on-surface-muted opacity-0 group-hover:opacity-100'
        }`}
      >
        <Icono size={15} />
      </button>
      <span
        id={`${id}-panel`}
        hidden={!abierto}
        className="absolute right-0 top-full z-30 mt-1 flex w-52 flex-col gap-1.5 sala-cofre p-3"
      >
        <label htmlFor={`${id}-deslizador`} className="text-xs text-on-surface-muted">
          Volumen de {nombre}
        </label>
        <span className="flex items-center gap-2">
          <input
            ref={deslizadorRef}
            id={`${id}-deslizador`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={valor}
            aria-valuetext={`${valor} %`}
            onChange={(e) => onCambiar(Number(e.target.value) / 100)}
            onKeyDown={alTeclear}
            className="min-w-0 flex-1 accent-[var(--color-theme-main)]"
          />
          <span aria-hidden="true" className="w-10 text-right font-ui text-xs tabular-nums text-on-surface">
            {valor} %
          </span>
        </span>
      </span>
    </span>
  );
};

export default VolumenParticipante;
