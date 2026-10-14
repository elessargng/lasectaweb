import { useId, useState } from 'react';
import { urlDelServidor } from '../utils/api';
import DialogoPersonaje from './DialogoPersonaje';
import FichaRedonda from './FichaRedonda';
import { alineamientoDe, alineamientoDeTipo, iconoDe, useFichas, type ContenidoFicha } from './fichas';
import { nombreMano } from './formasMano';
import type { PersonajeMostrado } from './guiones';
import MenuDesplegable, { type OpcionMenu } from './MenuDesplegable';
import { idFichaNominar, idRevelarFicha } from './ids';
import { describirAsiento } from './nombresAsiento';
import type { SalaAlineamiento, SalaAsiento, SalaParticipante, SalaResultado } from './useSala';

interface FichaAsientoProps {
  asiento: SalaAsiento;
  /** Su número en la mesa (1 es el de las 12). */
  numero: number;
  /** Quien está sentado (o se ve sentado, si se le está moviendo), o null. */
  ocupante: SalaParticipante | null;
  /** Es el asiento de quien mira: su personaje se lo da el narrador (no se anota). */
  propia: boolean;
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
  /**
   * Revelando el grimorio: si ya se ha revelado (si no, está boca abajo) y, para
   * el narrador, cómo revelarla (pulsándola; al pasar el ratón la mira antes).
   */
  revelando?: { revelada: boolean; onRevelar?: () => void };
}

const NOMBRE_ALINEAMIENTO: Record<SalaAlineamiento, string> = { bueno: 'bueno', malvado: 'malvado' };

/**
 * La ficha de un asiento. Cada asiento tiene la suya, haya alguien sentado o no:
 * la muerte (sudario), la calavera y el personaje son de la ficha.
 *
 * El personaje (icono según su alineamiento y su nombre) lo ven el narrador, en
 * todas, y cada jugador en la suya; con grimorio, un jugador ve además lo que ha
 * anotado en las demás (solo en su navegador).
 *
 * Para el narrador es un botón (mano al pasar el ratón) con las opciones de la
 * partida: matar o revivir, marcar o desmarcar (la calavera), nominar a otra
 * ficha, cambiar su personaje y su alineamiento. Un jugador con grimorio puede
 * cambiar personaje y alineamiento en el suyo (salvo en su propia ficha, que es
 * la que le da el narrador). Mientras se elige a quién nomina, es un botón para
 * elegirla. Si no, solo se ve.
 *
 * Su nombre dice de qué asiento es y quién se sienta; su estado (personaje,
 * muerta, calavera, mano, voto) va en la descripción, que se oye al llegar a
 * ella pero no se anuncia al cambiar.
 */
