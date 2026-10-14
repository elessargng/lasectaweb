import { contarBolsa, TIPOS_REPARTO, useFichas } from './fichas';
import type { SalaDistribucion } from './useSala';

/**
 * Abajo del todo a la derecha de la sala; con la hoja de personajes o el orden
 * de noche abiertos, a su izquierda, para que no lo tapen (en pantallas estrechas, debajo de
 * la mesa), para todos: cuántos aldeanos, forasteros,
 * esbirros y demonios tiene la partida (según los asientos, sin los viajeros).
 * El narrador ve además cuántos lleva metidos en la bolsa de cada tipo («2/5»).
 * Se actualiza solo al cambiar los asientos o los viajeros.
 */
const RepartoPartida = ({ distribucion, bolsa }: { distribucion: SalaDistribucion; bolsa: string[] | null }) => {
  const { porId } = useFichas();
  const enBolsa = bolsa ? contarBolsa(bolsa, (id) => porId.get(id)?.tipo) : null;
  const { jugadores, viajeros } = distribucion;
  const hayReparto = distribucion.aldeanos !== null;

  return (
    <section
      aria-labelledby="sala-reparto-titulo"
      className="self-start rounded border border-outline-ghost bg-surface/85 px-3 py-2 text-sm lg:fixed lg:bottom-4 lg:right-[calc(var(--sala-panel-guion-ancho,0px)+1rem)] lg:z-30"
    >
      <h2 id="sala-reparto-titulo" className="text-xs font-semibold uppercase tracking-wide text-theme-main">
        Reparto de la partida
      </h2>
      <p className="text-xs text-on-surface-muted">
        {jugadores === 1 ? '1 jugador' : `${jugadores} jugadores`}
        {viajeros > 0 && ` y ${viajeros === 1 ? '1 viajero' : `${viajeros} viajeros`}`}
      </p>
      {!hayReparto ? (
        <p className="mt-1 text-xs text-on-surface-muted">Hacen falta al menos 5 jugadores.</p>
      ) : (
        <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3">
          {TIPOS_REPARTO.map(({ tipo, clave, nombre, color }) => {
            const total = distribucion[clave] ?? 0;
            const metidos = enBolsa?.[tipo] ?? 0;
            return (
              <div key={tipo} className="contents">
                <dt className={color}>{nombre}</dt>
                <dd className="text-right tabular-nums">
                  {enBolsa ? (
                    <>
                      {metidos}/{total}
                      <span className="sr-only"> en la bolsa</span>
                    </>
                  ) : (
                    total
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {jugadores > 15 && (
        <p className="mt-1 max-w-48 text-xs text-on-surface-muted">Más de 15: los que sobran tienen que ser viajeros.</p>
      )}
    </section>
  );
};

export default RepartoPartida;
