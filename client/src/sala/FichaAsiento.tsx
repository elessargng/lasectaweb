import { useEffect, useRef, useState } from 'react';
import DialogoPersonaje from './DialogoPersonaje';
import DialogoRecordatorio from './DialogoRecordatorio';
import FichaRedonda from './FichaRedonda';
import PersonajeEnFicha from './PersonajeEnFicha';
import PistaPersonaje from './PistaPersonaje';
import {
  alineamientoDe,
  alineamientoDeTipo,
  alineamientoReal,
  describirRecordatorio,
  identidadDe,
  RECORDATORIO_TEXTO,
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
  /** Es de noche: matar deja la muerte pendiente y antes se elige quién mata (un recordatorio). */
  deNoche?: boolean;
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
  /** De qué lado de la ficha va la vela del muerto (el del jugador en la mesa). */
  ladoVela?: 'izquierda' | 'derecha';
  /** Los de `enJuego` que solo lo están probablemente (el Borracho si no cuadran los forasteros…). */
  probables?: Set<string>;
  /** Abre las notas del asiento con una nueva («Escribir nota»); sin esto, no sale. */
  onEscribirNota?: () => void;
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
 * cambiar personaje y alineamiento en el suyo, también en su propia ficha (lo
 * anotado tapa lo que le dio el narrador, solo para él). Mientras se elige a quién nomina, es un botón para
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
  modo,
  pedir,
  onError,
  onNominar,
  eligiendo,
  voto,
  revelando,
  deNoche = false,
  reloj = false,
  despertar,
  seguir,
  enJuego,
  ladoVela,
  probables,
  onEscribirNota,
}: FichaAsientoProps) => {
  const { hayGuion, personajes, viajeros, porId, notas, anotar, todos, todosPorId, notasRecordatorios, anotarRecordatorios } = useFichas();
  const [eligiendoPersonaje, setEligiendoPersonaje] = useState(false);
  const [eligiendoRecordatorio, setEligiendoRecordatorio] = useState(false);
  // Matando de noche: se elige el recordatorio de quien lo mata (o ninguno)
  const [matando, setMatando] = useState(false);
  const recordatorios = recordatoriosDeFicha(asiento, modo === 'grimorio' ? notasRecordatorios : null);

  // Lo que lleva: con grimorio propio, lo anotado en él (en cualquier ficha, también la
  // suya); si no hay nada anotado, o sin grimorio, lo de la partida que se ve (narrador,
  // la propia, los viajeros). Sin guion no hay personajes que anotar.
  const anotando = modo === 'grimorio' && hayGuion;
  const anotado = anotando ? notas[asiento.id] : undefined;
  // El alineamiento, el de quien es de verdad (su «Is The …»): un Alquimista con la
  // ficha de un esbirro sale bueno
  const contenido: ContenidoFicha = anotado ?? { personaje: asiento.personaje, alineamiento: alineamientoReal(asiento, todosPorId) };
  const identidad = identidadDe(asiento);
  // Al revelar el grimorio se ve quién es de verdad (el Filósofo, no el Alcalde que hacía)
  const personaje =
    revelando && identidad.porRecordatorio && identidad.personaje
      ? todosPorId.get(identidad.personaje)
      : contenido.personaje
        ? porId.get(contenido.personaje)
        : undefined;

  const bocaAbajo = !!revelando && !revelando.revelada;
  // Resaltada (ratón encima, foco con el teclado o un toque): el nombre en blanco y la
  // pista del personaje. Solo si se ve el personaje (no boca abajo ni en el reloj).
  const fichaRef = useRef<HTMLSpanElement>(null);
  const [resaltada, setResaltada] = useState(false);
  const conPista = !!personaje && !bocaAbajo && !reloj;
  useEffect(() => {
    const el = fichaRef.current;
    if (!el || !conPista) {
      setResaltada(false);
      return;
    }
    // Lo que recibe el ratón y el foco: el botón que la contiene, si lo hay
    const ancla = el.closest('button') ?? el;
    let temporizador: number | undefined;
    const encender = (e: PointerEvent) => e.pointerType === 'mouse' && setResaltada(true);
    const apagar = (e: PointerEvent) => e.pointerType === 'mouse' && setResaltada(false);
    const conFoco = () => ancla.matches(':focus-visible') && setResaltada(true);
    const sinFoco = () => setResaltada(false);
    // En pantallas táctiles: al tocarla, unos segundos (o hasta tocar en otro sitio)
    const tocar = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      setResaltada(true);
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => setResaltada(false), 4000);
    };
    const fuera = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && !ancla.contains(e.target as Node)) setResaltada(false);
    };
    ancla.addEventListener('pointerenter', encender);
    ancla.addEventListener('pointerleave', apagar);
    ancla.addEventListener('focus', conFoco);
    ancla.addEventListener('blur', sinFoco);
    ancla.addEventListener('pointerup', tocar);
    document.addEventListener('pointerdown', fuera, true);
    return () => {
      window.clearTimeout(temporizador);
      ancla.removeEventListener('pointerenter', encender);
      ancla.removeEventListener('pointerleave', apagar);
      ancla.removeEventListener('focus', conFoco);
      ancla.removeEventListener('blur', sinFoco);
      ancla.removeEventListener('pointerup', tocar);
      document.removeEventListener('pointerdown', fuera, true);
    };
    // El botón que la contiene cambia con lo que se hace con ella (menú, nominar, revelar)
  }, [conPista, modo, !!eligiendo, !!revelando, !!seguir]);
  const ficha = (
    <span ref={fichaRef} data-resaltada={(resaltada && conPista) || undefined} className="relative block">
      <FichaRedonda
        ladoVela={ladoVela}
        muerto={asiento.muerto}
        muertePendiente={asiento.muertePendiente}
        votoGastado={asiento.votoGastado}
        marcado={asiento.marcado}
        voto={voto}
        bocaAbajo={bocaAbajo}
        reloj={reloj}
        asomar={!!revelando?.onRevelar}
      >
        {personaje && <PersonajeEnFicha personaje={personaje} alineamiento={contenido.alineamiento} />}
      </FichaRedonda>
      {resaltada && conPista && fichaRef.current && (
        <PistaPersonaje personaje={personaje!} alineamiento={contenido.alineamiento} ancla={fichaRef.current} />
      )}
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
    asiento.muerto && (asiento.votoGastado ? 'muerta, sin voto' : 'muerta, con voto'),
    asiento.muertePendiente && 'muerta esta noche, sin anunciar',
    asiento.marcado && 'con la calavera',
    ocupante?.manoLevantada &&
      (ocupante.dosManos ? 'las dos manos levantadas' : `mano levantada (${nombreMano(ocupante.formaMano).toLocaleLowerCase('es')})`),
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

  // Revivir quita también una muerte pendiente
  const vivo = !asiento.muerto && !asiento.muertePendiente;
  const cambiarVida = async () => {
    const r = await pedir('narrador:cambiarVida', { asientoId: asiento.id, muerto: vivo });
    if (!r.ok) onError(r.error);
    // false: el menú se cierra y el foco vuelve a la ficha, que ya dice su estado.
    return false;
  };
  // De noche: primero el recordatorio de quien lo mata; la muerte queda pendiente
  const matarDeNoche = async (recordatorio: { personaje: PersonajeMostrado; indice: number } | null) => {
    if (recordatorio) {
      const r = await pedir('narrador:ponerRecordatorio', { asientoId: asiento.id, personajeId: recordatorio.personaje.id, indice: recordatorio.indice });
      if (!r.ok) {
        onError(r.error);
        return;
      }
    }
    const r = await pedir('narrador:cambiarVida', { asientoId: asiento.id, muerto: true });
    if (!r.ok) onError(r.error);
  };
  const confirmarMuerte = async () => {
    const r = await pedir('narrador:confirmarMuerte', { asientoId: asiento.id });
    if (!r.ok) onError(r.error);
    return false;
  };

  // El voto que le queda a un muerto: el narrador se lo quita o se lo devuelve a mano.
  const cambiarVoto = async () => {
    const r = await pedir('narrador:cambiarVoto', { asientoId: asiento.id, gastado: !asiento.votoGastado });
    if (!r.ok) onError(r.error);
    // false: el menú se cierra y el foco vuelve a la ficha, que ya dice si le queda el voto.
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
  // Con texto propio: igual, pero sin personaje (va en redondo en la ficha)
  const ponerRecordatorioTexto = async (texto: string) => {
    if (modo !== 'narrador') {
      const nuevo = { id: crypto.randomUUID(), personaje: RECORDATORIO_TEXTO, indice: -1, texto };
      anotarRecordatorios(asiento.id, [...(notasRecordatorios[asiento.id] ?? []), nuevo]);
      return;
    }
    const r = await pedir('narrador:ponerRecordatorioTexto', { asientoId: asiento.id, texto });
    if (!r.ok) onError(r.error);
  };
  const opcionRecordatorio: OpcionMenu = {
    id: 'recordatorio',
    etiqueta: 'Poner recordatorio',
    abreDialogo: true,
    elegir: () => setEligiendoRecordatorio(true),
  };
  // Las notas: el panel va junto al cuadro del asiento (lo abre la mesa)
  const opcionNota: OpcionMenu[] = onEscribirNota
    ? [{ id: 'nota', etiqueta: 'Escribir nota', abreDialogo: true, elegir: onEscribirNota }]
    : [];
  const quien = ocupante ? 'jugador' : 'ficha';
  const opciones: OpcionMenu[] =
    modo === 'narrador'
      ? [
          vivo && deNoche
            ? { id: 'vida', etiqueta: `Matar ${quien}`, abreDialogo: true, elegir: () => setMatando(true) }
            : { id: 'vida', etiqueta: vivo ? `Matar ${quien}` : `Revivir ${quien}`, elegir: cambiarVida },
          ...(asiento.muertePendiente ? [{ id: 'anunciar', etiqueta: 'Anunciar su muerte', elegir: confirmarMuerte }] : []),
          ...(asiento.muerto
            ? [{ id: 'voto', etiqueta: asiento.votoGastado ? 'Devolver voto' : 'Quitar voto', elegir: cambiarVoto }]
            : []),
          { id: 'marca', etiqueta: asiento.marcado ? 'Desmarcar' : 'Marcar', elegir: cambiarMarca },
          onNominar
            ? { id: 'nominar', etiqueta: 'Nominar a…', elegir: onNominar }
            : { id: 'nominar', etiqueta: 'Nominar a…', deshabilitada: true, elegir: () => {} },
          ...(hayGuion ? [cambiarFicha] : []),
          ...opcionesAlineamiento,
          // Sin guion, el recordatorio solo puede ser de texto propio
          opcionRecordatorio,
          ...opcionNota,
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
        [cambiarFicha, ...opcionesAlineamiento, opcionRecordatorio, ...opcionNota];
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
          probables={probables}
          otros={todos.filter((p) => !enJuego.has(p.id))}
          onElegir={(p, i) => void ponerRecordatorio(p, i)}
          onTexto={(texto) => void ponerRecordatorioTexto(texto)}
          onCerrar={() => setEligiendoRecordatorio(false)}
        />
      )}
      {matando && (
        <DialogoRecordatorio
          ficha={nombreFicha.replace(/^Ficha del /, '')}
          titulo="Matar de noche"
          explicacion="Elige el recordatorio de quien lo mata. Su muerte no se verá hasta que la anuncies de día, pulsando su sudario."
          enJuego={todos.filter((p) => enJuego.has(p.id))}
          probables={probables}
          otros={todos.filter((p) => !enJuego.has(p.id))}
          onElegir={(p, i) => void matarDeNoche({ personaje: p, indice: i })}
          sinRecordatorio={{ etiqueta: 'Matar sin recordatorio', onElegir: () => void matarDeNoche(null) }}
          onCerrar={() => setMatando(false)}
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
