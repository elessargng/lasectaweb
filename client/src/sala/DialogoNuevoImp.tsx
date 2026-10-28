import { useState } from 'react';
import Dialog from '../components/Dialog';
import { useAriaLive } from './avisosConfig';
import { nombreDeAsiento } from './despertar';
import { botonPrincipal, botonSecundario } from './estilos';
import type { PersonajeMostrado } from './guiones';
import type { SalaEstado, SalaResultado } from './useSala';

interface DialogoNuevoImpProps {
  estado: SalaEstado;
  /** El asiento del Imp que se ha elegido a sí mismo (muere esta noche). */
  muere: string;
  porId: Map<string, PersonajeMostrado>;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  /** Confirmar al lector quién es el nuevo. */
  onElegido: (texto: string) => void;
  /** Ahora no (Escape): se puede elegir luego, vuelve a salir. */
  onCerrar: () => void;
}

/**
 * El Imp se ha elegido a sí mismo (despertar guiado): el narrador dice quién es el
 * nuevo. Se le cambia la ficha y se le despierta con «Tú eres: Imp, Malvado».
 * Salen los vivos, primero los esbirros. Al abrirse se lee el título y la explicación.
 */
const DialogoNuevoImp = ({ estado, muere, porId, pedir, onElegido, onCerrar }: DialogoNuevoImpProps) => {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const ariaLive = useAriaLive('errores');
  const esEsbirro = (personaje: string | null) => !!personaje && porId.get(personaje)?.tipo === 'minion';
  const vivos = estado.asientos.filter((a) => a.id !== muere && !a.muerto && !a.muertePendiente);
  const candidatos = [...vivos.filter((a) => esEsbirro(a.personaje)), ...vivos.filter((a) => !esEsbirro(a.personaje))];

  const elegir = async (asientoId: string) => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    const r = await pedir('narrador:nuevoImp', { asientoId });
    setEnviando(false);
    if (r.ok) onElegido(`${nombreDeAsiento(estado, asientoId)} es el nuevo Imp.`);
    else setError(r.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sala-velo">
      <Dialog
        onClose={onCerrar}
        labelledBy="sala-nuevo-imp-titulo"
        describedBy="sala-nuevo-imp-texto"
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto sala-cofre sala-cofre-esquinas p-6"
      >
        <h2 id="sala-nuevo-imp-titulo" className="sala-cofre-titulo">
          ¿Quién es el nuevo Imp?
        </h2>
        <p id="sala-nuevo-imp-texto" className="text-sm text-on-surface-muted">
          El Imp ({nombreDeAsiento(estado, muere)}) se ha elegido a sí mismo y muere. Elige quién pasa a ser el Imp: se le
          cambia la ficha y se le despierta para decírselo.
        </p>
        <ul className="flex flex-col gap-2">
          {candidatos.map((a) => {
            const personaje = a.personaje ? porId.get(a.personaje) : undefined;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  aria-disabled={enviando}
                  onClick={() => void elegir(a.id)}
                  className={`${botonPrincipal} w-full justify-start text-left`}
                >
                  {nombreDeAsiento(estado, a.id)}
                  {personaje && (
                    <>
                      {', '}
                      <span lang={personaje.nombre.lang}>{personaje.nombre.texto}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div aria-live={ariaLive}>{error && <p className="text-sm text-blood-pale">{error}</p>}</div>
        <div className="flex justify-end">
          <button type="button" onClick={onCerrar} className={botonSecundario}>
            Ahora no
          </button>
        </div>
      </Dialog>
    </div>
  );
};

export default DialogoNuevoImp;
