import { botonPrincipal, botonSecundario } from './estilos';
import type { SalaConversacion, SalaInvitacion, SalaParticipante } from './useSala';

interface PanelInvitacionesProps {
  invitaciones: SalaInvitacion[];
  conversaciones: SalaConversacion[];
  participantes: SalaParticipante[];
  yo: string;
  onResponder: (invitacion: SalaInvitacion, aceptar: boolean) => void;
  onCancelar: (invitacion: SalaInvitacion) => void;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Bea». */
const enumerar = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/**
 * A la izquierda, encima del chat: las invitaciones a conversar. Las recibidas,
 * con quién se conversaría, «Aceptar» y «Rechazar» (hasta aceptar no se entra);
 * las enviadas, «Esperando a…» y «Retirar». Si no hay ninguna, no sale.
 */
const PanelInvitaciones = ({ invitaciones, conversaciones, participantes, yo, onResponder, onCancelar }: PanelInvitacionesProps) => {
  if (invitaciones.length === 0) return null;
  const nombre = (id: string) => participantes.find((p) => p.id === id)?.nombre ?? 'Alguien';
  const recibidas = invitaciones.filter((i) => i.para === yo);
  const enviadas = invitaciones.filter((i) => i.de === yo);

  return (
    <section aria-labelledby="sala-invitaciones-titulo" className="flex flex-col gap-2 rounded border border-theme-main/60 bg-surface p-3 text-sm">
      <h2 id="sala-invitaciones-titulo" className="text-xs font-semibold uppercase tracking-wide text-theme-main">
        Invitaciones a conversar
      </h2>
      <ul className="flex flex-col gap-3">
        {recibidas.map((i) => {
          // Si quien invita ya está en una conversación, se entraría en ella
          const suya = conversaciones.find((c) => c.miembros.includes(i.de));
          const con = suya ? suya.miembros.filter((m) => m !== yo).map(nombre) : [nombre(i.de)];
          return (
            <li key={i.id} className="flex flex-col gap-1">
              <p>
                <span className="font-semibold">{nombre(i.de)}</span> te invita a una conversación privada
                {suya ? ` (con ${enumerar(con)})` : ''}.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onResponder(i, true)}
                  aria-label={`Aceptar la invitación de ${nombre(i.de)}`}
                  className={`${botonPrincipal} px-2 py-1 text-xs`}
                >
                  Aceptar
                </button>
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
        {enviadas.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2">
            <p className="text-on-surface-muted">Esperando a {nombre(i.para)}…</p>
            <button
              type="button"
              onClick={() => onCancelar(i)}
              aria-label={`Retirar la invitación a ${nombre(i.para)}`}
              className={`${botonSecundario} px-2 py-0.5 text-xs`}
            >
              Retirar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PanelInvitaciones;
