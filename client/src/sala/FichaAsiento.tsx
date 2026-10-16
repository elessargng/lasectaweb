import { useState } from 'react';
import DialogoPersonaje from './DialogoPersonaje';
import DialogoRecordatorio from './DialogoRecordatorio';
import FichaRedonda from './FichaRedonda';
import PersonajeEnFicha from './PersonajeEnFicha';
import {
  alineamientoDe,
  alineamientoDeTipo,
  alineamientoReal,
  describirRecordatorio,
  identidadDe,
  recordatoriosDeFicha,
  useFichas,
  type ContenidoFicha,
} from './fichas';
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
  /** Hay una nominación abierta: la ficha se gira y enseña la esfera del reloj. */
  reloj?: boolean;
  /** El narrador puede despertar al jugador de esta ficha (de noche) o abrir su despertar si ya lo tiene. */
  despertar?: { abierto: boolean; onAbrir: () => void };
  /**
   * Visitantes y narradores: seguir al jugador de esta ficha (ir con él a las
   * conversaciones privadas, como oyente). Con el menú de la ficha, una opción
   * más; si no hay menú (visitantes), la ficha es un botón que lo activa y lo quita.
   */
  seguir?: { siguiendo: boolean; onAlternar: () => void };
  /** Los personajes en juego (en alguna ficha, para quien mira): sus recordatorios salen primero al poner uno. */
  enJuego: Set<string>;
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
  reloj = false,
  despertar,
  seguir,
  enJuego,
}: FichaAsientoProps) => {
  const { hayGuion, personajes, viajeros, porId, notas, anotar, todos, todosPorId, notasRecordatorios, anotarRecordatorios } = useFichas();
  const [eligiendoPersonaje, setEligiendoPersonaje] = useState(false);
  const [eligiendoRecordatorio, setEligiendoRecordatorio] = useState(false);
  const recordatorios = recordatoriosDeFicha(asiento, modo === 'grimorio' ? notasRecordatorios : null);

  // Lo que lleva: lo de la partida si se ve (narrador, o la propia); si no, lo anotado en el grimorio propio.
  // Sin guion no hay personajes que anotar.
  const anotando = modo === 'grimorio' && hayGuion && !(propia && asiento.personaje);
  // El alineamiento, el de quien es de verdad (su «Is The …»): un Alquimista con la
  // ficha de un esbirro sale bueno
  const contenido: ContenidoFicha =
    asiento.personaje || !anotando
      ? { personaje: asiento.personaje, alineamiento: alineamientoReal(asiento, todosPorId) }
      : (notas[asiento.id] ?? { personaje: null, alineamiento: null });
  const identidad = identidadDe(asiento);
  // Al revelar el grimorio se ve quién es de verdad (el Filósofo, no el Alcalde que hacía)
  const personaje =
    revelando && identidad.porRecordatorio && identidad.personaje
      ? todosPorId.get(identidad.personaje)
      : contenido.personaje
        ? porId.get(contenido.personaje)
        : undefined;

  const bocaAbajo = !!revelando && !revelando.revelada;
  const ficha = (
    <span className="relative block">
      <FichaRedonda
        muerto={asiento.muerto}
        marcado={asiento.marcado}
        voto={voto}
        bocaAbajo={bocaAbajo}
        reloj={reloj}
        asomar={!!revelando?.onRevelar}
      >
        {personaje && <PersonajeEnFicha personaje={personaje} alineamiento={contenido.alineamiento} />}
      </FichaRedonda>
    </span>
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
          origen ? 'ring-4 ring-white/80' : 'ring-2 ring-blood-bright'
        }`}
      >
        {ficha}
      </button>
    );
  }

  const nombreJugador = ocupante?.nombre ?? '';
  // El alineamiento se dice si no es el de su tipo (o si es un viajero y ya lo tiene)
  const alineamientoDistinto = personaje && contenido.alineamiento && contenido.alineamiento !== alineamientoDeTipo(personaje.tipo);
  const estado = [
    personaje && `${personaje.nombre.texto}${alineamientoDistinto ? `, ${NOMBRE_ALINEAMIENTO[contenido.alineamiento!]}` : ''}`,
    asiento.muerto && 'muerta',
    asiento.marcado && 'con la calavera',
    ocupante?.manoLevantada && `mano levantada (${nombreMano(ocupante.formaMano).toLocaleLowerCase('es')})`,
    voto === null && 'no vota',
    typeof voto === 'number' && `vota (${voto === 1 ? '1 voto' : `${voto} votos`})`,
    recordatorios.length > 0 &&
      `recordatorios: ${recordatorios.map((r) => describirRecordatorio(r, todosPorId.get(r.personaje))).join(', ')}`,
    seguir?.siguiendo && 'siguiendo',
  ].filter(Boolean);
  // En el botón de seguir (visitantes) no hace falta: lo dice aria-pressed
  const estadoSinSeguir = estado.filter((e) => e !== 'siguiendo');

  const editable = modo === 'narrador' || anotando;
  if (!editable) {
    if (!seguir) return ficha;
    // Sin menú (visitantes): la ficha activa y quita el seguimiento.
    const idEstado = `sala-ficha-estado-${asiento.id}`;
    return (
      <button
        type="button"
        onClick={seguir.onAlternar}
        aria-pressed={seguir.siguiendo}
        aria-label={`Seguir a ${nombreJugador}`}
        aria-describedby={estadoSinSeguir.length ? idEstado : undefined}
        className="relative block cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {ficha}
        {estadoSinSeguir.length > 0 && (
          <span id={idEstado} className="sr-only">
            {estadoSinSeguir.join(', ')}
          </span>
        )}
      </button>
    );
  }

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
  // Recordatorios: el narrador los pone en la partida; un jugador, en su grimorio.
  const ponerRecordatorio = async (p: PersonajeMostrado, indice: number) => {
    if (modo !== 'narrador') {
      const nuevo = { id: crypto.randomUUID(), personaje: p.id, indice, texto: p.recordatorios[indice]?.texto ?? '' };
      anotarRecordatorios(asiento.id, [...(notasRecordatorios[asiento.id] ?? []), nuevo]);
      return;
    }
    const r = await pedir('narrador:ponerRecordatorio', { asientoId: asiento.id, personajeId: p.id, indice });
    if (!r.ok) onError(r.error);
  };
  const opcionRecordatorio: OpcionMenu = {
    id: 'recordatorio',
    etiqueta: 'Poner recordatorio',
    abreDialogo: true,
    elegir: () => setEligiendoRecordatorio(true),
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
          ...(hayGuion ? [opcionRecordatorio] : []),
          ...(despertar
            ? [
                {
                  id: 'despertar',
                  etiqueta: despertar.abierto ? 'Abrir despertar' : 'Despertar',
                  // Como un diálogo: el menú se cierra y el foco pasa a la ventana del despertar
                  abreDialogo: true,
                  elegir: despertar.onAbrir,
                },
              ]
            : []),
        ]
      : // En su grimorio, el jugador solo cambia los personajes (lo demás es de la partida).
        [cambiarFicha, ...opcionesAlineamiento, opcionRecordatorio];
  if (seguir) {
    opciones.push({
      id: 'seguir',
      etiqueta: seguir.siguiendo ? `Dejar de seguir a ${nombreJugador}` : `Seguir a ${nombreJugador}`,
      elegir: async () => {
        seguir.onAlternar();
        // false: el menú se cierra y el foco vuelve a la ficha, que dice si se le sigue.
        return false;
      },
    });
  }

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
      {eligiendoRecordatorio && (
        <DialogoRecordatorio
          ficha={nombreFicha.replace(/^Ficha del /, '')}
          enJuego={todos.filter((p) => enJuego.has(p.id))}
          otros={todos.filter((p) => !enJuego.has(p.id))}
          onElegir={(p, i) => void ponerRecordatorio(p, i)}
          onCerrar={() => setEligiendoRecordatorio(false)}
        />
      )}
      {eligiendoPersonaje && (
        <DialogoPersonaje
          ficha={nombreFicha.replace(/^Ficha del /, '')}
          personajes={personajes}
          viajeros={viajeros}
          actual={contenido.personaje}
          onElegir={(id) => void ponerPersonaje(id)}
          onCerrar={() => setEligiendoPersonaje(false)}
        />
      )}
    </>
  );
};

export default FichaAsiento;
