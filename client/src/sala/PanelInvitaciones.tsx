import { botonPrincipal, botonSecundario } from './estilos';
import TeclaAtajo from './TeclaAtajo';
import type { Atajo } from './atajos';
import type { SalaConversacion, SalaInvitacion, SalaParticipante } from './useSala';

interface PanelInvitacionesProps {
  invitaciones: SalaInvitacion[];
  conversaciones: SalaConversacion[];
  participantes: SalaParticipante[];
  yo: string;
  onResponder: (invitacion: SalaInvitacion, aceptar: boolean) => void;
  onCancelar: (invitacion: SalaInvitacion) => void;
  /** La tecla rápida que coge esa llamada entrante (su slot), si tiene. */
  teclaLlamada?: (invitacionId: string) => Atajo | undefined;
  /** Fuera del panel de Charlas, encima de la columna: con borde propio en vez de la línea de separación. */
  fuera?: boolean;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Bea». */
const enumerar = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/**
 * Las invitaciones a conversar y las peticiones para unirse a una conversación.
 * Las recibidas, con quién se conversaría (o quién pide entrar en la tuya),
 * «Aceptar» y «Rechazar» (hasta aceptar no se entra); las enviadas, «Esperando
 * a…» y «Retirar». Si no hay ninguna, no sale. Según la preferencia de
 * accesibilidad, van dentro de la pestaña Charlas (encima de las conversaciones)
 * o fuera (`fuera`), encima de la columna lateral y a la vista.
 */
const PanelInvitaciones = ({ invitaciones, conversaciones, participantes, yo, onResponder, onCancelar, teclaLlamada, fuera = false }: PanelInvitacionesProps) => {
  if (invitaciones.length === 0) return null;
  const nombre = (id: string) => participantes.find((p) => p.id === id)?.nombre ?? 'Alguien';
  // Las peticiones para unirse llegan a todos los miembros de la conversación
  const recibidas = invitaciones.filter((i) => (i.conversacion ? i.de !== yo : i.para === yo));
  const enviadas = invitaciones.filter((i) => i.de === yo);
  const miembrosDe = (id?: string) => conversaciones.find((c) => c.id === id)?.miembros ?? [];

  return (
    <section
      aria-labelledby="sala-invitaciones-titulo"
      className={`flex flex-col gap-2 bg-theme-container/20 p-3 text-sm ${
        fuera ? 'rounded border border-theme-main/60' : 'border-b border-outline-ghost'
      }`}
    >
      <h2 id="sala-invitaciones-titulo" className="rotulo">
        Invitaciones y peticiones
      </h2>
      <ul className="flex flex-col gap-3">
        {recibidas.map((i) => {
          const tecla = teclaLlamada?.(i.id);
          if (i.conversacion) {
            return (
              <li key={i.id} className="flex flex-col gap-1">
                <p>
                  <span className="font-semibold">{nombre(i.de)}</span> pide unirse a tu conversación.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onResponder(i, true)}
                    aria-label={`Aceptar a ${nombre(i.de)} en la conversación`}
                    className={`${botonPrincipal} px-2 py-1 text-xs`}
                  >
                    Aceptar
                  </button>
                  {tecla && <TeclaAtajo atajo={tecla} ocultoALector />}
                  <button
                    type="button"
                    onClick={() => onResponder(i, false)}
                    aria-label={`Rechazar la petición de ${nombre(i.de)}`}
                    className={`${botonSecundario} px-2 py-1 text-xs`}
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            );
          }
          // Si quien invita ya está en una conversación, se entraría en ella
          const suya = conversaciones.find((c) => c.miembros.includes(i.de));
          const con = suya ? suya.miembros.filter((m) => m !== yo).map(nombre) : [nombre(i.de)];
          return (
            <li key={i.id} className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">{nombre(i.de)}</span> te invita a una conversación privada
                {suya ? ` (con ${enumerar(con)})` : ''}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onResponder(i, true)}
                  aria-label={`Aceptar la invitación de ${nombre(i.de)}`}
                  className={`${botonPrincipal} px-2 py-1 text-xs`}
                >
                  Aceptar
                </button>
                {tecla && <TeclaAtajo atajo={tecla} ocultoALector />}
                <button
                  type="button"
                  onClick={() => onResponder(i, false)}
                  aria-label={`Rechazar la invitación de ${nombre(i.de)}`}
                  className={`${botonSecundario} px-2 py-1 text-xs`}
                >
                  Rechazar
                </button>
              </div>
            </li>
          );
        })}
        {enviadas.map((i) => {
          const conversacionDe = i.conversacion ? enumerar(miembrosDe(i.conversacion).map(nombre)) : '';
          return (
            <li key={i.id} className="flex items-center justify-between gap-2">
              <p className="text-on-surface-muted">
                {i.conversacion
                  ? `Esperando a que te acepten en la conversación de ${conversacionDe}…`
                  : `Esperando a ${nombre(i.para)}…`}
              </p>
              <button
                type="button"
                onClick={() => onCancelar(i)}
                aria-label={
                  i.conversacion
                    ? `Retirar la petición para unirte a la conversación de ${conversacionDe}`
                    : `Retirar la invitación a ${nombre(i.para)}`
                }
                className={`${botonSecundario} px-2 py-0.5 text-xs`}
              >
                Retirar
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PanelInvitaciones;
