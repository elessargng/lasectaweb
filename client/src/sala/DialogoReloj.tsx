import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import { anuncioReloj, duracionReloj, RELOJ } from './reloj';
import type { SalaResultado } from './useSala';

interface DialogoRelojProps {
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Confirmación para el lector, al ponerlo (lo propio no llega con los avisos de la sala). */
  onPuesto: (texto: string) => void;
  onCerrar: () => void;
}

/** Lo último que se puso, para proponerlo la próxima vez (en esta pestaña). */
let ultimo = { minutos: '5', segundos: '0', mensaje: '' };

/**
 * Poner el reloj (narradores): cuánto dura, en minutos y segundos, y un mensaje
 * que verán todos al lado del reparto («Conversaciones privadas»). Al acabar
 * suena el gong. Si ya había uno, lo sustituye.
 */
const DialogoReloj = ({ pedir, onPuesto, onCerrar }: DialogoRelojProps) => {
  const [minutos, setMinutos] = useState(ultimo.minutos);
  const [segundos, setSegundos] = useState(ultimo.segundos);
  const [mensaje, setMensaje] = useState(ultimo.mensaje);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ariaLive = useAriaLive('errores');

  const total = (Number(minutos) || 0) * 60 + (Number(segundos) || 0);

  const poner = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!Number.isInteger(total) || total < RELOJ.minSegundos || total > RELOJ.maxSegundos) {
      setError(`El reloj tiene que durar entre ${duracionReloj(RELOJ.minSegundos)} y ${duracionReloj(RELOJ.maxSegundos)}.`);
      return;
    }
    setEnviando(true);
    setError('');
    const r = await pedir('narrador:reloj', { segundos: total, mensaje: mensaje.trim() });
    if (r.ok) {
      ultimo = { minutos, segundos, mensaje };
      onCerrar();
      onPuesto(anuncioReloj(total, mensaje.trim()));
      return;
    }
    setError(r.error);
    setEnviando(false);
  };

  // Mientras no se intente poner, la duración no se marca como mal
  const mal = !!error;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog onClose={onCerrar} labelledBy="sala-reloj-dialogo-titulo" className="w-full max-w-sm sala-cofre sala-cofre-esquinas p-6">
        <form onSubmit={(e) => void poner(e)} className="flex flex-col gap-4" noValidate>
          <h2 id="sala-reloj-dialogo-titulo" className="sala-cofre-titulo">
            Reloj
          </h2>
          <p className="text-sm text-on-surface-muted">Una cuenta atrás que verán todos con tu mensaje. Al acabar, suena el gong.</p>
          <fieldset className="flex gap-3">
            <legend className="mb-1 text-sm text-on-surface-muted">Duración</legend>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="sala-reloj-minutos" className="font-ui text-xs">
                Minutos
              </label>
              <input
                id="sala-reloj-minutos"
                type="number"
                inputMode="numeric"
                min={0}
                max={RELOJ.maxSegundos / 60}
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                aria-invalid={mal}
                aria-describedby={mal ? 'sala-reloj-error' : undefined}
                className={`${campo} text-sm`}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="sala-reloj-segundos" className="font-ui text-xs">
                Segundos
              </label>
              <input
                id="sala-reloj-segundos"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={segundos}
                onChange={(e) => setSegundos(e.target.value)}
                aria-invalid={mal}
                aria-describedby={mal ? 'sala-reloj-error' : undefined}
                className={`${campo} text-sm`}
              />
            </div>
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor="sala-reloj-mensaje" className="font-ui text-xs">
              Mensaje (opcional)
            </label>
            <input
              id="sala-reloj-mensaje"
              type="text"
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              maxLength={RELOJ.mensajeMax}
              className={`${campo} text-sm`}
            />
          </div>
          <div aria-live={ariaLive}>
            {error && (
              <p id="sala-reloj-error" className="text-sm text-blood-pale">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
              Poner reloj
            </button>
          </div>
        </form>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoReloj;
