import { AudioLines } from 'lucide-react';
import { botonSecundario } from './estilos';
import type { SalaConversacion, SalaParticipante } from './useSala';

interface PanelConversacionesProps {
  conversaciones: SalaConversacion[];
  participantes: SalaParticipante[];
  yo: SalaParticipante;
  /** Visitantes: entrar a escuchar una (sin invitación; los jugadores no lo saben). */
  onEscuchar: (conversacionId: string) => void;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Bea». */
const enumerar = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/**
 * A la izquierda, para todos: quién está ahora en una conversación privada
 * (quién con quién, no lo que dicen). La llamada en sí se ve en el centro, solo
 * para quien está en ella. Los visitantes pueden entrar a escuchar cualquiera;
 * los narradores ven qué visitantes escuchan (los jugadores, no). Si no hay
 * ninguna, no sale.
 */
const PanelConversaciones = ({ conversaciones, participantes, yo, onEscuchar }: PanelConversacionesProps) => {
  if (conversaciones.length === 0) return null;
  const nombre = (id: string) => (id === yo.id ? 'tú' : (participantes.find((p) => p.id === id)?.nombre ?? 'Alguien'));

  return (
    <section aria-labelledby="sala-conversaciones-titulo" className="flex flex-col gap-2 rounded border border-outline-ghost bg-surface p-3 text-sm">
      <h2 id="sala-conversaciones-titulo" className="text-xs font-semibold uppercase tracking-wide text-theme-main">
        Conversaciones privadas
      </h2>
      <ul className="flex flex-col gap-2">
        {conversaciones.map((c) => {
          const estoy = c.miembros.includes(yo.id) || c.oyentes.includes(yo.id);
          return (
            <li key={c.id} className="flex items-center gap-2">
              <AudioLines size={16} className="shrink-0 text-theme-main" />
              <div className="min-w-0 flex-1">
                <p className={estoy ? 'font-semibold' : ''}>{enumerar(c.miembros.map(nombre))}</p>
                {c.oyentes.length > 0 && (
                  <p className="text-xs text-on-surface-muted">
                    {c.oyentes.length > 1 ? 'Escuchan' : 'Escucha'}: {enumerar(c.oyentes.map(nombre))}
                  </p>
                )}
              </div>
              {yo.rol === 'visitante' && !estoy && (
                <button
                  type="button"
                  onClick={() => onEscuchar(c.id)}
                  aria-label={`Escuchar la conversación de ${enumerar(c.miembros.map(nombre))}`}
                  className={`${botonSecundario} px-2 py-0.5 text-xs`}
                >
                  Escuchar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PanelConversaciones;
