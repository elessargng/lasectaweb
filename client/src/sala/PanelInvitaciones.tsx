import { Phone, PhoneIncoming, PhoneOff, PhoneOutgoing } from 'lucide-react';
import { describirAtajo, simboloAtajo, type Atajo } from './atajos';
import type { ConversacionDto, InvitacionDto, ParticipanteDto } from './useSala';

interface PanelInvitacionesProps {
  invitaciones: InvitacionDto[];
  conversaciones: ConversacionDto[];
  participantes: ParticipanteDto[];
  yo: string;
  onResponder: (invitacion: InvitacionDto, aceptar: boolean) => void;
  onCancelar: (invitacion: InvitacionDto) => void;
  /** La tecla rápida que coge esa llamada entrante (su slot), si tiene. */
  teclaLlamada?: (invitacionId: string) => Atajo | undefined;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Bea». */
const enumerar = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/** «Llamada entrante», «2 llamadas entrantes». */
const tituloEntrantes = (n: number) => (n === 1 ? 'Llamada entrante' : `${n} llamadas entrantes`);

/** El atajo como lo pide aria-keyshortcuts: «Control+Alt+1», «Space». */
const atajoAria = (a: Atajo) =>
  [a.ctrl && 'Control', a.alt && 'Alt', a.shift && 'Shift', a.meta && 'Meta', a.key === ' ' ? 'Space' : a.key].filter(Boolean).join('+');

/**
 * Descolgar (verde, con la tecla que la coge encima) y colgar (lacre): dos
 * medallones de solo icono. Su nombre lo dice todo al lector, tecla incluida
 * (en el nombre y en aria-keyshortcuts); al pasar el ratón, el mismo texto.
 */
const BotonesLlamada = ({
  descolgar,
  colgar,
  tecla,
  onDescolgar,
  onColgar,
}: {
  descolgar: string;
  colgar: string;
  tecla?: Atajo;
  onDescolgar: () => void;
  onColgar: () => void;
}) => {
  const conTecla = tecla ? `${descolgar} (atajo: ${describirAtajo(tecla)})` : descolgar;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={onColgar} aria-label={colgar} title={colgar} className="sala-llamada-boton sala-llamada-colgar">
        <PhoneOff size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDescolgar}
        aria-label={conTecla}
        aria-keyshortcuts={tecla ? atajoAria(tecla) : undefined}
        title={conTecla}
        className="sala-llamada-boton sala-llamada-descolgar"
      >
        <Phone size={18} strokeWidth={1.75} aria-hidden="true" />
        {/* La tecla que la coge, como una tecla pequeña en la esquina (el lector ya la oye en el nombre) */}
        {tecla && (
          <kbd aria-hidden="true" className="sala-llamada-tecla">
            {simboloAtajo(tecla)}
          </kbd>
        )}
      </button>
    </div>
  );
};

/**
 * Las llamadas: las entrantes (invitaciones a conversar y peticiones para unirse
 * a la tuya) y las que haces tú, que esperan respuesta. Salen como un aviso
 * emergente encima de la columna lateral, a la vista se vea el panel que se vea
 * (y aunque esté contraída): al aparecer, se despliega y empuja la columna hacia
 * abajo para caber. Cada entrante: quién te llama, colgar y descolgar (con la
 * tecla que la coge); cada saliente: a quién llamas y colgar. Si no hay
 * ninguna, no sale.
 */
