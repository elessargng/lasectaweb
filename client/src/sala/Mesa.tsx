import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import Agujas from './Agujas';
import { useAriaLive, type TipoAviso } from './avisosConfig';
import AsaMover from './AsaMover';
import Asiento from './Asiento';
import CuentaAtras from './CuentaAtras';
import { hacenFalta } from './avisosSala';
import CuadroAvatar from './CuadroAvatar';
import FichaAsiento from './FichaAsiento';
import Mano from './Mano';
import PanelNominacion from './PanelNominacion';
import { botonPrincipal, botonSecundario } from './estilos';
import { ID_AYUDA_MOVER, idNombreAsiento } from './ids';
import { tamanoAvatarAuto, tamanoFichaAuto } from './tamanosAutomaticos';
import { useMoverAsientos } from './useMoverAsientos';
import { useNominacion } from './useNominacion';
import type { SalaEstado, SalaResultado } from './useSala';

export interface TamanosMesa {
  avatar: number;
  ficha: number;
}

export interface FocoAsiento {
  asientoId: string;
  /** Cómo debe quedar: sentado (true) o levantado (false). */
  sentado: boolean;
}

/** Límites de asientos; el servidor tiene los mismos y es quien los hace cumplir. */
const ASIENTOS_MAX = 20;

interface MesaProps {
  estado: SalaEstado;
  /** Mostrar en el centro los botones para añadir y eliminar asientos. */
  editando: boolean;
  /** Jugador con grimorio: puede cambiar las fichas en su grimorio. */
  grimorio: boolean;
  /** Tamaños elegidos a mano (Preferencias > Interfaz), en px. */
  manual: TamanosMesa;
  /** Qué tamaños calcula la mesa sola, según su tamaño en pantalla y los asientos. */
  auto: { avatar: boolean; ficha: boolean };
  /** Los tamaños con los que se está pintando (para la vista previa de las preferencias). */
  onTamanos: (tamanos: TamanosMesa) => void;
  /** Pide una acción a la sala (ver `useSala`). */
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** Avisos solo para el lector, con su tipo (p. ej. que otro te ha levantado del asiento). */
  onAnuncio: (tipo: TipoAviso, mensaje: string) => void;
  /**
   * Cambio de asiento que ha pedido uno mismo (sentarse aquí, o levantarse desde
   * el menú de usuario): cuando llega, el foco va al nombre del asiento y no se
   * avisa de nada.
   */
  focoAsientoRef: RefObject<FocoAsiento | null>;
  /** Dejar de editar los asientos. */
  onTerminar: () => void;
  /** Reloj del servidor menos el de aquí (ms), para la cuenta atrás. */
  desfaseReloj: number;
}

/**
 * Dónde va el asiento `i` de `total`: en un círculo, el primero a las 12 y
 * siguiendo como las agujas del reloj, así que el último queda hacia las 11.
 * El centro del cuadro se separa del borde de la mesa medio cuadro (--sala-avatar).
 */
function posicion(i: number, total: number): CSSProperties {
  const angulo = (2 * Math.PI * i) / total;
  const x = Math.sin(angulo).toFixed(4);
  const y = (-Math.cos(angulo)).toFixed(4);
  const radio = '(50% - var(--sala-avatar, 10rem) / 2)';
  return { left: `calc(50% + ${x} * ${radio})`, top: `calc(50% + ${y} * ${radio})` };
}

/**
 * Dónde va la ficha del asiento `i`: su centro, sobre la línea que va del centro
 * del cuadro al centro de la mesa, desplazado hacia dentro según
 * --sala-ficha-distancia (0 a 1): 0, centrada en el cuadro; 1, a (lado +
 * diámetro) / 2, justo fuera del cuadro en los asientos de arriba, abajo y los
 * lados.
 *
 * El desplazamiento es el mismo en todos los asientos, así que las fichas forman
 * un círculo perfecto, concéntrico con el de los asientos (en diagonal, al 100%,
 * pueden rozar la esquina del cuadro).
 */
