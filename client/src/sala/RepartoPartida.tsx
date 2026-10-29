import { TriangleAlert } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { useAriaLive } from './avisosConfig';
import { firmaDelReparto, problemasDelReparto, repartoAjustado } from './comprobarReparto';
import { botonSecundario } from './estilos';
import { contarBolsa, identidadDe, TIPOS_REPARTO, useFichas } from './fichas';
import type { SalaAsiento, SalaDistribucion, SalaResultado } from './useSala';

interface RepartoPartidaProps {
  distribucion: SalaDistribucion;
  /** La bolsa (solo el narrador); null para los demás. */
  bolsa: string[] | null;
  asientos: SalaAsiento[];
  /** Los NPCs en juego (el Centinela altera la preparación). */
  npcs: string[];
  /** El reparto dado por bueno a mano aunque no cuadre (su firma), o null. */
  setupAceptado: string | null;
  /**
   * La partida está en su preparación: solo entonces se comprueba el reparto. Desde
   * la noche 1, el juego puede cambiar los personajes y ya no tiene por qué cuadrar.
   */
  preparacion: boolean;
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** En una línea (en la cabecera de la hoja del guion): los vivos y cuántos de cada tipo. */
  resumido?: boolean;
}

/**
 * Abajo del todo a la derecha de la sala (lo coloca SalaJuego; con la hoja del guion
 * abierta, resumido en su cabecera), para todos: cuántos aldeanos, forasteros,
 * esbirros y demonios tiene la partida (según los asientos, sin los viajeros).
 *
 * Cada tipo, en un arco de piedra que se abre hacia la luz de su bando, con el
 * número dentro (para el lector, una lista: «Aldeanos, 5»). Los jugadores ven lo
 * que toca por defecto. El narrador ve, por tipo, lo que ven los jugadores (por
 * defecto), lo que toca con los personajes que cambian los forasteros sin dejar
 * elegir (prevista: el Barón, el Fang Gu…) y lo que hay (real): los de la bolsa
 * mientras la prepara y, en cuanto hay personajes en la mesa, los que están en
 * juego, por quien es cada uno de verdad (un Borracho con la ficha de un aldeano
 * cuenta como forastero). Antes que nada, los viajeros. Si el reparto está
 * completo y no es el de la partida, durante la preparación (luego el juego cambia
 * personajes y ya no tiene por qué), (teniendo en cuenta los personajes que
 * alteran la preparación: el Barón, el Ermitaño…), lo avisa en rojo y dice qué
 * no cuadra. Si el narrador se sale de las reglas a propósito (un Amnésico cuya
 * habilidad es que no haya forasteros), «Es el que quiero» lo da por bueno: el
 * recuadro vuelve a su aspecto de siempre hasta que el reparto cambie.
 */
