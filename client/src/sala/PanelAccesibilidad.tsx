import { GRUPOS_AVISOS, type AvisosActivos, type TipoAviso } from './avisosConfig';
import { botonSecundario } from './estilos';

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
      <div className="flex items-start gap-2">
        <input
          id="sala-invitaciones-fuera"
          type="checkbox"
          checked={invitacionesFuera}
          onChange={(e) => onInvitacionesFuera(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-theme-main"
        />
        <label htmlFor="sala-invitaciones-fuera" className="text-sm">
          Mostrarlas fuera del panel de Charlas, encima de la columna y siempre a la vista (en vez de dentro del panel).
        </label>
      </div>
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
          <div key={tipo} className="flex items-start gap-2">
            <input
              id={`sala-aviso-${tipo}`}
              type="checkbox"
              checked={activos[tipo]}
              onChange={(e) => onCambiar(tipo, e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-theme-main"
            />
            <label htmlFor={`sala-aviso-${tipo}`} className="text-sm">
              {etiqueta}
            </label>
          </div>
        ))}
      </fieldset>
    ))}
  </div>
);

export default PanelAccesibilidad;
