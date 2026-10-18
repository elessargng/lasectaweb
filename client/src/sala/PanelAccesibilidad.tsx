import { GRUPOS_AVISOS, type AvisosActivos, type TipoAviso } from './avisosConfig';
import { botonSecundario } from './estilos';
import Interruptor from './Interruptor';

interface PanelAccesibilidadProps {
  activos: AvisosActivos;
  onCambiar: (tipo: TipoAviso, activo: boolean) => void;
  onCambiarTodos: (activo: boolean) => void;
  /** Las peticiones de llamada entrantes fuera del panel de Charlas (encima, a la vista). */
  invitacionesFuera: boolean;
  onInvitacionesFuera: (fuera: boolean) => void;
}

/**
 * Pestaña Accesibilidad: dónde salen las peticiones de llamada entrantes y qué
 * avisos dice el lector de pantalla, por grupos. Se aplica al momento; con
 * cuenta se guarda en el servidor.
 */
const PanelAccesibilidad = ({ activos, onCambiar, onCambiarTodos, invitacionesFuera, onInvitacionesFuera }: PanelAccesibilidadProps) => (
  <div className="flex flex-col gap-6">
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Peticiones de llamada entrantes</legend>
      <Interruptor id="sala-invitaciones-fuera" activo={invitacionesFuera} onCambiar={onInvitacionesFuera} arriba textoClassName="text-sm">
        Mostrarlas fuera del panel de Charlas, encima de la columna y siempre a la vista (en vez de dentro del panel).
      </Interruptor>
    </fieldset>
    <p className="text-sm text-on-surface-muted">
      Elige qué te anuncia el lector de pantalla. Lo que también se ve en pantalla se sigue viendo aunque no se lea.
    </p>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={() => onCambiarTodos(true)} className={botonSecundario}>
        Activar todos
      </button>
      <button type="button" onClick={() => onCambiarTodos(false)} className={botonSecundario}>
        Desactivar todos
      </button>
    </div>
    {GRUPOS_AVISOS.map(({ grupo, tipos }) => (
      <fieldset key={grupo} className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{grupo}</legend>
        {tipos.map(({ tipo, etiqueta }) => (
          <Interruptor
            key={tipo}
            id={`sala-aviso-${tipo}`}
            activo={activos[tipo]}
            onCambiar={(activo) => onCambiar(tipo, activo)}
            arriba
            textoClassName="text-sm"
          >
            {etiqueta}
          </Interruptor>
        ))}
      </fieldset>
    ))}
  </div>
);

export default PanelAccesibilidad;
