import { useState, type FormEvent } from 'react';
import Dialog from '../components/Dialog';
import { botonPrincipal, botonSecundario } from './estilos';
import type { SalaParticipante, SalaResultado } from './useSala';

interface DialogoElegirParticipanteProps {
  /** Título del diálogo («Añadir narrador»). */
  titulo: string;
  /** Texto del botón que confirma («Nombrar narrador»). */
  confirmar: string;
  /** Qué decir si no hay a quién elegir. */
  sinCandidatos: string;
  candidatos: SalaParticipante[];
  /** Algo más que decir de cada candidato («asiento 3»). */
  detalle?: (p: SalaParticipante) => string;
  onElegir: (participanteId: string) => Promise<SalaResultado>;
  onCerrar: () => void;
}

/**
 * Elegir a un participante para una acción del narrador (nombrar o quitar
 * narradores…). Se cierra al hacerlo; el aviso de la sala confirma el cambio.
 */
const DialogoElegirParticipante = ({
  titulo,
  confirmar,
  sinCandidatos,
  candidatos,
  detalle,
  onElegir,
  onCerrar,
}: DialogoElegirParticipanteProps) => {
  const [elegido, setElegido] = useState(candidatos[0]?.id ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const elegir = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    const r = await onElegir(elegido);
    if (r.ok) {
      onCerrar();
      return;
    }
    setError(r.error);
    setEnviando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-elegir-titulo"
        className="w-full max-w-sm rounded border border-outline-ghost bg-surface p-6 shadow-2xl"
      >
        <h2 id="sala-elegir-titulo" className="mb-4 text-xl font-semibold">
          {titulo}
        </h2>
        {candidatos.length === 0 ? (
          <>
            <p className="mb-6 text-on-surface-muted">{sinCandidatos}</p>
            <button type="button" onClick={onCerrar} className={botonSecundario}>
              Cerrar
            </button>
          </>
        ) : (
          <form onSubmit={elegir} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="sala-elegir-participante" className="text-sm text-on-surface-muted">
                Participante
              </label>
              <select
                id="sala-elegir-participante"
                value={elegido}
                onChange={(e) => setElegido(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'sala-elegir-error' : undefined}
                className="rounded border border-outline-ghost bg-background px-3 py-2 text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
              >
                {candidatos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.conCuenta ? '' : ' (invitado)'}
                    {detalle ? `, ${detalle(p)}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div aria-live="polite">
              {error && (
                <p id="sala-elegir-error" className="text-sm text-red-400">
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" aria-disabled={enviando} className={botonPrincipal}>
                {confirmar}
              </button>
              <button type="button" onClick={onCerrar} className={botonSecundario}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
};

export default DialogoElegirParticipante;
