import { useState } from 'react';
import CuadroAvatar from './CuadroAvatar';
import CuadroNarrador from './CuadroNarrador';
import { botonPrincipal } from './estilos';
import { ID_SIN_NARRADOR } from './ids';
import type { SalaEstado, SalaResultado } from './useSala';

interface ZonaNarradoresProps {
  estado: SalaEstado;
  /** Pide una acción a la sala (ver `useSala`). */
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Para avisar de errores de las acciones. */
  onError: (mensaje: string) => void;
}

/**
 * Arriba a la izquierda: un cuadro por narrador, uno al lado del otro, y debajo
 * «Hacerse narrador» si el servidor lo permite (`estado.acciones`). Las opciones
 * del narrador van en la cabecera (MenuNarrador).
 */
const ZonaNarradores = ({ estado, pedir, onError }: ZonaNarradoresProps) => {
  const [pidiendo, setPidiendo] = useState(false);

  const narradores = estado.participantes.filter((p) => p.rol === 'narrador');
  const puede = (accion: string) => estado.acciones.includes(accion);

  const actuar = async (accion: string, datos?: unknown) => {
    const r = await pedir(accion, datos);
    if (!r.ok) onError(r.error);
    return r.ok;
  };

  // Sin `disabled` mientras responde: desactivar el botón con el foco dentro lo tira al body.
  const hacerseNarrador = async () => {
    if (pidiendo) return;
    setPidiendo(true);
    await actuar('sala:hacerseNarrador');
    setPidiendo(false);
  };

  return (
    <div className="flex shrink-0 flex-col gap-3">
      {narradores.length > 0 ? (
        <ul className="flex flex-wrap gap-4">
          {narradores.map((n) => (
            <li key={n.id}>
              <CuadroNarrador narrador={n} esYo={n.id === estado.yo} />
            </li>
          ))}
        </ul>
      ) : (
        <CuadroAvatar
          titulo="Narrador"
          vacio
          contenido={
            <p id={ID_SIN_NARRADOR} tabIndex={-1} className="text-center text-sm text-on-surface-muted focus:outline-none">
              La sala no tiene narrador.
            </p>
          }
        />
      )}

      {puede('sala:hacerseNarrador') && (
        <div className="w-40">
          <button type="button" onClick={hacerseNarrador} aria-disabled={pidiendo} className={`${botonPrincipal} w-full`}>
            Hacerse narrador
          </button>
        </div>
      )}

    </div>
  );
};

export default ZonaNarradores;
