import { AudioLines } from 'lucide-react';
import type { ReactNode } from 'react';
import { botonSecundario } from './estilos';
import NombresOyentes from './NombresOyentes';
import type { SalaConversacion, SalaParticipante } from './useSala';

interface PanelConversacionesProps {
  conversaciones: SalaConversacion[];
  participantes: SalaParticipante[];
  yo: SalaParticipante;
  /** Visitantes y narradores: entrar a escuchar una (sin invitación; los jugadores no lo saben). */
  onEscuchar: (conversacionId: string) => void;
  /** Narradores: entrar en una como uno más (se les ve y se les oye). */
  onEntrar: (conversacionId: string) => void;
  /** Sin conversaciones: cómo empezar una (o por qué no se puede), según quién mira. */
  ayuda: ReactNode;
  /** Sin conversaciones y con invitaciones encima: el aviso, en pequeño (sin la ilustración). */
  compacto: boolean;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Bea». */
const enumerar = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/**
 * A la izquierda, para todos: quién está ahora en una conversación privada
 * (quién con quién, no lo que dicen). La llamada en sí se ve en el centro, solo
 * para quien está en ella. Los visitantes pueden entrar a escuchar cualquiera;
 * los narradores, escucharla o entrar en ella (y ven quién escucha; los
 * jugadores, no). Si no hay ninguna, lo dice y explica cómo empezar una: con
 * una ilustración (decorativa, oculta al lector) si el panel está vacío, o en
 * una línea si hay invitaciones encima.
 */
const PanelConversaciones = ({ conversaciones, participantes, yo, onEscuchar, onEntrar, ayuda, compacto }: PanelConversacionesProps) => {
  if (conversaciones.length === 0) {
    return (
      <section aria-labelledby="sala-conversaciones-titulo" className="flex flex-col gap-2 p-3 text-sm">
        <h2 id="sala-conversaciones-titulo" className="font-ui text-xs font-semibold uppercase tracking-wide text-theme-main">
          Conversaciones privadas
        </h2>
        {compacto ? (
          <p className="text-on-surface-muted">Ninguna en curso.</p>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            {/* Un círculo de latón tenue con las ondas de voz, en silencio */}
            <span
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-full border border-theme-main/30 bg-[radial-gradient(circle,var(--color-theme-container)_0%,transparent_70%)] text-theme-main/50"
            >
              <AudioLines size={28} strokeWidth={1.25} />
            </span>
            <p className="font-display text-lg text-on-surface-bright">Nadie conversa en privado</p>
            <p className="max-w-[15rem] text-xs leading-relaxed text-on-surface-muted">{ayuda}</p>
          </div>
        )}
      </section>
    );
  }
  const narro = yo.rol === 'narrador';
  // Para escuchar otra hay que salir antes de la propia (si se habla en una)
  const hablo = conversaciones.some((c) => c.miembros.includes(yo.id));
  const nombre = (id: string) => (id === yo.id ? 'tú' : (participantes.find((p) => p.id === id)?.nombre ?? 'Alguien'));

  return (
    <section aria-labelledby="sala-conversaciones-titulo" className="flex flex-col gap-2 p-3 text-sm">
      <h2 id="sala-conversaciones-titulo" className="font-ui text-xs font-semibold uppercase tracking-wide text-theme-main">
        Conversaciones privadas
      </h2>
      <ul className="flex flex-col gap-2">
        {conversaciones.map((c) => {
          const estoy = c.miembros.includes(yo.id) || c.oyentes.includes(yo.id);
          const de = enumerar(c.miembros.map(nombre));
          const puedeEscuchar = !estoy && (yo.rol === 'visitante' || (narro && !hablo));
          const puedeEntrar = narro && !c.miembros.includes(yo.id);
          return (
            <li key={c.id} className="flex items-center gap-2">
              <AudioLines size={16} className="shrink-0 text-theme-main" />
              <div className="min-w-0 flex-1">
                <p className={estoy ? 'font-semibold' : ''}>{enumerar(c.miembros.map(nombre))}</p>
                {c.oyentes.length > 0 && (
                  <p className="text-xs text-on-surface-muted">
                    {c.oyentes.length > 1 ? 'Escuchan' : 'Escucha'}: <NombresOyentes nombres={c.oyentes.map(nombre)} />
                  </p>
                )}
              </div>
              {puedeEscuchar && (
                <button
                  type="button"
                  onClick={() => onEscuchar(c.id)}
                  aria-label={`Escuchar la conversación de ${de}`}
                  className={`${botonSecundario} px-2 py-0.5 text-xs`}
                >
                  Escuchar
                </button>
              )}
              {puedeEntrar && (
                <button
                  type="button"
                  onClick={() => onEntrar(c.id)}
                  aria-label={`Entrar en la conversación de ${de}`}
                  className={`${botonSecundario} px-2 py-0.5 text-xs`}
                >
                  Entrar
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
