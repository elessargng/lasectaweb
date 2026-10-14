import { useRef } from 'react';
import { botonPrincipal, botonSecundario } from './estilos';
import { idNombreNarrador } from './ids';
import type { SalaEstado, SalaParticipante, SalaResultado } from './useSala';

interface AccesoGrimorioProps {
  estado: SalaEstado;
  yo: SalaParticipante;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
}

/**
 * Debajo de los narradores, para ellos: quién pide ver el grimorio, con Aceptar
 * y Rechazar. Si no lo pide nadie, no sale. (Quién lo tiene se ve en la lista de
 * participantes, con un libro.)
 */
const AccesoGrimorio = ({ estado, yo, pedir, onError }: AccesoGrimorioProps) => {
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const actuar = async (accion: string, datos?: unknown) => {
    const r = await pedir(accion, datos);
    if (!r.ok) onError(r.error);
    return r.ok;
  };

  if (yo.rol === 'narrador') {
    const visitantes = estado.participantes.filter((p) => p.rol === 'visitante');
    const piden = visitantes.filter((p) => p.accesoGrimorio === 'solicitado');
    if (piden.length === 0) return null;

    // La fila respondida desaparece: el foco va al título (o, si ya no queda nada, al propio nombre).
    const responder = async (p: SalaParticipante, conceder: boolean) => {
      if (!(await actuar('narrador:accesoGrimorio', { participanteId: p.id, conceder }))) return;
      window.setTimeout(() => {
        (tituloRef.current ?? document.getElementById(idNombreNarrador(yo.id)))?.focus();
      }, 0);
    };

    return (
      <section aria-labelledby="sala-acceso-grimorio" className="max-w-xs rounded border border-theme-main/60 bg-surface p-3 text-sm">
        <h2 id="sala-acceso-grimorio" ref={tituloRef} tabIndex={-1} className="mb-2 font-semibold text-theme-main focus:outline-none">
          Grimorio
        </h2>
        <ul className="flex flex-col gap-3">
          {piden.map((p) => (
            <li key={p.id} className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">{p.nombre}</span> pide ver el grimorio.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void responder(p, true)}
                  aria-label={`Aceptar a ${p.nombre}`}
                  className={`${botonPrincipal} px-2 py-1 text-xs`}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => void responder(p, false)}
                  aria-label={`Rechazar a ${p.nombre}`}
                  className={`${botonSecundario} px-2 py-1 text-xs`}
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return null;
};

export default AccesoGrimorio;
