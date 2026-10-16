import { BookMarked, Ear, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { botonIcono } from './estilos';
import type { SalaParticipante, SalaRol } from './useSala';

const GRUPOS: { rol: SalaRol; titulo: string }[] = [
  { rol: 'narrador', titulo: 'Narradores' },
  { rol: 'jugador', titulo: 'Jugadores' },
  { rol: 'visitante', titulo: 'Visitantes' },
];

interface ListaParticipantesProps {
  participantes: SalaParticipante[];
  yo: string;
  /** Quienes escuchan una conversación (solo llega a narradores y visitantes): una oreja delante. */
  escuchando: Set<string>;
}

/**
 * En la cabecera: un botón con icono (y el número de participantes) que abre el
 * panel con la lista, dividida por papel. Escape lo cierra.
 *
 * El panel va en la cabecera, antes del h1, así que no usa títulos (romperían
 * su orden): cada grupo es una lista con su etiqueta, y se navega por listas.
 */
const ListaParticipantes = ({ participantes, yo, escuchando }: ListaParticipantesProps) => {
  const [abierta, setAbierta] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Solo si el foco está en el botón o en el panel (no en otro menú abierto).
      const dentro = botonRef.current?.contains(document.activeElement) || panelRef.current?.contains(document.activeElement);
      if (!dentro) return;
      setAbierta(false);
      botonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [abierta]);

  return (
    <div className="relative">
      <button
        ref={botonRef}
        type="button"
        aria-label={`Participantes (${participantes.length})`}
        aria-expanded={abierta}
        aria-controls="sala-participantes"
        onClick={() => setAbierta((v) => !v)}
        className={botonIcono}
      >
        <Users size={22} />
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-theme-main px-1 text-[10px] font-semibold leading-none text-background"
        >
          {participantes.length}
        </span>
      </button>

      <div
        ref={panelRef}
        id="sala-participantes"
        hidden={!abierta}
        className="absolute right-0 top-full z-20 mt-2 w-[min(90vw,36rem)] rounded border border-outline-ghost bg-surface p-4 shadow-lg"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {GRUPOS.map(({ rol, titulo }) => {
            const grupo = participantes.filter((p) => p.rol === rol);
            const idTitulo = `sala-participantes-${rol}`;
            return (
              <div key={rol}>
                <p id={idTitulo} className="font-semibold text-theme-main mb-2">
                  {titulo} ({grupo.length})
                </p>
                {grupo.length === 0 ? (
                  // El «(0)» de la etiqueta ya lo dice: no se lee dos veces.
                  <p aria-hidden="true" className="text-on-surface-muted">Nadie.</p>
                ) : (
                  <ul aria-labelledby={idTitulo} className="flex flex-col gap-1">
                    {grupo.map((p) => (
                      <li key={p.id} className={p.conectado ? '' : 'text-on-surface-muted'}>
                        {escuchando.has(p.id) && <Ear size={14} className="mr-1 inline-block align-[-2px] text-theme-main" />}
                        {p.nombre}
                        {p.id === yo && ' (tú)'}
                        {!p.conCuenta && <span className="text-on-surface-muted"> (invitado)</span>}
                        {!p.conectado && ' (desconectado)'}
                        {escuchando.has(p.id) && <span className="sr-only"> (escuchando una conversación)</span>}
                        {p.accesoGrimorio === 'concedido' && (
                          <>
                            <BookMarked size={14} className="ml-1 inline-block align-[-2px] text-theme-main" />
                            <span className="sr-only"> (ve el grimorio)</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ListaParticipantes;