const FichaAsiento = ({
  asiento,
  numero,
  ocupante,
  propia,
  modo,
  pedir,
  onError,
  onNominar,
  eligiendo,
  voto,
  revelando,
}: FichaAsientoProps) => {
  const { hayGuion, personajes, porId, notas, anotar } = useFichas();
  const [eligiendoPersonaje, setEligiendoPersonaje] = useState(false);

  // Lo que lleva: lo de la partida si se ve (narrador, o la propia); si no, lo anotado en el grimorio propio.
  // Sin guion no hay personajes que anotar.
  const anotando = modo === 'grimorio' && hayGuion && !(propia && asiento.personaje);
  const contenido: ContenidoFicha =
    asiento.personaje || !anotando
      ? { personaje: asiento.personaje, alineamiento: asiento.alineamiento }
      : (notas[asiento.id] ?? { personaje: null, alineamiento: null });
  const personaje = contenido.personaje ? porId.get(contenido.personaje) : undefined;

  const bocaAbajo = !!revelando && !revelando.revelada;
  const ficha = (
    <FichaRedonda
      muerto={asiento.muerto}
      marcado={asiento.marcado}
      voto={voto}
      bocaAbajo={bocaAbajo}
      asomar={!!revelando?.onRevelar}
    >
      {personaje && <PersonajeEnFicha personaje={personaje} alineamiento={contenido.alineamiento} />}
    </FichaRedonda>
  );

  // Revelando el grimorio: boca abajo, el narrador la revela pulsándola (al pasar el
  // ratón o con el foco la mira; el lector oye su personaje en el nombre del botón).
  // Mientras tanto, nada más: ni menú ni opciones.
  if (revelando) {
    if (!bocaAbajo || !revelando.onRevelar) return ficha;
    return (
      <button
        id={idRevelarFicha(asiento.id)}
        type="button"
        onClick={revelando.onRevelar}
        aria-label={`Revelar la ficha del ${describirAsiento(numero, ocupante)}${personaje ? `: ${personaje.nombre.texto}` : ', sin personaje'}`}
        className="group block cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {ficha}
      </button>
    );
  }

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

  const editable = modo === 'narrador' || anotando;
  if (!editable) return ficha;

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

  // El narrador cambia la partida; un jugador, su grimorio.
  const ponerPersonaje = async (personajeId: string | null) => {
    if (modo !== 'narrador') {
      anotar(asiento.id, { personaje: personajeId, alineamiento: null });
      return;
    }
    const r = await pedir('narrador:cambiarPersonaje', { asientoId: asiento.id, personajeId });
    if (!r.ok) onError(r.error);
  };
  const ponerAlineamiento = async (alineamiento: SalaAlineamiento) => {
    if (modo !== 'narrador') {
      anotar(asiento.id, { personaje: contenido.personaje, alineamiento });
      return false;
    }
    const r = await pedir('narrador:cambiarAlineamiento', { asientoId: asiento.id, alineamiento });
    if (!r.ok) onError(r.error);
    // false: el menú se cierra y el foco vuelve a la ficha, que ya dice su alineamiento.
    return false;
  };

  // Cambiar alineamiento: al contrario del que tiene; un viajero sin decidir, a cualquiera de los dos.
  const actual = personaje ? alineamientoDe(personaje, contenido.alineamiento) : null;
  const destinos: SalaAlineamiento[] = !personaje ? ['malvado'] : actual === null ? ['bueno', 'malvado'] : [actual === 'bueno' ? 'malvado' : 'bueno'];
  // Sin guion no salen ni «Cambiar ficha» ni el alineamiento: no hay personajes que poner.
  const opcionesAlineamiento: OpcionMenu[] = !hayGuion ? [] : destinos.map((a) => ({
    id: `alineamiento-${a}`,
    etiqueta: `Cambiar alineamiento a ${NOMBRE_ALINEAMIENTO[a]}`,
    deshabilitada: !personaje,
    elegir: () => ponerAlineamiento(a),
  }));

  const cambiarFicha: OpcionMenu = {
    id: 'cambiar',
    etiqueta: 'Cambiar ficha',
    abreDialogo: true,
    elegir: () => setEligiendoPersonaje(true),
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
          ...(hayGuion ? [cambiarFicha] : []),
          ...opcionesAlineamiento,
        ]
      : // En su grimorio, el jugador solo cambia los personajes (lo demás es de la partida).
        [cambiarFicha, ...opcionesAlineamiento];

  // El alineamiento se dice si no es el de su tipo (o si es un viajero y ya lo tiene)
  const alineamientoDistinto = personaje && contenido.alineamiento && contenido.alineamiento !== alineamientoDeTipo(personaje.tipo);
  const estado = [
    personaje && `${personaje.nombre.texto}${alineamientoDistinto ? `, ${NOMBRE_ALINEAMIENTO[contenido.alineamiento!]}` : ''}`,
    asiento.muerto && 'muerta',
    asiento.marcado && 'con la calavera',
    ocupante?.manoLevantada && `mano levantada (${nombreMano(ocupante.formaMano).toLocaleLowerCase('es')})`,
    voto === null && 'no vota',
    typeof voto === 'number' && `vota (${voto === 1 ? '1 voto' : `${voto} votos`})`,
  ].filter(Boolean);

  const nombreFicha = `Ficha del ${describirAsiento(numero, ocupante)}`;
  return (
    <>
      <MenuDesplegable
        id={`sala-ficha-${asiento.id}`}
        // Nombre fijo y el estado en la descripción: así, con el foco en la ficha, no se
        // anuncia cada cambio (la mano que baja al votar, los votos…)
        etiqueta={nombreFicha}
        descripcion={estado.length ? estado.join(', ') : undefined}
        boton={ficha}
        botonClassName="relative block cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        opciones={opciones}
      />
      {eligiendoPersonaje && (
        <DialogoPersonaje
          ficha={nombreFicha.replace(/^Ficha del /, '')}
          personajes={personajes}
          actual={contenido.personaje}
          onElegir={(id) => void ponerPersonaje(id)}
          onCerrar={() => setEligiendoPersonaje(false)}
        />
      )}
    </>
  );
};

/**
 * El nombre va en mayúsculas siguiendo el borde de abajo de la ficha (un arco
 * dentro del aro), como en las fichas impresas. Medidas sobre una ficha de 100
 * de lado: el arco tiene unas 100 unidades útiles y cada mayúscula ocupa
 * unas 0,72 veces su tamaño, así que los nombres largos encogen para caber.
 */
const RADIO_NOMBRE = 44;
const TAMANO_NOMBRE = 14;
const tamanoNombre = (nombre: string) => Math.min(TAMANO_NOMBRE, 100 / (nombre.length * 0.72));

/**
 * El personaje dentro de la ficha: su icono (el bueno o el malvado, según su
 * alineamiento) y su nombre curvado abajo. Solo visual: la ficha lo dice en su descripción.
 */
const PersonajeEnFicha = ({
  personaje,
  alineamiento,
}: {
  personaje: PersonajeMostrado;
  alineamiento: SalaAlineamiento | null;
}) => {
  const icono = iconoDe(personaje, alineamiento);
  // Cada ficha, su arco (los id del SVG son de toda la página)
  const idArco = `arco-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const nombre = personaje.nombre.texto.toLocaleUpperCase(personaje.nombre.lang);
  return (
    <span aria-hidden="true" className="relative flex h-full w-full items-center justify-center">
      {icono && <img src={urlDelServidor(icono)} alt="" className="h-[83%] w-[83%] -translate-y-[7%] object-contain" />}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
        {/* De izquierda a derecha por abajo: el texto queda derecho, mirando al centro */}
        <path id={idArco} d={`M ${50 - RADIO_NOMBRE} 50 A ${RADIO_NOMBRE} ${RADIO_NOMBRE} 0 0 0 ${50 + RADIO_NOMBRE} 50`} fill="none" />
        <text
          lang={personaje.nombre.lang}
          fontFamily="Georgia, serif"
          fontWeight="bold"
          fontSize={tamanoNombre(nombre)}
          letterSpacing="0.5"
          fill="#2b211a"
          style={{ paintOrder: 'stroke' }}
          stroke="rgba(243, 230, 208, 0.7)"
          strokeWidth="1.5"
        >
          <textPath href={`#${idArco}`} startOffset="50%" textAnchor="middle">
            {nombre}
          </textPath>
        </text>
      </svg>
    </span>
  );
};

export default FichaAsiento;