const PanelInvitaciones = ({ invitaciones, conversaciones, participantes, yo, onResponder, onCancelar, teclaLlamada }: PanelInvitacionesProps) => {
  if (invitaciones.length === 0) return null;
  const nombre = (id: string) => participantes.find((p) => p.id === id)?.nombre ?? 'Alguien';
  // Las peticiones para unirse llegan a todos los miembros de la conversación
  const recibidas = invitaciones.filter((i) => (i.conversacion ? i.de !== yo : i.para === yo));
  const enviadas = invitaciones.filter((i) => i.de === yo);
  if (recibidas.length === 0 && enviadas.length === 0) return null;
  const miembrosDe = (id?: string) => conversaciones.find((c) => c.id === id)?.miembros ?? [];
  // A un narrador le llaman aunque esté conversando: al descolgar, deja la suya
  const mia = conversaciones.find((c) => c.miembros.includes(yo));
  const titulo = recibidas.length > 0 ? tituloEntrantes(recibidas.length) : enviadas.length === 1 ? 'Llamando' : `Llamando a ${enviadas.length}`;

  return (
    <div className="sala-llamadas">
      <section aria-labelledby="sala-invitaciones-titulo" className="sala-llamadas-caja">
        <h2 id="sala-invitaciones-titulo" className="flex items-center gap-2 px-3 pt-2.5 font-ui text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-gold">
          {recibidas.length > 0 ? (
            <PhoneIncoming size={13} aria-hidden="true" className="sala-llamada-timbre" />
          ) : (
            <PhoneOutgoing size={13} aria-hidden="true" />
          )}
          {/* El número, a la vista en su insignia; el lector oye «2 llamadas entrantes» */}
          {recibidas.length > 1 ? (
            <>
              <span aria-hidden="true">Llamadas entrantes</span>
              <span aria-hidden="true" className="sala-contador min-w-[1.1rem] rounded-full px-1 text-center text-[0.6rem] font-bold leading-[1.1rem] tracking-normal">
                {recibidas.length}
              </span>
              <span className="sr-only">{titulo}</span>
            </>
          ) : (
            titulo
          )}
        </h2>
        <ul className="flex flex-col divide-y divide-gold/10">
          {recibidas.map((i) => {
            const tecla = teclaLlamada?.(i.id);
            const quien = nombre(i.de);
            if (i.conversacion) {
              return (
                <li key={i.id} className="sala-llamada-fila">
                  <p className="min-w-0 flex-1 leading-snug">
                    <span className="block truncate font-semibold text-on-surface-bright">{quien}</span>
                    <span className="block text-xs text-on-surface-muted">pide unirse a tu conversación</span>
                  </p>
                  <BotonesLlamada
                    descolgar={`Aceptar a ${quien} en la conversación`}
                    colgar={`Rechazar la petición de ${quien}`}
                    tecla={tecla}
                    onDescolgar={() => onResponder(i, true)}
                    onColgar={() => onResponder(i, false)}
                  />
                </li>
              );
            }
            // Si quien llama ya está en una conversación, se entraría en ella
            const suya = conversaciones.find((c) => c.miembros.includes(i.de));
            const otros = suya ? suya.miembros.filter((m) => m !== yo && m !== i.de).map(nombre) : [];
            const saleDeLaMia = !!mia && mia !== suya;
            return (
              <li key={i.id} className="sala-llamada-fila">
                <p className="min-w-0 flex-1 leading-snug">
                  <span className="block truncate font-semibold text-on-surface-bright">{quien}</span>
                  <span className="block text-xs text-on-surface-muted">
                    te llama{otros.length > 0 ? ` (con ${enumerar(otros)})` : ''}
                  </span>
                  {saleDeLaMia && <span className="block text-xs text-gold/80">Si descuelgas, sales de la tuya.</span>}
                </p>
                <BotonesLlamada
                  descolgar={`Descolgar la llamada de ${quien}`}
                  colgar={`Colgar la llamada de ${quien}`}
                  tecla={tecla}
                  onDescolgar={() => onResponder(i, true)}
                  onColgar={() => onResponder(i, false)}
                />
              </li>
            );
          })}
          {enviadas.map((i) => {
            const conversacionDe = i.conversacion ? enumerar(miembrosDe(i.conversacion).map(nombre)) : '';
            const colgar = i.conversacion
              ? `Retirar la petición para unirte a la conversación de ${conversacionDe}`
              : `Colgar: retirar la llamada a ${nombre(i.para)}`;
            return (
              <li key={i.id} className="sala-llamada-fila">
                <p className="min-w-0 flex-1 text-xs leading-snug text-on-surface-muted">
                  {i.conversacion ? (
                    <>Esperando a que te acepten en la conversación de {conversacionDe}…</>
                  ) : (
                    <>
                      Llamando a <span className="font-semibold text-on-surface">{nombre(i.para)}</span>…
                    </>
                  )}
                </p>
                <button type="button" onClick={() => onCancelar(i)} aria-label={colgar} title={colgar} className="sala-llamada-boton sala-llamada-colgar">
                  <PhoneOff size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default PanelInvitaciones;
