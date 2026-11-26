import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario, campo } from './estilos';
import type { ResultadoAccion } from './useSala';

/** Un jugador al que se puede llamar: si ya está en una llamada (una conversación privada). */
export interface JugadorLlamable {
  id: string;
  nombre: string;
  enLlamada: boolean;
}

interface DialogoLlamarProps {
  /** Los jugadores (sin uno mismo), en el orden de la plaza. */
  jugadores: JugadorLlamable[];
  /** Le llama (o, si está en una llamada, pide unirse a ella): el resultado. */
  llamar: (participanteId: string) => Promise<ResultadoAccion>;
  onCerrar: () => void;
}

/**
 * Llamar a un jugador con su tecla (Preferencias > Accesibilidad, de entrada Ctrl +
 * Alt + L): un desplegable con todos los jugadores, cada uno con «libre» o «en
 * llamada» tras su nombre. Al abrirse, el foco va al desplegable (el lector dice
 * el diálogo y el jugador elegido); Intro llama y cierra; Escape cierra sin llamar.
 */
const DialogoLlamar = ({ jugadores, llamar, onCerrar }: DialogoLlamarProps) => {
  const [elegido, setElegido] = useState(jugadores[0]?.id ?? '');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ariaLive = useAriaLive('errores');
  const selectRef = useRef<HTMLSelectElement>(null);
  // Después de que el diálogo se lleve el foco (su efecto va antes: es hijo)
  useEffect(() => selectRef.current?.focus(), []);
  // Si quien estaba elegido se va, el primero
  const jugador = jugadores.find((j) => j.id === elegido) ?? jugadores[0];

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando || !jugador) return;
    setEnviando(true);
    setError('');
    const r = await llamar(jugador.id);
    setEnviando(false);
    if (r.ok) onCerrar();
    else setError(r.error);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog onClose={onCerrar} labelledBy="sala-llamar-titulo" className="w-full max-w-sm sala-cofre sala-cofre-esquinas p-6">
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4" noValidate>
          <h2 id="sala-llamar-titulo" className="sala-cofre-titulo">
            Llamar a un jugador
          </h2>
          {jugador ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="sala-llamar-jugador" className="font-ui text-xs">
                Jugador
              </label>
              <select
                ref={selectRef}
                id="sala-llamar-jugador"
                value={jugador.id}
                onChange={(e) => setElegido(e.target.value)}
                className={`${campo} text-sm`}
              >
                {jugadores.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nombre}, {j.enLlamada ? 'en llamada' : 'libre'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm">No hay ningún jugador a quien llamar.</p>
          )}
          <div aria-live={ariaLive}>{error && <p className="text-sm text-blood-pale">{error}</p>}</div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cancelar
            </button>
            {jugador && (
              <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
                Llamar
              </button>
            )}
          </div>
        </form>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoLlamar;
