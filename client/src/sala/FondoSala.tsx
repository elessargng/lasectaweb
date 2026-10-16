import { ImagePlus, Library, RotateCcw } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { urlDelServidor } from '../utils/api';
import { compressImage } from '../utils/image';
import { useAriaLive } from './avisosConfig';
import { botonSecundario } from './estilos';
import SelectorFondoBiblioteca from './SelectorFondoBiblioteca';
import type { SalaResultado } from './useSala';

/** Cómo se cambia el fondo (ver la acción narrador:cambiarFondo del servidor). */
export type CambioFondo = { predeterminado: true } | { imagen: string } | { biblioteca: string };

interface FondoSalaProps {
  /** El fondo actual (ruta en el servidor), o null: el de por defecto. */
  fondo: string | null;
  onCambiar: (cambio: CambioFondo) => Promise<SalaResultado>;
}

/** Lado máximo con el que se sube un fondo: de sobra para una pantalla grande. */
const LADO_FONDO = 1920;
const FONDO_PREDETERMINADO = '/fondos/predeterminado.webp';

/**
 * En la pestaña Partida (narradores): el fondo de la sala, para todos. Se ve
 * el actual en pequeño y se cambia subiendo una imagen del ordenador, eligiendo
 * una de la Biblioteca de la web (navegando por sus carpetas, se abre debajo) o
 * volviendo al de por defecto. El resultado se dice al momento.
 */
const FondoSala = ({ fondo, onCambiar }: FondoSalaProps) => {
  const [biblioteca, setBiblioteca] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const ariaLive = useAriaLive(resultado && !resultado.ok ? 'errores' : 'preferencias');

  const cambiar = async (cambio: CambioFondo, texto: string) => {
    if (enviando) return;
    setEnviando(true);
    setResultado(null);
    const r = await onCambiar(cambio);
    setEnviando(false);
    setResultado(r.ok ? { ok: true, texto } : { ok: false, texto: r.error });
    if (r.ok) setBiblioteca(false);
  };

  const subir = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      const imagen = await compressImage(archivo, LADO_FONDO);
      await cambiar({ imagen }, 'Fondo cambiado por tu imagen.');
    } catch {
      setResultado({ ok: false, texto: 'No se pudo leer la imagen. Prueba con otra.' });
    }
  };

  const boton = `${botonSecundario} flex items-center gap-1.5 text-sm`;
  return (
    <section aria-labelledby="sala-fondo-titulo" className="flex flex-col gap-3">
      <h3 id="sala-fondo-titulo" className="text-sm">
        Fondo de la sala
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <img
          src={fondo ? urlDelServidor(fondo) : FONDO_PREDETERMINADO}
          alt=""
          className="h-20 w-36 rounded border border-outline-ghost object-cover"
        />
        <p className="text-xs text-on-surface-muted">{fondo ? 'Ahora: una imagen elegida.' : 'Ahora: el de por defecto.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* Subir una imagen del ordenador */}
        <label className={`${boton} cursor-pointer focus-within:ring-2 focus-within:ring-theme-main`}>
          <ImagePlus size={16} />
          Subir imagen…
          <input type="file" accept="image/*" onChange={(e) => void subir(e)} className="sr-only" />
        </label>
        <button
          type="button"
          aria-expanded={biblioteca}
          aria-controls="sala-fondo-biblioteca"
          onClick={() => setBiblioteca((b) => !b)}
          className={boton}
        >
          <Library size={16} />
          Elegir de la Biblioteca
        </button>
        <button
          type="button"
          aria-disabled={!fondo || enviando}
          onClick={() => fondo && void cambiar({ predeterminado: true }, 'Vuelve el fondo de por defecto.')}
          className={`${boton} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
        >
          <RotateCcw size={16} />
          Fondo por defecto
        </button>
      </div>
      <div aria-live={ariaLive}>
        {enviando && <p className="text-sm text-on-surface-muted">Cambiando el fondo…</p>}
        {resultado && <p className={`text-sm ${resultado.ok ? 'text-on-surface-muted' : 'text-blood-pale'}`}>{resultado.texto}</p>}
      </div>
      <div id="sala-fondo-biblioteca" hidden={!biblioteca}>
        {biblioteca && (
          <SelectorFondoBiblioteca
            onElegir={(version, titulo) => void cambiar({ biblioteca: version.id }, `Fondo cambiado por «${titulo}».`)}
          />
        )}
      </div>
    </section>
  );
};

export default FondoSala;
