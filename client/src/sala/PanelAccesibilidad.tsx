import { useState } from 'react';
import { ACCIONES_ATAJO, describirAtajo, type AccionAtajo, type Atajo } from './atajos';
import { GRUPOS_AVISOS, useAriaLive, type AvisosActivos, type TipoAviso } from './avisosConfig';
import BotonCapturarTecla from './BotonCapturarTecla';
import { botonSecundario } from './estilos';
import Interruptor from './Interruptor';
import TeclaAtajo from './TeclaAtajo';

interface PanelAccesibilidadProps {
  activos: AvisosActivos;
  onCambiar: (tipo: TipoAviso, activo: boolean) => void;
  onCambiarTodos: (activo: boolean) => void;
  /** Las peticiones de llamada entrantes fuera del panel de Charlas (encima, a la vista). */
  invitacionesFuera: boolean;
  onInvitacionesFuera: (fuera: boolean) => void;
  /** La tecla que lee el reloj del narrador, o null. */
  teclaLeerReloj: Atajo | null;
  onTeclaLeerReloj: (tecla: Atajo | null) => void;
  /** Los atajos (pestaña Atajos), para avisar si la tecla elegida ya es de uno. */
  atajos: Record<AccionAtajo, Atajo>;
  /** Cómo se eligen los jugadores en el despertar de noche. */
  eleccionDespertar: 'plaza' | 'lista';
  onEleccionDespertar: (eleccion: 'plaza' | 'lista') => void;
}

const MODOS_ELECCION = [
  {
    id: 'plaza',
    etiqueta: 'En la plaza',
    descripcion: 'La ventana del despertar se esconde, pulsas la ficha del jugador y vuelve con él añadido.',
  },
  { id: 'lista', etiqueta: 'En una lista', descripcion: 'Los jugadores salen como botones dentro de la ventana del despertar.' },
] as const;

/** Si una tecla ya es la de un atajo: su nombre, para avisar. */
function atajoQueLaUsa(tecla: Atajo, atajos: Record<AccionAtajo, Atajo>): string | null {
  const igual = (a: Atajo) =>
    a.code === tecla.code && a.ctrl === tecla.ctrl && a.alt === tecla.alt && a.shift === tecla.shift && a.meta === tecla.meta;
  return ACCIONES_ATAJO.find(({ accion }) => igual(atajos[accion]))?.etiqueta ?? null;
}

/**
 * Una tecla para que el lector diga el reloj del narrador cuando se quiera (lo que
 * queda y su mensaje): los segundos no se leen solos. Sin tecla de entrada.
 */
const TeclaLeerReloj = ({ tecla, onCambiar, atajos }: { tecla: Atajo | null; onCambiar: (tecla: Atajo | null) => void; atajos: Record<AccionAtajo, Atajo> }) => {
  const [aviso, setAviso] = useState('');
  const ariaLive = useAriaLive('preferencias');
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Leer el reloj</legend>
      <p className="text-sm text-on-surface-muted">
        Cuando el narrador pone un reloj, el lector no dice los segundos. Con esta tecla te lee lo que queda y su mensaje
        cuando la pulses.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <p id="sala-tecla-reloj" className="text-sm">
          Tecla para leer el reloj:{' '}
          {tecla ? (
            <>
              <span className="sr-only">{describirAtajo(tecla)}</span>
              <TeclaAtajo atajo={tecla} ocultoALector className="px-2 py-1 text-sm" />
            </>
          ) : (
            'ninguna'
          )}
        </p>
        <BotonCapturarTecla
          describedBy="sala-tecla-reloj"
          texto={tecla ? 'Cambiar' : 'Elegir tecla'}
          onEmpezar={() => setAviso('')}
          onCancelar={() => setAviso('Cambio cancelado.')}
          onCapturar={(nueva) => {
            onCambiar(nueva);
            const otro = atajoQueLaUsa(nueva, atajos);
            setAviso(
              `Leer el reloj: ${describirAtajo(nueva)}.${otro ? ` Es también la tecla de «${otro}»: ahora leerá el reloj; cámbiala en Atajos si quieres las dos.` : ''}`,
            );
          }}
        />
        {tecla && (
          <button
            type="button"
            aria-describedby="sala-tecla-reloj"
            onClick={() => {
              onCambiar(null);
              setAviso('Leer el reloj: sin tecla.');
            }}
            className={botonSecundario}
          >
            Quitar tecla
          </button>
        )}
      </div>
      <p aria-live={ariaLive} className="text-sm text-on-surface-muted">
        {aviso}
      </p>
    </fieldset>
  );
};

/**
 * Pestaña Accesibilidad: dónde salen las peticiones de llamada entrantes, cómo
 * se eligen jugadores en el despertar de noche, la tecla de leer el reloj y qué
 * avisos dice el lector de pantalla, por grupos. Se aplica al momento; con
 * cuenta se guarda en el servidor.
 */
const PanelAccesibilidad = ({
  activos,
  onCambiar,
  onCambiarTodos,
  invitacionesFuera,
  onInvitacionesFuera,
  teclaLeerReloj,
  onTeclaLeerReloj,
  atajos,
  eleccionDespertar,
  onEleccionDespertar,
}: PanelAccesibilidadProps) => (
  <div className="flex flex-col gap-6">
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Peticiones de llamada entrantes</legend>
      <Interruptor id="sala-invitaciones-fuera" activo={invitacionesFuera} onCambiar={onInvitacionesFuera} arriba textoClassName="text-sm">
        Mostrarlas fuera del panel de Charlas, encima de la columna y siempre a la vista (en vez de dentro del panel).
      </Interruptor>
    </fieldset>
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Elegir jugadores en el despertar de noche</legend>
      {MODOS_ELECCION.map((m) => (
        // El nombre de la opción es solo su etiqueta; lo que hace, su descripción (se lee después)
        <div key={m.id} className="flex items-start gap-2 text-sm">
          <input
            id={`sala-eleccion-${m.id}`}
            type="radio"
            name="sala-eleccion-despertar"
            checked={eleccionDespertar === m.id}
            onChange={() => onEleccionDespertar(m.id)}
            aria-describedby={`sala-eleccion-${m.id}-ayuda`}
            className="mt-1 accent-[var(--color-theme-main)]"
          />
          <div>
            <label htmlFor={`sala-eleccion-${m.id}`}>{m.etiqueta}</label>
            <p id={`sala-eleccion-${m.id}-ayuda`} className="text-on-surface-muted">
              {m.descripcion}
            </p>
          </div>
        </div>
      ))}
    </fieldset>
    <TeclaLeerReloj tecla={teclaLeerReloj} onCambiar={onTeclaLeerReloj} atajos={atajos} />
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
