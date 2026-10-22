import { TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
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
}

/**
 * Abajo del todo a la derecha de la sala (lo coloca SalaJuego), para todos: cuántos aldeanos, forasteros,
 * esbirros y demonios tiene la partida (según los asientos, sin los viajeros).
 *
 * El narrador lo ve en una tabla: por tipo, lo que ven los jugadores (por
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
const RepartoPartida = ({ distribucion, bolsa, asientos, npcs, setupAceptado, preparacion, pedir, onError }: RepartoPartidaProps) => {
  const { todosPorId } = useFichas();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [confirmacion, setConfirmacion] = useState('');
  const ariaLive = useAriaLive('bolsa');
  const { jugadores, viajeros } = distribucion;
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

  return (
    <section
      aria-labelledby="sala-reparto-titulo"
      className={`sala-aviso px-3 py-2 text-sm ${
        mal ? 'sala-aviso-error' : ''
      }`}
    >
      <h2
        ref={tituloRef}
        id="sala-reparto-titulo"
        tabIndex={-1}
        className="rotulo focus:outline-none"
      >
        Reparto de la partida
      </h2>
      <p className="text-xs text-on-surface-muted">
        {jugadores === 1 ? '1 jugador' : `${jugadores} jugadores`}
        {viajeros > 0 && ` y ${viajeros === 1 ? '1 viajero' : `${viajeros} viajeros`}`}
      </p>
      {!hayReparto ? (
        <p className="mt-1 text-xs text-on-surface-muted">Hacen falta al menos 5 jugadores.</p>
      ) : cuentas ? (
        // El narrador: por tipo, lo que ven los jugadores (por defecto), lo que toca con
        // el Barón y compañía (prevista) y lo que hay (en la bolsa o en juego). Una
        // tabla: el lector dice la columna de cada número.
        <table className="mt-1 text-xs tabular-nums">
          <caption className="sr-only">Reparto por tipos: por defecto, previsto y {donde}</caption>
          <thead>
            <tr className="font-ui text-[0.6rem] uppercase tracking-wide text-on-surface-muted">
              <td />
              <th scope="col" className="px-1.5 text-right font-normal">
                Defecto
              </th>
              <th scope="col" className="px-1.5 text-right font-normal">
                Prevista
              </th>
              <th scope="col" className="pl-1.5 text-right font-normal">
                Real
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Los viajeros, antes que los aldeanos (no tienen cupo: solo cuántos hay) */}
            {!!cuentas.traveller && (
              <tr>
                <th scope="row" className="pr-2 text-left font-normal text-theme-main">
                  Viajeros
                </th>
                <td className="px-1.5 text-right text-on-surface-muted">—</td>
                <td className="px-1.5 text-right text-on-surface-muted">—</td>
                <td className="pl-1.5 text-right">{cuentas.traveller}</td>
              </tr>
            )}
            {TIPOS_REPARTO.map(({ tipo, clave, nombre, color }) => {
              const defecto = distribucion[clave] ?? 0;
              const prevista = ajustado[clave] ?? 0;
              const real = cuentas[tipo] ?? 0;
              return (
                <tr key={tipo}>
                  <th scope="row" className={`pr-2 text-left font-normal ${color}`}>
                    {nombre}
                  </th>
                  <td className="px-1.5 text-right text-on-surface-muted">{defecto}</td>
                  {/* Si la prevista no es la de por defecto (un Barón…), en latón */}
                  <td className={`px-1.5 text-right ${prevista !== defecto ? 'font-semibold text-theme-main' : ''}`}>{prevista}</td>
                  {/* Lo que hay, en rojo si no es lo previsto y el reparto no vale (un Ermitaño puede
                      dejar uno menos sin que esté mal; aceptado a mano, tampoco) */}
                  <td className={`pl-1.5 text-right font-semibold ${mal && real !== prevista ? 'text-blood-bright' : 'text-on-surface-bright'}`}>
                    {real}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        // Los demás: lo que toca por defecto
        <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3">
          {TIPOS_REPARTO.map(({ tipo, clave, nombre, color }) => (
            <div key={tipo} className="contents">
              <dt className={color}>{nombre}</dt>
              <dd className="text-right tabular-nums">{distribucion[clave] ?? 0}</dd>
            </div>
          ))}
        </dl>
      )}
      {mal && (
        <div className="mt-2 max-w-56 border-t border-blood-bright/60 pt-2 text-xs">
          <p className="flex items-start gap-1.5 font-semibold text-blood-bright">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            La configuración de la partida no es correcta
          </p>
          <ul className="mt-1 list-disc pl-5 text-on-surface">
            {problemas.map((p) => (
              <li key={p}>{p}.</li>
            ))}
          </ul>
          {/* Salirse de las reglas a propósito: deja de avisar mientras el reparto no cambie */}
          <button type="button" onClick={() => void aceptar()} className={`${botonSecundario} mt-2 w-full font-ui text-xs`}>
            Es el que quiero
          </button>
        </div>
      )}
      <div aria-live={ariaLive} className="sr-only">
        {confirmacion}
      </div>
      {jugadores > 15 && (
        <p className="mt-1 max-w-48 text-xs text-on-surface-muted">Más de 15: los que sobran tienen que ser viajeros.</p>
      )}
    </section>
  );
};

export default RepartoPartida;
