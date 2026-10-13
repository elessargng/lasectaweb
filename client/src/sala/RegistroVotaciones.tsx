import { Vote } from 'lucide-react';
import { useState } from 'react';
import Dialog from '../components/Dialog';
import { botonIcono, botonSecundario } from './estilos';
import type { SalaRegistroVotacion } from './useSala';

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * En la cabecera, solo para narradores: botón (una urna) que abre el registro de
 * votaciones de la sala, la más reciente primero: quién nomina a quién, quién
 * votó y cuántos votos hubo. Lo guarda el servidor mientras la sala esté abierta.
 */
const RegistroVotaciones = ({ votaciones }: { votaciones: SalaRegistroVotacion[] }) => {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Registro de votaciones (${votaciones.length})`}
        aria-haspopup="dialog"
        onClick={() => setAbierto(true)}
        className={botonIcono}
      >
        <Vote size={22} />
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <Dialog
            onClose={() => setAbierto(false)}
            labelledBy="sala-votaciones-titulo"
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded border border-outline-ghost bg-surface shadow-2xl"
          >
            <h2 id="sala-votaciones-titulo" className="border-b border-outline-ghost px-6 py-4 text-xl font-semibold">
              Registro de votaciones
            </h2>
            <div className="overflow-y-auto px-6 py-4">
              {votaciones.length === 0 ? (
                <p className="text-on-surface-muted">Todavía no se ha votado ninguna nominación.</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {votaciones.map((v) => (
                    <li key={v.hora} className="rounded border border-outline-ghost p-3">
                      <p className="text-sm text-on-surface-muted">{hora(v.hora)}</p>
                      <p>
                        El {v.nomina} nomina al {v.nominado}.
                      </p>
                      <p className="font-semibold">
                        {v.votos === 1 ? '1 voto' : `${v.votos} votos`}
                        {v.votantes.length > 0 && <span className="font-normal">: {v.votantes.join(', ')}</span>}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="flex justify-end border-t border-outline-ghost px-6 py-3">
              <button type="button" onClick={() => setAbierto(false)} className={botonSecundario}>
                Cerrar
              </button>
            </div>
          </Dialog>
        </div>
      )}
    </>
  );
};

export default RegistroVotaciones;