const RepartoPartida = ({ distribucion, bolsa, asientos, npcs, setupAceptado, preparacion, pedir, onError, resumido = false }: RepartoPartidaProps) => {
  const { todosPorId } = useFichas();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const ariaLive = useAriaLive('bolsa');
  const { jugadores, jugadoresVivos, viajeros, viajerosVivos } = distribucion;
  const hayReparto = distribucion.aldeanos !== null;

  // Lo que se cuenta: lo que hay en juego (si ya hay personajes en la mesa) o la bolsa
  const enMesa = asientos.some((a) => a.personaje);
  const ids = !bolsa
    ? null
    : enMesa
      ? asientos.flatMap((a) => {
          const id = identidadDe(a).personaje;
          return id ? [id] : [];
        })
      : bolsa;
  const cuentas = ids ? contarBolsa(ids, (id) => todosPorId.get(id)?.tipo) : null;
  const donde = enMesa ? 'en juego' : 'en la bolsa';
  const regulares = cuentas ? TIPOS_REPARTO.reduce((n, { tipo }) => n + (cuentas[tipo] ?? 0), 0) : 0;
  // Solo con el reparto completo (mientras se prepara, siempre faltaría algo)
  const problemas =
    cuentas && ids && hayReparto && regulares === jugadores ? problemasDelReparto(cuentas, distribucion, [...ids, ...npcs]) : [];
  const firma = cuentas ? firmaDelReparto(cuentas, jugadores) : null;
  const mal = preparacion && problemas.length > 0 && firma !== setupAceptado;
  // Lo que toca de cada tipo, con el Barón y compañía ya contados. Solo el narrador: a los
  // demás no se les cambia (sabrían que están en juego)
  const ajustado = ids ? repartoAjustado(distribucion, [...ids, ...npcs]) : distribucion;

  const aceptar = async () => {
    const r = await pedir('narrador:aceptarSetup', { firma });
    if (!r.ok) return onError(r.error);
    // El botón desaparece con el aviso: el foco va al título del recuadro, y se confirma
    tituloRef.current?.focus();
    setConfirmacion('Reparto aceptado tal como está.');
  };

  // Lo que se ve de cada tipo: lo que hay (el narrador) o lo que toca por defecto
  const numeroDe = (tipo: string, clave: (typeof TIPOS_REPARTO)[number]['clave']) =>
    cuentas ? (cuentas[tipo] ?? 0) : (distribucion[clave] ?? 0);

  // En la hoja del guion: «7/7 jugadores vivos · 7/1/2/1». Para el lector, los tipos con su nombre
  if (resumido)
    return (
      <p className="mt-1 text-sm text-hoja-lacre">
        <span className="tabular-nums">
          {jugadoresVivos}/{jugadores}
        </span>{' '}
        {jugadores === 1 ? 'jugador vivo' : 'jugadores vivos'}
        {hayReparto && (
          <>
            <span aria-hidden="true">
              {' · '}
              {TIPOS_REPARTO.map(({ tipo, clave }, i) => (
                <Fragment key={tipo}>
                  {i > 0 && '/'}
                  <span className={`font-semibold tabular-nums ${tipo === 'townsfolk' || tipo === 'outsider' ? 'text-hoja-bueno' : 'text-hoja-malvado'}`}>
                    {numeroDe(tipo, clave)}
                  </span>
                </Fragment>
              ))}
            </span>
            <span className="sr-only">
              {'. '}
              {TIPOS_REPARTO.map(({ tipo, clave, nombre }) => {
                const n = numeroDe(tipo, clave);
                return `${n} ${n === 1 ? nombre.slice(0, -1).toLowerCase() : nombre.toLowerCase()}`;
              }).join(', ')}
            </span>
          </>
        )}
      </p>
    );

  return (
    <section aria-labelledby="sala-reparto-titulo" className="sala-reparto text-sm" data-mal={mal || undefined}>
      <DefinicionesArco />
      {/* Las esquinas de latón de la placa */}
      <span aria-hidden="true" className="sala-reparto-esquina left-1 top-1" />
      <span aria-hidden="true" className="sala-reparto-esquina right-1 top-1 rotate-90" />
      <span aria-hidden="true" className="sala-reparto-esquina bottom-1 right-1 rotate-180" />
      <span aria-hidden="true" className="sala-reparto-esquina bottom-1 left-1 -rotate-90" />
      <h2
        ref={tituloRef}
        id="sala-reparto-titulo"
        tabIndex={-1}
        className="sala-reparto-titulo focus:outline-none"
      >
        Reparto de la partida
      </h2>
      <p className="mt-1 text-center text-xs text-on-surface-muted">
        <span className="font-display text-base leading-none text-on-surface-bright tabular-nums">
          {jugadoresVivos}/{jugadores}
        </span>{' '}
        {jugadores === 1 ? 'jugador vivo' : 'jugadores vivos'}
      </p>
      {viajeros > 0 && (
        <p className="text-center text-xs text-on-surface-muted">
          <span className="font-display text-sm leading-none text-gold-bright tabular-nums">
            {viajerosVivos}/{viajeros}
          </span>{' '}
          {viajeros === 1 ? 'viajero vivo' : 'viajeros vivos'}
        </p>
      )}
      <span aria-hidden="true" className="sala-reparto-filete" />
      {!hayReparto ? (
        <p className="text-center text-xs text-on-surface-muted italic">Hacen falta al menos 5 jugadores.</p>
      ) : (
        <>
          {/* El narrador: los viajeros que hay (no tienen cupo: solo cuántos) */}
          {!!cuentas?.traveller && (
            <p className="mb-2 text-center text-xs text-on-surface-muted">
              Viajeros {donde}:{' '}
              <span className="font-display text-sm leading-none text-gold-bright tabular-nums">{cuentas.traveller}</span>
            </p>
          )}
          {/* Un arco por tipo, con el número dentro. Para todos, lo que toca por defecto; el
              narrador ve lo que hay (en la bolsa o en juego) y, debajo, lo que toca con el
              Barón y compañía (y el de por defecto, si cambia). El arco que no cuadra, en rojo */}
          <dl className="grid grid-cols-4 gap-1.5">
            {TIPOS_REPARTO.map(({ tipo, clave, nombre }) => {
              const defecto = distribucion[clave] ?? 0;
              const prevista = ajustado[clave] ?? 0;
              const numero = numeroDe(tipo, clave);
              // Lo que hay, mal si no es lo previsto y el reparto no vale (un Ermitaño puede
              // dejar uno menos sin que esté mal; aceptado a mano, tampoco)
              const fallo = !!cuentas && mal && numero !== prevista;
              return (
                <div
                  key={tipo}
                  className="sala-reparto-tipo"
                  data-bando={tipo === 'townsfolk' || tipo === 'outsider' ? 'bien' : 'mal'}
                  data-cero={numero === 0 || undefined}
                  data-fallo={fallo || undefined}
                >
                  <dt className="sala-reparto-nombre">{nombre}</dt>
                  <dd className="contents">
                    <span className="sala-reparto-arco">
                      <svg aria-hidden="true" viewBox="0 0 64 74">
                        <use href="#sala-reparto-arco" />
                      </svg>
                      <span className="sala-reparto-numero">{numero}</span>
                    </span>
                    {cuentas && (
                      <>
                        <span className="sr-only"> {donde}</span>
                        <span className="sala-reparto-toca">
                          toca <b>{prevista}</b>
                          {prevista !== defecto && (
                            <>
                              <span aria-hidden="true"> · def. </span>
                              <span className="sr-only">, por defecto </span>
                              {defecto}
                            </>
                          )}
                        </span>
                        {fallo && <span className="sr-only">, no cuadra</span>}
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
      {mal && (
        <div className="sala-reparto-error mt-3 pt-2.5 text-xs">
          <p className="flex items-start gap-1.5 font-ui text-[0.7rem] font-semibold tracking-wide text-blood-bright">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            La configuración de la partida no es correcta
          </p>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-on-surface marker:text-blood-bright">
            {problemas.map((p) => (
              <li key={p}>{p}.</li>
            ))}
          </ul>
          {/* Salirse de las reglas a propósito: deja de avisar mientras el reparto no cambie */}
          <button type="button" onClick={() => void aceptar()} className={`${botonSecundario} mt-2.5 w-full font-ui text-xs`}>
            Es el que quiero
          </button>
        </div>
      )}
      <div aria-live={ariaLive} className="sr-only">
        {confirmacion}
      </div>
      {jugadores > 15 && (
        <p className="mt-2 text-center text-xs text-on-surface-muted italic">Más de 15: los que sobran tienen que ser viajeros.</p>
      )}
    </section>
  );
};

/**
 * El arco de piedra (uno para todos, con <use>): de medio punto, en piedra labrada
 * y sin latón, con la rosca de dovelas, la clave que sobresale, las impostas y las
 * jambas de sillares. El vano se abre hacia la luz de su bando, centrada detrás del
 * número; la toma de --sala-arco-fondo (ver sala.css).
 */
const DefinicionesArco = () => (
  <svg aria-hidden="true" width="0" height="0" className="absolute">
    <defs>
      {/* Piedra labrada, clara y gastada, con algo de grano */}
      <linearGradient id="sala-reparto-sillar" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="#8a8274" />
        <stop offset="0.5" stopColor="#5f584c" />
        <stop offset="1" stopColor="#36322b" />
      </linearGradient>
      <filter id="sala-reparto-grano" x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="ruido" />
        <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 -0.12" result="motas" />
        <feComposite in="motas" in2="SourceGraphic" operator="in" result="grano" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="grano" />
        </feMerge>
      </filter>
      {/* La luz de cada bando, al fondo del vano y centrada detrás del número */}
      <radialGradient id="sala-reparto-fondo-bien" cx="0.5" cy="0.52" r="0.6">
        <stop offset="0" stopColor="#8dbbec" stopOpacity="0.95" />
        <stop offset="0.35" stopColor="#2d5c98" />
        <stop offset="0.75" stopColor="#11203f" />
        <stop offset="1" stopColor="#070b18" />
      </radialGradient>
      <radialGradient id="sala-reparto-fondo-mal" cx="0.5" cy="0.52" r="0.6">
        <stop offset="0" stopColor="#ff9a7a" stopOpacity="0.95" />
        <stop offset="0.35" stopColor="#9e1b25" />
        <stop offset="0.75" stopColor="#3a0b12" />
        <stop offset="1" stopColor="#120407" />
      </radialGradient>
      <radialGradient id="sala-reparto-fondo-cero" cx="0.5" cy="0.95" r="0.9">
        <stop offset="0" stopColor="#3a3d4c" />
        <stop offset="1" stopColor="#0a0b12" />
      </radialGradient>
      <linearGradient id="sala-reparto-hondo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.7" />
        <stop offset="0.6" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <symbol id="sala-reparto-arco" viewBox="0 0 64 74">
        {/* Jambas de sillares y rosca de dovelas */}
        <path d="M2 74 V38 A30 30 0 0 1 62 38 V74 Z" fill="url(#sala-reparto-sillar)" filter="url(#sala-reparto-grano)" />
        {/* El vano, hacia la luz del fondo */}
        <path d="M11 74 V38 A21 21 0 0 1 53 38 V74 Z" style={{ fill: 'var(--sala-arco-fondo)' }} />
        <path d="M11 74 V38 A21 21 0 0 1 53 38 V74 Z" fill="url(#sala-reparto-hondo)" />
        {/* Juntas de las dovelas */}
        <path
          d="M12.6 30 L4.3 26.5 M17.2 23.2 L10.8 16.8 M24 18.6 L20.5 10.3 M40 18.6 L43.5 10.3 M46.8 23.2 L53.2 16.8 M51.4 30 L59.7 26.5"
          stroke="#1d1a15"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        {/* Impostas */}
        <path d="M0.5 37 H12.5 V41 H0.5 Z M51.5 37 H63.5 V41 H51.5 Z" fill="#7a7366" stroke="#1d1a15" strokeWidth="0.8" />
        {/* Hiladas de las jambas */}
        <path
          d="M2 50 H11 M2 62 H11 M53 50 H62 M53 62 H62 M6 41 V50 M58 41 V50 M4 50 V62 M60 50 V62 M7 62 V74 M57 62 V74"
          stroke="#1d1a15"
          strokeWidth="0.8"
        />
        {/* La clave, que sobresale */}
        <path d="M29.1 17.2 L27 5 L37 5 L34.9 17.2 Z" fill="#8f877a" stroke="#1d1a15" strokeWidth="0.9" strokeLinejoin="round" />
        {/* Contorno y luz rasante en la rosca */}
        <path d="M2 74 V38 A30 30 0 0 1 62 38 V74" fill="none" stroke="#1d1a15" strokeWidth="1.2" />
        <path d="M11 74 V38 A21 21 0 0 1 53 38 V74" fill="none" stroke="#1d1a15" strokeWidth="1" />
        <path d="M5 30 A27.5 27.5 0 0 1 59 30" fill="none" stroke="#c9bfa8" strokeOpacity="0.35" strokeWidth="0.8" />
      </symbol>
    </defs>
  </svg>
);

export default RepartoPartida;