function posicionFicha(i: number, total: number): CSSProperties {
  const angulo = (2 * Math.PI * i) / total;
  const x = Math.sin(angulo).toFixed(4);
  const y = (-Math.cos(angulo)).toFixed(4);
  const t = 'var(--sala-ficha-distancia, 0.75)';
  // Radio de las fichas: el de los asientos menos el desplazamiento hacia dentro.
  const radio = `(50% - var(--sala-avatar, 10rem) / 2 - ${t} * (var(--sala-avatar, 10rem) + var(--sala-ficha, 4.5rem)) / 2)`;
  return { left: `calc(50% + ${x} * ${radio})`, top: `calc(50% + ${y} * ${radio})` };
}

const textoAsientos = (n: number) => (n === 1 ? '1 asiento' : `${n} asientos`);

/**
 * La mesa: los asientos de la partida en círculo, del tamaño de avatar que cada
 * uno ha elegido. En modo edición (solo narradores), en el centro, los botones
 * para añadir un asiento al final del círculo, eliminar el último o mezclar a
 * quienes están sentados.
 *
 * Cada asiento (ver Asiento) es libre u ocupado, con su botón para sentarse.
 * Editando, los ocupados llevan un asa para mover al jugador a otro asiento
 * (ver useMoverAsientos). Hacia el centro, la ficha redonda de cada jugador:
 * todos ven la de cada jugador (ver FichaJugador). Para el lector, los asientos son una lista ordenada.
 * Al añadir o quitar asientos se anuncia cuántos quedan: el foco sigue en el botón.
 */
