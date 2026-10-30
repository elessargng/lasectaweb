import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { nombreDeAsiento } from './despertar';
import { botonPrincipal, botonSecundario } from './estilos';
import type { SalaEstado, SalaResultado } from './useSala';

interface DialogoPatosoProps {
  estado: SalaEstado;
  miAsiento: string;
  /** Es el Patoso de verdad (su ficha lo dice): tiene que elegir, no puede cancelar. */
  obligado: boolean;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onCerrar: () => void;
}

/**
 * Declararse Patoso (con narrador virtual): quien acaba de morir elige en público a
 * un jugador vivo; si es el Patoso de verdad y elige a un malvado, pierde su
 * equipo. Lo puede hacer cualquiera que muere (para hacerse pasar por él) hasta que
 * se acaba esa noche o ese día. Al Patoso de verdad se le abre solo y no se puede
 * cancelar: tiene que elegir. Al abrirse, el foco va al título.
 */
const DialogoPatoso = ({ estado, miAsiento, obligado, pedir, onCerrar }: DialogoPatosoProps) => {
  const vivos = estado.asientos.filter((a) => a.id !== miAsiento && !a.muerto && !a.muertePendiente);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ariaLive = useAriaLive('errores');

  const elegir = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!elegido) return setError('Elige a un jugador vivo.');
    setEnviando(true);
    setError('');
    const r = await pedir('jugador:patoso', { asientoId: elegido });
    setEnviando(false);
    if (r.ok) onCerrar();
    else setError(r.error);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        // Obligado, Escape no lo cierra
        onClose={obligado ? () => undefined : onCerrar}
        labelledBy="sala-patoso-titulo"
        describedBy="sala-patoso-texto"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto sala-cofre sala-cofre-esquinas p-6"
      >
        <form onSubmit={(e) => void elegir(e)} className="flex flex-col gap-4" noValidate>
          <h2 id="sala-patoso-titulo" className="sala-cofre-titulo">
            {obligado ? 'Eres el Patoso' : 'Declararte Patoso'}
          </h2>
          <p id="sala-patoso-texto" className="text-sm text-on-surface-muted">
            {obligado
              ? 'Has muerto: elige en público a un jugador vivo. Si es malvado, pierde tu equipo.'
              : 'Elige en público a un jugador vivo, como si fueras el Patoso. El narrador anunciará tu elección.'}
          </p>
          <fieldset className="flex flex-col gap-1" aria-describedby={error ? 'sala-patoso-error' : undefined}>
            <legend className="mb-1 font-ui text-xs">Jugador vivo</legend>
            {vivos.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name="sala-patoso" value={a.id} checked={elegido === a.id} onChange={() => setElegido(a.id)} />
                {nombreDeAsiento(estado, a.id)}
              </label>
            ))}
          </fieldset>
          <div aria-live={ariaLive}>
            {error && (
              <p id="sala-patoso-error" className="text-sm text-blood-pale">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            {!obligado && (
              <button type="button" onClick={onCerrar} className={botonSecundario}>
                Cancelar
              </button>
            )}
            <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
              Elegir
            </button>
          </div>
        </form>
      </Dialog>
    </div>,
    document.body,
  );
};

export default DialogoPatoso;
