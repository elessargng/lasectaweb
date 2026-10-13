import FichaRedonda from './FichaRedonda';
import { nombreMano } from './formasMano';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import { idFichaNominar } from './ids';
import { describirAsiento } from './nombresAsiento';
import type { SalaAsiento, SalaParticipante, SalaResultado } from './useSala';

interface FichaAsientoProps {
  asiento: SalaAsiento;
  /** Su número en la mesa (1 es el de las 12). */
  numero: number;
  /** Quien está sentado (o se ve sentado, si se le está moviendo), o null. */
  ocupante: SalaParticipante | null;
  /**
   * - narrador: botón con las opciones de la partida (matar o revivir…).
   * - grimorio: jugador con grimorio; botón para cambiar la ficha en su grimorio
   *   (solo suyo, no cambia la partida).
   * - ver: solo se ve.
   */
  modo: 'narrador' | 'grimorio' | 'ver';
  pedir: (accion: string, datos?: unknown) => Promise<SalaResultado>;
  onError: (mensaje: string) => void;
  /** El narrador puede abrir una nominación desde esta ficha («Nominar a…»). */
  onNominar?: () => void;
  /**
   * Se está eligiendo a quién nomina una ficha: esta es un botón para elegirla
   * (también la que nomina, que se nominaría a sí misma; se distingue con un aro blanco).
   */
  eligiendo?: { papel: 'origen' | 'candidata'; onPulsar: () => void };
  /** En una votación: votos acumulados si votó, null si no; sin definir si aún no le ha tocado. */
  voto?: number | null;
}

/**
 * La ficha de un asiento. Cada asiento tiene la suya, haya alguien sentado o no:
 * la muerte (sudario) y la calavera son de la ficha. Todos las ven.
 *
 * Para el narrador es un botón (mano al pasar el ratón) con las opciones de la
 * partida: matar o revivir, marcar o desmarcar (la calavera), nominar a otra
 * ficha y (más adelante) cambiarla.
 * Mientras se elige a quién nomina, es un botón para elegirla. Un jugador con
 * grimorio puede cambiar las fichas en el suyo. Si no, solo se ve.
 *
 * Su nombre dice de qué asiento es, quién se sienta y su estado; al matar o
 * revivir el foco vuelve a ella, así que el lector oye el estado nuevo.
 */
const FichaAsiento = ({ asiento, numero, ocupante, modo, pedir, onError, onNominar, eligiendo, voto }: FichaAsientoProps) => {
  const ficha = <FichaRedonda muerto={asiento.muerto} marcado={asiento.marcado} voto={voto} />;

  if (eligiendo) {
    const origen = eligiendo.papel === 'origen';
    return (
      <button
        id={idFichaNominar(asiento.id)}
        type="button"
        onClick={eligiendo.onPulsar}
        aria-label={`Nominar al ${describirAsiento(numero, ocupante)}${origen ? ', que es el que nomina' : ''}`}
        className={`block cursor-pointer rounded-full ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-4 focus-visible:ring-white ${
          origen ? 'ring-4 ring-white/80' : 'ring-2 ring-[#b3261e]'
        }`}
      >
        {ficha}
      </button>
    );
  }

  if (modo === 'ver') return ficha;

  const cambiarVida = async () => {
    const r = await pedir('narrador:cambiarVida', { asientoId: asiento.id, muerto: !asiento.muerto });
    if (!r.ok) onError(r.error);
    // false: el menú se cierra y el foco vuelve a la ficha, que ya dice su estado.
    return false;
  };

  // Desde aquí la marca no cierra la nominación (el botón «Marca» de la nominación sí).
  const cambiarMarca = async () => {
    const r = await pedir('narrador:marcar', { asientoId: asiento.id, marcado: !asiento.marcado, cerrarNominacion: false });
    if (!r.ok) onError(r.error);
    // false: el menú se cierra y el foco vuelve a la ficha, que ya dice si lleva la calavera.
    return false;
  };

  // Aún sin definir: se ve, pero no hace nada.
  const cambiarFicha: OpcionMenu = {
    id: 'cambiar',
    etiqueta: 'Cambiar ficha (próximamente)',
    deshabilitada: true,
    elegir: () => {},
  };
  const quien = ocupante ? 'jugador' : 'ficha';
  const opciones: OpcionMenu[] =
    modo === 'narrador'
      ? [
          { id: 'vida', etiqueta: asiento.muerto ? `Revivir ${quien}` : `Matar ${quien}`, elegir: cambiarVida },
          { id: 'marca', etiqueta: asiento.marcado ? 'Desmarcar' : 'Marcar', elegir: cambiarMarca },
          onNominar
            ? { id: 'nominar', etiqueta: 'Nominar a…', elegir: onNominar }
            : { id: 'nominar', etiqueta: 'Nominar a…', deshabilitada: true, elegir: () => {} },
          cambiarFicha,
        ]
      : // En su grimorio, el jugador solo cambia las fichas (lo demás es de la partida).
        [cambiarFicha];

  const estado = [
    asiento.muerto && 'muerta',
    asiento.marcado && 'con la calavera',
    ocupante?.manoLevantada && `mano levantada (${nombreMano(ocupante.formaMano).toLocaleLowerCase('es')})`,
    voto === null && 'no vota',
    typeof voto === 'number' && `vota (${voto === 1 ? '1 voto' : `${voto} votos`})`,
  ].filter(Boolean);

  return (
    <MenuDesplegable
      id={`sala-ficha-${asiento.id}`}
      etiqueta={`Ficha del ${describirAsiento(numero, ocupante)}${estado.length ? `, ${estado.join(', ')}` : ''}`}
      boton={ficha}
      botonClassName="block cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      opciones={opciones}
    />
  );
};

export default FichaAsiento;
