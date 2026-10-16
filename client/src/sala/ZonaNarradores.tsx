import { useState } from 'react';
import AccesoGrimorio from './AccesoGrimorio';
import type { ContactoParticipante } from './BotonesContacto';
import type { PistasParticipante } from './useVideollamada';
import CuadroAvatar from './CuadroAvatar';
import CuadroNarrador from './CuadroNarrador';
import { botonPrincipal } from './estilos';
import { ID_SIN_NARRADOR } from './ids';
import type { SalaEstado, SalaParticipante, SalaResultado } from './useSala';

interface ZonaNarradoresProps {
  estado: SalaEstado;
  /** Pide una acción a la sala (ver `useSala`). */
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Para avisar de errores de las acciones. */
  onError: (mensaje: string) => void;
  /** Escribir y conversar con un narrador (lo que se pueda). */
  contacto?: (participante: SalaParticipante) => ContactoParticipante | undefined;
  /** Lo que se ve y se oye de cada uno en la mesa. */
  pistas?: Map<string, PistasParticipante>;
}

/**
 * Arriba a la izquierda: un cuadro por narrador, uno al lado del otro. Sin
 * narrador, un cuadro vacío con «Hacerse narrador» dentro si el servidor lo
 * permite (`estado.acciones`); también está en el menú de usuario. Las opciones
 * del narrador van en la cabecera (MenuNarrador).
 *
 * Debajo, para los narradores, quién pide ver el grimorio.
 */
const ZonaNarradores = ({ estado, pedir, onError, contacto, pistas }: ZonaNarradoresProps) => {
  const [pidiendo, setPidiendo] = useState(false);

  const narradores = estado.participantes.filter((p) => p.rol === 'narrador');
  const yo = estado.participantes.find((p) => p.id === estado.yo);
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
              <CuadroNarrador
                narrador={n}
                esYo={n.id === estado.yo}
                contacto={contacto?.(n)}
                video={pistas?.get(n.id)?.video}
                espejo={n.id === estado.yo}
                hablando={pistas?.get(n.id)?.hablando}
                enConversacion={estado.conversaciones.some((c) => c.miembros.includes(n.id))}
                escuchando={estado.conversaciones.some((c) => c.oyentes.includes(n.id))}
                // Micro cerrado en la mesa (quien conversa o escucha ya lleva su icono)
                silenciado={
                  !!pistas?.get(n.id) &&
                  !pistas.get(n.id)!.microfono &&
                  !estado.conversaciones.some((c) => c.miembros.includes(n.id) || c.oyentes.includes(n.id))
                }
                grimorio={
                  puede('sala:solicitarGrimorio')
                    ? { onSolicitar: () => void actuar('sala:solicitarGrimorio') }
                    : yo?.rol === 'visitante' && yo.accesoGrimorio === 'solicitado'
                      ? 'solicitado'
                      : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <CuadroAvatar
          titulo="Narrador"
          vacio
          contenido={
            <div className="flex flex-col items-center gap-2 text-center">
              {/* No se ve (el cuadro vacío ya lo dice), pero el lector lo lee y recibe el foco al quedarse la sala sin narrador */}
              <p id={ID_SIN_NARRADOR} tabIndex={-1} className="sr-only">
                La sala no tiene narrador.
              </p>
              {puede('sala:hacerseNarrador') && (
                <button
                  type="button"
                  onClick={hacerseNarrador}
                  aria-disabled={pidiendo}
                  className={`${botonPrincipal} px-2 py-1 text-xs`}
                >
                  Hacerse narrador
                </button>
              )}
            </div>
          }
        />
      )}
      {yo && <AccesoGrimorio estado={estado} yo={yo} pedir={pedir} onError={onError} />}
    </div>
  );
};

export default ZonaNarradores;
