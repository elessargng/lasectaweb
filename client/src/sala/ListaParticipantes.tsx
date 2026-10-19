import PulpitoNovato from './PulpitoNovato';
import { Ear } from 'lucide-react';
import { IconoGente, IconoLibroSecreto } from './IconosJuego';
import { useEffect, useRef, useState } from 'react';
import { botonIcono } from './estilos';
import type { SalaParticipante, SalaRol } from './useSala';
import ImagenAvatar from './ImagenAvatar';
import VolumenParticipante from './VolumenParticipante';

const GRUPOS: { rol: SalaRol; titulo: string }[] = [
  { rol: 'narrador', titulo: 'Narradores' },
  { rol: 'jugador', titulo: 'Jugadores' },
  { rol: 'visitante', titulo: 'Visitantes' },
];

const TONOS = {
  normal: 'border-grimorio-bright/35 bg-grimorio/30 text-on-surface',
  apagado: 'border-outline-ghost bg-background/60 text-on-surface-muted',
};

/** Una pastilla junto al nombre («invitado», «desconectado»). El lector la oye entre paréntesis, como antes. */
const Distintivo = ({ tono = 'normal', children }: { tono?: keyof typeof TONOS; children: string }) => (
  <span
    className={`shrink-0 rounded-full border px-1.5 py-px font-ui text-[0.58rem] font-semibold uppercase leading-tight tracking-[0.12em] ${TONOS[tono]}`}
  >
    <span className="sr-only"> (</span>
    {children}
    <span className="sr-only">)</span>
  </span>
);

interface ListaParticipantesProps {
  participantes: SalaParticipante[];
  yo: string;
  /** Quienes escuchan una conversación (solo llega a narradores y visitantes): una oreja delante. */
  escuchando: Set<string>;
  /**
   * Con videollamada: el volumen al que se oye a cada jugador y narrador (0 a 1) y
   * cómo cambiarlo (un altavoz junto a su nombre). null sin videollamada.
   */
  volumen?: { de: (id: string) => number; cambiar: (id: string, volumen: number) => void } | null;
}

/**
 * En la cabecera: un botón con icono (y el número de participantes) que abre el
 * panel con la lista, dividida por papel. Escape lo cierra. Con videollamada, junto
 * al nombre de cada jugador y narrador (menos uno mismo), su volumen (ver VolumenParticipante).
 *
 * El panel va en la cabecera, antes del h1, así que no usa títulos (romperían
 * su orden): cada grupo es una lista con su etiqueta, y se navega por listas.
 */
const ListaParticipantes = ({ participantes, yo, escuchando, volumen = null }: ListaParticipantesProps) => {
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
        <IconoGente size={22} />
        <span
          aria-hidden="true"
          className="sala-contador absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-ui text-[10px] font-bold leading-none"
        >
          {participantes.length}
        </span>
      </button>

      <div
        ref={panelRef}
        id="sala-participantes"
        hidden={!abierta}
        className="absolute right-0 top-full z-20 mt-2 w-[min(90vw,36rem)] sala-cofre sala-cofre-esquinas p-5"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {GRUPOS.map(({ rol, titulo }) => {
            const grupo = participantes.filter((p) => p.rol === rol);
            const idTitulo = `sala-participantes-${rol}`;
            return (
              <div key={rol}>
                <p id={idTitulo} className="rotulo mb-2">
                  {titulo} ({grupo.length})
                </p>
                {grupo.length === 0 ? (
                  // El «(0)» de la etiqueta ya lo dice: no se lee dos veces.
                  <p aria-hidden="true" className="text-sm italic text-on-surface-muted">Nadie.</p>
                ) : (
                  <ul aria-labelledby={idTitulo} className="flex flex-col gap-1.5">
                    {grupo.map((p) => (
                      <li key={p.id} className="group flex min-w-0 items-center gap-2">
                        {/* El retrato, con aro de latón (el tuyo, más brillante); desconectado, apagado */}
                        <span
                          aria-hidden="true"
                          className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-surface font-display text-sm text-gold-bright ${
                            p.id === yo ? 'border-gold shadow-[0_0_8px_rgba(212,175,106,0.45)]' : 'border-gold/40'
                          } ${p.conectado ? '' : 'opacity-50 grayscale'}`}
                        >
                          {p.avatar ? (
                            <ImagenAvatar avatar={p.avatar} />
                          ) : (
                            p.nombre.charAt(0).toLocaleUpperCase('es')
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          {escuchando.has(p.id) && <Ear size={14} className="shrink-0 text-gold" />}
                          {/* Tu nombre, en latón (el lector oye «(tú)»). Con cuenta, abre su perfil en otra pestaña */}
                          {(() => {
                            const color = !p.conectado ? 'text-on-surface-muted' : p.id === yo ? 'font-semibold text-gold-bright' : 'text-on-surface-bright';
                            const nombre = (
                              <>
                                {p.nombre}
                                {p.id === yo && <span className="sr-only"> (tú)</span>}
                              </>
                            );
                            return p.usuarioId ? (
                              <a
                                href={`/perfil/${encodeURIComponent(p.usuarioId)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`min-w-0 truncate rounded underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main ${color}`}
                              >
                                {nombre}
                                <span className="sr-only"> (abre su perfil en una pestaña nueva)</span>
                              </a>
                            ) : (
                              <span className={`min-w-0 truncate ${color}`}>{nombre}</span>
                            );
                          })()}
                          {/* Distintivos: a la vista, una pastilla; para el lector, «(invitado)»… */}
                          {/* El pulpito, solo a quien juega (el narrador y los visitantes no juegan) */}
                          {p.novato && p.rol === 'jugador' && <PulpitoNovato tamano="h-6 w-6" paraLector />}
                          {!p.conCuenta && <Distintivo>invitado</Distintivo>}
                          {!p.conectado && <Distintivo tono="apagado">desconectado</Distintivo>}
                          {escuchando.has(p.id) && <span className="sr-only"> (escuchando una conversación)</span>}
                          {p.accesoGrimorio === 'concedido' && (
                            <>
                              <IconoLibroSecreto size={14} className="shrink-0 text-gold" />
                              <span className="sr-only"> (ve el grimorio)</span>
                            </>
                          )}
                        </span>
                        {/* Su volumen: los que hablan en la plaza (jugadores y narradores), no uno mismo */}
                        {volumen && p.id !== yo && (p.rol === 'jugador' || p.rol === 'narrador') && (
                          <VolumenParticipante nombre={p.nombre} volumen={volumen.de(p.id)} onCambiar={(v) => volumen.cambiar(p.id, v)} />
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
