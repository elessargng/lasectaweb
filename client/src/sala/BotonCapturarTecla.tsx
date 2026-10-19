import { useRef, useState, type KeyboardEvent } from 'react';
import { ATRIBUTO_CAPTURANDO, atajoDe, type Atajo } from './atajos';
import { botonSecundario } from './estilos';

interface BotonCapturarTeclaProps {
  /** id del texto que dice para qué es la tecla (se lee tras el nombre del botón). */
  describedBy: string;
  /** La tecla (o combinación) pulsada. */
  onCapturar: (atajo: Atajo) => void;
  /** Al empezar a escuchar y al cancelar con Escape. */
  onEmpezar: () => void;
  onCancelar: () => void;
  /** El texto del botón mientras no escucha. */
  texto?: string;
}

/**
 * «Cambiar» una tecla: al pulsarlo se queda escuchando y la siguiente tecla (o
 * combinación) que se pulse es la nueva; Escape cancela y Tab sale (y deja de
 * escuchar). Mientras escucha, los atajos no actúan (lleva ATRIBUTO_CAPTURANDO),
 * para poder elegir también la tecla de uno de ellos.
 */
const BotonCapturarTecla = ({ describedBy, onCapturar, onEmpezar, onCancelar, texto = 'Cambiar' }: BotonCapturarTeclaProps) => {
  const [escuchando, setEscuchando] = useState(false);
  // Al capturar Espacio o Intro con el foco aquí, el navegador hace después clic en
  // el botón: ese clic se ignora para no volver a escuchar.
  const ignorarClicRef = useRef(false);

  const capturar = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!escuchando) return;
    // Tab sigue moviendo el foco (y al salir se deja de escuchar).
    if (e.key === 'Tab') return;
    e.preventDefault();
    // Que Escape no cierre el diálogo: aquí solo cancela.
    e.stopPropagation();
    if (e.key === 'Escape') {
      setEscuchando(false);
      onCancelar();
      return;
    }
    const atajo = atajoDe(e);
    if (!atajo) return; // solo un modificador: se espera a la tecla
    ignorarClicRef.current = true;
    setEscuchando(false);
    onCapturar(atajo);
  };

  return (
    <button
      type="button"
      aria-describedby={describedBy}
      onClick={() => {
        if (ignorarClicRef.current) {
          ignorarClicRef.current = false;
          return;
        }
        if (!escuchando) onEmpezar();
        setEscuchando(!escuchando);
      }}
      onKeyUp={() => {
        // Si la tecla no ha acabado en clic (no era Espacio ni Intro), no hay nada que ignorar.
        window.setTimeout(() => (ignorarClicRef.current = false), 0);
      }}
      onKeyDown={capturar}
      onBlur={() => setEscuchando(false)}
      {...{ [ATRIBUTO_CAPTURANDO]: escuchando ? '' : undefined }}
      className={botonSecundario}
    >
      {escuchando ? 'Pulsa la nueva tecla (Escape para cancelar)' : texto}
    </button>
  );
};

export default BotonCapturarTecla;