const Mesa = ({
  estado,
  editando,
  grimorio,
  manual,
  auto,
  onTamanos,
  pedir,
  onError,
  onAnuncio,
  focoAsientoRef,
  onTerminar,
  desfaseReloj,
}: MesaProps) => {
  const anadirRef = useRef<HTMLButtonElement>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const { asientos, participantes, yo, acciones } = estado;
  const total = asientos.length;
  const puedeSentarse = acciones.includes('sala:sentarse');
  // El narrador usa las fichas (matar, revivir…) si el servidor se lo permite; un
  // jugador con grimorio, para cambiarlas en el suyo; si no, solo se ven.
  const modoFichas = acciones.includes('narrador:cambiarVida') ? 'narrador' : grimorio ? 'grimorio' : 'ver';
  const mesaRef = useRef<HTMLDivElement>(null);
  const ariaLiveAsientos = useAriaLive('editarAsientos');

  // Lado de la mesa en pantalla, para los tamaños automáticos.
  const [ladoMesa, setLadoMesa] = useState(0);
  useEffect(() => {
    const mesa = mesaRef.current;
    if (!mesa) return;
    const observador = new ResizeObserver(([e]) => setLadoMesa(e.contentRect.width));
    observador.observe(mesa);
    return () => observador.disconnect();
  }, []);
  const avatar = auto.avatar && ladoMesa ? tamanoAvatarAuto(ladoMesa, total) : manual.avatar;
  const ficha = auto.ficha ? tamanoFichaAuto(avatar) : manual.ficha;
  useEffect(() => {
    onTamanos({ avatar, ficha });
  }, [avatar, ficha, onTamanos]);
  const mover = useMoverAsientos({
    asientos,
    participantes,
    mesaRef,
    pedir,
    onError,
    onAnuncio: (m) => onAnuncio('moverJugadores', m),
  });
  const nominar = useNominacion({ estado, pedir, onError, onAnuncio: (m) => onAnuncio('nominaciones', m) });
  // Asientos (desde 0) de quien nomina y del nominado, para las agujas.
  const { nominacion } = estado;
  const posicionDe = (id: string) => asientos.findIndex((a) => a.id === id);
  const agujas =
    nominacion && posicionDe(nominacion.desde) >= 0 && posicionDe(nominacion.hasta) >= 0
      ? { desde: posicionDe(nominacion.desde), hasta: posicionDe(nominacion.hasta) }
      : null;
  const participante = (id: string | null) => (id ? (participantes.find((p) => p.id === id) ?? null) : null);
  // Lo que se arrastra con el puntero: se dibuja siguiéndolo.
  const arrastrado = mover.activo?.modo === 'puntero' ? mover.activo : null;

  // Al sentarse o levantarse, el foco va al nombre del asiento («3, Ana
  // (tú)» / «Asiento 3, libre») cuando llegue el cambio.
  // Mi asiento en la última pintura, para saber si otro me ha levantado.
  const miAsientoRef = useRef<string | null>(null);
  useEffect(() => {
    const pendiente = focoAsientoRef.current;
    const antes = miAsientoRef.current;
    const ahora = asientos.find((a) => a.ocupante === yo)?.id ?? null;
    miAsientoRef.current = ahora;

    if (pendiente) {
      const asiento = asientos.find((a) => a.id === pendiente.asientoId);
      if (asiento && (asiento.ocupante === yo) !== pendiente.sentado) return; // aún no ha llegado
      focoAsientoRef.current = null;
      document.getElementById(idNombreAsiento(pendiente.asientoId))?.focus();
      return;
    }

    // Me han levantado (un narrador, o ha eliminado mi asiento): se avisa, y si el
    // foco se ha perdido (estaba en «Levantarse del asiento» del menú, que ya no
    // existe), va al asiento.
    // Si he pasado a narrador, ya se avisa de eso (SalaJuego).
    const narro = participantes.some((p) => p.id === yo && p.rol === 'narrador');
    if (antes && ahora && antes !== ahora) {
      // Me han cambiado de sitio (mezclar).
      onAnuncio('miAsiento', `Ahora estás en el asiento ${asientos.findIndex((a) => a.id === ahora) + 1}.`);
      return;
    }
    if (antes && antes !== ahora) {
      const sigue = asientos.some((a) => a.id === antes);
      if (!narro) onAnuncio('miAsiento', sigue ? 'Te han levantado del asiento.' : 'Se ha eliminado tu asiento.');
      const perdido = !document.activeElement || document.activeElement === document.body;
      if (perdido) document.getElementById(sigue ? idNombreAsiento(antes) : 'sala-asientos')?.focus();
    }
  });

  const sentarse = async (asientoId: string) => {
    focoAsientoRef.current = { asientoId, sentado: true };
    const r = await pedir('sala:sentarse', { asientoId });
    if (!r.ok) {
      focoAsientoRef.current = null;
      onError(r.error);
    }
  };

  const cambiar = async (cambio: 'añadir' | 'quitar' | 'mezclar') => {
    if (pidiendo) return;
    setPidiendo(true);
    const r = await pedir('narrador:asientos', { cambio });
    setPidiendo(false);
    if (!r.ok) onError(r.error);
    // Al mezclar no cambia nada donde está el foco: se le dice al lector.
    else if (cambio === 'mezclar') onAnuncio('mezclar', 'Jugadores mezclados.');
  };

  // Sin `disabled` (tiraría el foco al body): se marcan y no hacen nada.
  const sinMas = total >= ASIENTOS_MAX;
  const sinAsientos = total === 0;
  const pocosParaMezclar = !asientos.some((a) => a.ocupante);

  return (
    <div
      ref={mesaRef}
      // isolate: las capas de la mesa (fichas, agujas, centro) no compiten con la cabecera y sus menús
      className="relative isolate mx-auto aspect-square w-full max-w-[calc(100vh-8rem)]"
      // Los tamaños de la mesa (automáticos o no) para sus asientos y fichas.
      style={{ '--sala-avatar': `${avatar}px`, '--sala-ficha': `${ficha}px` } as CSSProperties}
    >
      {total > 0 ? (
        <ol id="sala-asientos" tabIndex={-1} aria-label="Asientos" className="focus:outline-none">
          {asientos.map((a, i) => {
            // Editando, se ve el movimiento provisional (si se está moviendo a alguien).
            const visible = editando ? mover.ocupanteVisible(a) : a.ocupante;
            const ocupante = participante(visible);
            const real = participante(a.ocupante);
            return (
              <li
                key={a.id}
                data-asiento={a.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={posicion(i, total)}
              >
                <Asiento
                  id={a.id}
                  numero={i + 1}
                  ocupante={ocupante}
                  esYo={visible === yo}
                  puedeSentarse={puedeSentarse}
                  onSentarse={() => sentarse(a.id)}
                  destino={editando && !!mover.activo && mover.activo.hasta === a.id && mover.activo.hasta !== mover.activo.desde}
                  // Mitad inferior de la mesa (entre las 3 y las 9, sin contarlas): nombre debajo
                  nombreAbajo={-Math.cos((2 * Math.PI * i) / total) > 0.01}
                  angulo={(2 * Math.PI * i) / total}
                  asa={editando && real && <AsaMover {...mover.propsAsa(a.id)} nombre={real.nombre} numero={i + 1} />}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        !editando && (
          <p className="absolute inset-0 flex items-center justify-center text-on-surface-muted">
            La mesa no tiene asientos.
          </p>
        )
      )}

      {/* Una ficha por jugador sentado, hacia dentro del círculo y por encima de
          los cuadros (después de ellos y con z-index). La capa ocupa toda la mesa
          (las fichas se colocan respecto a ella, como los asientos) y no captura el
          ratón, así que lo que tapa se sigue pudiendo pulsar. Cada ficha es un botón
          para el narrador o un jugador con grimorio; para los demás, solo se ve. */}
      {/* Con el menú de una ficha abierto, la capa sube por encima de las agujas y del centro */}
      <div
        aria-hidden={modoFichas === 'ver' ? true : undefined}
        className="pointer-events-none absolute inset-0 z-10 has-[[aria-expanded=true]]:z-40"
      >
        {asientos.map((a, i) => {
          // La ficha es del asiento; quien se ve sentado (con el movimiento provisional, si lo hay).
          const visible = editando ? mover.ocupanteVisible(a) : a.ocupante;
          const ocupante = participante(visible);
          const eligiendo = nominar.eligiendo(a.id);
          return (
            <div
              key={a.id}
              // La ficha con el menú abierto, por encima de las demás (si no, su menú quedaría debajo)
              className={`absolute -translate-x-1/2 -translate-y-1/2 has-[[aria-expanded=true]]:z-50 ${modoFichas === 'ver' && !eligiendo ? '' : 'pointer-events-auto'}`}
              style={posicionFicha(i, total)}
            >
              <FichaAsiento
                asiento={a}
                numero={i + 1}
                ocupante={ocupante}
                propia={!!ocupante && ocupante.id === estado.yo}
                modo={modoFichas}
                pedir={pedir}
                onError={onError}
                onNominar={nominar.onNominar?.(a.id)}
                eligiendo={eligiendo}
                voto={nominacion?.votacion?.resultados[a.id]}
              />
              {ocupante?.manoLevantada && (
                // Mano levantada montada sobre la esquina de arriba a la derecha de su ficha
                // (pegada a ella, para que se sepa de quién es aunque las fichas estén juntas);
                // se dice en el nombre de la ficha y en los avisos
                <Mano
                  forma={ocupante.formaMano}
                  className="pointer-events-none absolute -right-[8%] -top-[12%] z-10 w-[calc(var(--sala-ficha,4.5rem)*0.55)] drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]"
                />
              )}
            </div>
          );
        })}
      </div>

      {editando && (
        <p id={ID_AYUDA_MOVER} className="sr-only">
          Intro o Espacio para coger y soltar, flechas para elegir asiento, Escape para cancelar.
        </p>
      )}

      {arrastrado && (
        // El jugador que se arrastra, siguiendo al puntero (solo visual)
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: arrastrado.x, top: arrastrado.y }}
        >
          <CuadroAvatar imagen={participante(asientos.find((a) => a.id === arrastrado.desde)?.ocupante ?? null)?.avatar} />
        </div>
      )}

      {agujas && (
        <Agujas
          total={total}
          desde={agujas.desde}
          hasta={agujas.hasta}
          votacion={
            nominacion?.votacion
              ? {
                  // La aguja va ya hacia la siguiente ficha y llega justo cuando el
                  // servidor la cuenta (cada paso dura lo mismo); al terminar, en el nominado.
                  paso: Math.min(nominacion.votacion.paso + 1, nominacion.votacion.orden.length),
                  segundosPorFicha: estado.configuracion.segundosPorFicha,
                }
              : undefined
          }
        />
      )}

      {nominacion && !nominar.panel && (
        // Debajo del eje de las agujas: los votos que hacen falta (el narrador lo ve en su panel)
        <p className="absolute left-1/2 top-[calc(50%+3rem)] z-30 -translate-x-1/2 whitespace-nowrap rounded bg-background/70 px-3 py-1 text-sm font-semibold text-white">
          {hacenFalta(nominacion.votosNecesarios)}
        </p>
      )}

      {/* El centro de la mesa: la cuenta atrás (todos), el panel de la nominación y
          el de editar asientos (narradores). Por encima de las agujas. */}
      {(nominacion?.cuentaAtrasFin || nominar.panel || nominar.cancelar || editando) && (
        <div className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
          {nominacion?.votacion ? (
            // Votando: los votos que lleva, en grande (se anuncian al terminar)
            <p
              aria-hidden="true"
              className="font-teutonic1 text-5xl leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
            >
              {nominacion.votacion.votos === 1 ? '1 voto' : `${nominacion.votacion.votos} votos`}
            </p>
          ) : nominacion?.cuentaAtrasFin && (
            <CuentaAtras
              key={nominacion.cuentaAtrasFin}
              fin={nominacion.cuentaAtrasFin}
              desfase={desfaseReloj}
              onTermina={() => onAnuncio('cuentaAtras', 'Tiempo.')}
            />
          )}
          {nominar.cancelar && (
            <div className="rounded border border-outline-ghost bg-surface/90 p-4">
              <button type="button" onClick={nominar.cancelar} className={botonSecundario}>
                Cancelar nominación
              </button>
            </div>
          )}
          {nominar.panel && (
            <div className="rounded border border-outline-ghost bg-surface/90 p-4">
              <PanelNominacion {...nominar.panel} />
            </div>
          )}
          {editando && (
            <div className="flex flex-col items-center gap-3 rounded border border-outline-ghost bg-surface/90 p-4">
              <p aria-live={ariaLiveAsientos} className="text-sm text-on-surface-muted">
                {textoAsientos(total)}
              </p>
              <button
                ref={anadirRef}
                type="button"
                onClick={() => !sinMas && cambiar('añadir')}
                aria-disabled={sinMas || pidiendo}
                className={`${botonPrincipal} w-full`}
              >
                Añadir asiento
              </button>
              <button
                type="button"
                onClick={() => !sinAsientos && cambiar('quitar')}
                aria-disabled={sinAsientos || pidiendo}
                className={`${botonPrincipal} w-full`}
              >
                Eliminar asiento
              </button>
              <button
                type="button"
                onClick={() => !pocosParaMezclar && cambiar('mezclar')}
                aria-disabled={pocosParaMezclar || pidiendo}
                className={`${botonPrincipal} w-full`}
              >
                Mezclar
              </button>
              <button type="button" onClick={onTerminar} className={`${botonSecundario} w-full`}>
                Terminar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Mesa;
