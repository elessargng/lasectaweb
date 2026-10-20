import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import { datosAsiento, describirAsiento } from './nombresAsiento';
import { SENALAMIENTO, type SalaEstado, type SalaResultado } from './useSala';

interface DialogoSenalamientoProps {
  estado: SalaEstado;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

/** Lo último que se pidió, para proponerlo la próxima vez (en esta pestaña). */
let ultimo = { mensaje: '', segundos: String(SENALAMIENTO.defectoSegundos), conCuenta: true };

/**
 * Pedir un señalamiento (narradores): el mensaje que verán en grande, la cuenta
 * atrás (10 segundos por defecto, o sin ella: hasta que se termine a mano) y,
 * si no son todos, quién señala y a quién. De día lo ven todos; de noche se
 * despierta a los que señalan y solo lo ven ellos.
 */
const DialogoSenalamiento = ({ estado, pedir, onCerrar }: DialogoSenalamientoProps) => {
  const [mensaje, setMensaje] = useState(ultimo.mensaje);
  const [segundos, setSegundos] = useState(ultimo.segundos);
  const [conCuenta, setConCuenta] = useState(ultimo.conCuenta);
  const [senaladores, setSenaladores] = useState<string[]>([]);
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ariaLive = useAriaLive('errores');
  const deNoche = estado.fase.momento === 'noche';

  const empezar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    const n = Number(segundos);
    if (conCuenta && (!Number.isInteger(n) || n < SENALAMIENTO.minSegundos || n > SENALAMIENTO.maxSegundos)) {
      setError(`La cuenta atrás tiene que durar entre ${SENALAMIENTO.minSegundos} y ${SENALAMIENTO.maxSegundos} segundos.`);
      return;
    }
    setEnviando(true);
    setError('');
    const r = await pedir('narrador:senalamiento', {
      mensaje: mensaje.trim(),
      segundos: conCuenta ? n : null,
      senaladores,
      objetivos,
    });
    if (r.ok) {
      ultimo = { mensaje, segundos, conCuenta };
      onCerrar();
      return;
    }
    setError(r.error);
    setEnviando(false);
  };

  const listaAsientos = (id: string, leyenda: string, elegidos: string[], cambiar: (ids: string[]) => void) => (
    <fieldset aria-describedby={`${id}-ayuda`} className="flex min-w-0 flex-1 flex-col gap-1">
      <legend className="mb-1 font-ui text-xs">{leyenda}</legend>
      <p id={`${id}-ayuda`} className="text-xs text-on-surface-muted">
        Sin marcar ninguno: todos.
      </p>
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
        {estado.asientos.map((a) => {
          const { numero, ocupante } = datosAsiento(estado, a.id);
          const nombre = describirAsiento(numero, ocupante);
          return (
            <li key={a.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={elegidos.includes(a.id)}
                  onChange={(e) => cambiar(e.target.checked ? [...elegidos, a.id] : elegidos.filter((x) => x !== a.id))}
                  className="accent-theme-main"
                />
                {nombre.charAt(0).toLocaleUpperCase('es') + nombre.slice(1)}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-senalamiento-dialogo-titulo"
        className="flex max-h-[90vh] w-full max-w-lg flex-col sala-cofre sala-cofre-esquinas"
      >
        <form onSubmit={(e) => void empezar(e)} className="flex min-h-0 flex-col gap-4 overflow-y-auto p-6" noValidate>
          <h2 id="sala-senalamiento-dialogo-titulo" className="sala-cofre-titulo">
            Señalar
          </h2>
          <p className="text-sm text-on-surface-muted">
            {deNoche
              ? 'Es de noche: se despierta a los que señalan y solo ellos lo verán. Sin sonido.'
              : 'Es de día: todos verán quién señala a quién.'}
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="sala-senalamiento-mensaje" className="font-ui text-xs">
              Mensaje (opcional)
            </label>
            <input
              id="sala-senalamiento-mensaje"
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              maxLength={SENALAMIENTO.mensajeMax}
              className={`${campo} text-sm`}
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={conCuenta} onChange={(e) => setConCuenta(e.target.checked)} className="accent-theme-main" />
              Con cuenta atrás
            </label>
            {conCuenta && (
              <div className="flex flex-col gap-1">
                <label htmlFor="sala-senalamiento-segundos" className="font-ui text-xs">
                  Segundos
                </label>
                <input
                  id="sala-senalamiento-segundos"
                  type="number"
                  inputMode="numeric"
                  min={SENALAMIENTO.minSegundos}
                  max={SENALAMIENTO.maxSegundos}
                  value={segundos}
                  onChange={(e) => setSegundos(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'sala-senalamiento-error' : undefined}
                  className={`${campo} w-24 text-sm`}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            {listaAsientos('sala-senalamiento-senaladores', 'Quién señala', senaladores, setSenaladores)}
            {listaAsientos('sala-senalamiento-objetivos', 'A quién se puede señalar', objetivos, setObjetivos)}
          </div>
          <div aria-live={ariaLive}>
            {error && (
              <p id="sala-senalamiento-error" className="text-sm text-blood-pale">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
              Empezar
            </button>
          </div>
        </form>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoSenalamiento;
