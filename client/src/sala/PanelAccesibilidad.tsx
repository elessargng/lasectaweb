import { useEffect, useRef, useState } from 'react';
import { ACCIONES_ATAJO, describirAtajo, type AccionAtajo, type Atajo } from './atajos';
import { GRUPOS_AVISOS, useAriaLive, type AvisosActivos, type TipoAviso } from './avisosConfig';
import BotonCapturarTecla from './BotonCapturarTecla';
import { botonSecundario, campo } from './estilos';
import Interruptor from './Interruptor';
import { esSalidaAudio, SALIDAS_AUDIO, type SalidaAudio } from './sonidoEnvolvente';
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
  /** Oír cada voz desde su asiento en la plaza, y con qué se oye. */
  sonidoEnvolvente: boolean;
  onSonidoEnvolvente: (activo: boolean) => void;
  salidaAudio: SalidaAudio;
  onSalidaAudio: (salida: SalidaAudio) => void;
  /** Los canales que da el sistema (null mientras no está activo). */
  canalesSalida: number | null;
  /** Suena desde cada asiento de una plaza de 8 y luego desde el narrador; devuelve cómo pararlo. */
  onProbarSonido: (alPaso: (texto: string, hablado: boolean) => void) => () => void;
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

/** Lo que hace la salida elegida, con lo que da el sistema (se lee como descripción del desplegable). */
function ayudaSalida(salida: SalidaAudio, canales: number | null): string {
  switch (salida) {
    case 'auriculares71':
      if (canales !== null && canales >= 6)
        return `Tu equipo da ${canales} canales: el narrador va al altavoz central y los jugadores, de un oído a otro. El 7.1 no tiene altavoces encima ni debajo: para distinguirlos, elige «Auriculares estéreo».`;
      return 'Tu equipo solo da 2 canales, así que se usa el sonido 3D de los auriculares estéreo. Para usar el 7.1, configura los auriculares como 7.1 en el sistema.';
    case 'auriculares':
      return 'Sonido 3D: el narrador, delante; los jugadores, en un círculo que pasa por tus oídos: el de arriba de la plaza, encima de la cabeza; el de abajo, debajo; los de los lados, en cada oído.';
    case 'altavoces':
      return 'El narrador, en el centro; los jugadores, de izquierda a derecha. Con altavoces no se distingue encima de debajo.';
    case 'mono':
      return 'Con un solo altavoz no se puede situar el sonido: las voces se oyen centradas.';
  }
}

/**
 * Sonido envolvente: el narrador delante y los jugadores alrededor de la cabeza,
 * según su asiento en la plaza. Al activarlo se elige con qué se oye, y se puede
 * probar: suena en cada sitio y el lector dice dónde, para saber qué se debería oír.
 */
const SonidoEnvolvente = ({
  activo,
  onActivar,
  salida,
  onSalida,
  canales,
  onProbar,
}: {
  activo: boolean;
  onActivar: (activo: boolean) => void;
  salida: SalidaAudio;
  onSalida: (salida: SalidaAudio) => void;
  canales: number | null;
  onProbar: (alPaso: (texto: string, hablado: boolean) => void) => () => void;
}) => {
  // Cuál suena de la prueba (a la vista) y, si no lo dice su grabación, lo que dice el lector
  const [lugar, setLugar] = useState('');
  const [aviso, setAviso] = useState('');
  const pararRef = useRef<(() => void) | null>(null);
  const parar = () => {
    pararRef.current?.();
    pararRef.current = null;
    setLugar('');
    setAviso('');
  };
  // Al cerrar las preferencias (o apagarlo) a media prueba, se para
  useEffect(() => () => pararRef.current?.(), []);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-semibold">Sonido envolvente</legend>
      <Interruptor
        id="sala-sonido-envolvente"
        activo={activo}
        onCambiar={(si) => {
          if (!si) parar();
          onActivar(si);
        }}
        arriba
        textoClassName="text-sm"
      >
        Oír cada voz desde su sitio: el narrador, delante; los jugadores, alrededor de tu cabeza según su asiento en la plaza
        (el de arriba, encima; el de abajo, debajo; los de los lados, en cada oído).
      </Interruptor>
      {activo && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="sala-salida-audio" className="text-sm">
              Con qué lo oyes
            </label>
            <select
              id="sala-salida-audio"
              value={salida}
              onChange={(e) => {
                if (esSalidaAudio(e.target.value)) onSalida(e.target.value);
              }}
              aria-describedby="sala-salida-audio-ayuda"
              className={`${campo} max-w-md`}
            >
              {SALIDAS_AUDIO.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <p id="sala-salida-audio-ayuda" className="text-xs text-on-surface-muted">
              {ayudaSalida(salida, canales)}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                parar();
                pararRef.current = onProbar((texto, hablado) => {
                  setLugar(texto);
                  setAviso(hablado ? '' : texto);
                });
              }}
              className={botonSecundario}
            >
              Probar sonido
            </button>
          </div>
          {/* Cuál suena de la prueba: si lo dice su grabación, el lector no lo repite */}
          <p aria-hidden="true" className="text-sm text-on-surface-muted">
            {lugar}
          </p>
          <p aria-live="polite" className="sr-only">
            {aviso}
          </p>
        </>
      )}
    </fieldset>
  );
};

/**
 * Pestaña Accesibilidad: dónde salen las peticiones de llamada entrantes, cómo
 * se eligen jugadores en el despertar de noche, el sonido envolvente, la tecla de leer el reloj y qué
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
  sonidoEnvolvente,
  onSonidoEnvolvente,
  salidaAudio,
  onSalidaAudio,
  canalesSalida,
  onProbarSonido,
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
    <SonidoEnvolvente
      activo={sonidoEnvolvente}
      onActivar={onSonidoEnvolvente}
      salida={salidaAudio}
      onSalida={onSalidaAudio}
      canales={canalesSalida}
      onProbar={onProbarSonido}
    />
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
