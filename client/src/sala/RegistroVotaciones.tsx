import { IconoVotar } from './IconosJuego';
import { useState } from 'react';
import Dialog from '../components/Dialog';
import { botonIcono, botonSecundario } from './estilos';
import type { SalaRegistroVotacion } from './useSala';

const hora = (ms: number) => new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Las nominaciones agrupadas por día, en orden (día 1, día 2…). */
function porDias(votaciones: SalaRegistroVotacion[]): { dia: number; votaciones: SalaRegistroVotacion[] }[] {
  const dias = new Map<number, SalaRegistroVotacion[]>();
  for (const v of votaciones) dias.set(v.dia, [...(dias.get(v.dia) ?? []), v]);
  return [...dias.entries()].sort(([a], [b]) => a - b).map(([dia, lista]) => ({ dia, votaciones: lista }));
}

/**
 * En la cabecera, solo para narradores: botón (una urna) que abre el registro de
 * nominaciones y votaciones de la partida, por días (cada día con su título, para
 * ir de uno a otro): quién nomina a quién, quién votó y cuántos votos hubo, o
 * que no se votó. Lo guarda el servidor hasta que se limpia el grimorio.
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
        <IconoVotar size={22} />
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
          <Dialog
            onClose={() => setAbierto(false)}
            labelledBy="sala-votaciones-titulo"
            className="flex max-h-[85vh] w-full max-w-2xl flex-col sala-cofre sala-cofre-esquinas"
          >
            <h2 id="sala-votaciones-titulo" className="px-6 py-4 sala-cofre-titulo">
              Registro de votaciones
            </h2>
            <div className="overflow-y-auto px-6 py-4">
              {votaciones.length === 0 ? (
                <p className="text-on-surface-muted">Todavía no ha habido ninguna nominación.</p>
              ) : (
                <div className="flex flex-col gap-6">
                  {porDias(votaciones).map(({ dia, votaciones: delDia }) => (
                    <section key={dia} aria-labelledby={`sala-votaciones-dia-${dia}`}>
                      <h3
                        id={`sala-votaciones-dia-${dia}`}
                        className="mb-2 border-b border-outline-ghost pb-1 font-display text-lg text-theme-main"
                      >
                        Día {dia}
                      </h3>
                      <ol className="flex flex-col gap-3">
                        {delDia.map((v) => (
                          <li key={v.hora} className="rounded border border-outline-ghost p-3">
                            <p className="text-sm text-on-surface-muted">{hora(v.hora)}</p>
                            <p>
                              El {v.nomina} nomina al {v.nominado}.
                            </p>
                            {v.votos === null ? (
                              <p className="text-on-surface-muted">Sin votar.</p>
                            ) : (
                              <p className="font-semibold">
                                {v.votos === 1 ? '1 voto' : `${v.votos} votos`}
                                {v.votantes && v.votantes.length > 0 && (
                                  <span className="font-normal">: {v.votantes.join(', ')}</span>
                                )}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end sala-cofre-pie px-6 py-3">
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
