import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import DialogoPersonaje from './DialogoPersonaje';
import DialogoRecordatorio from './DialogoRecordatorio';
import FichaRedonda from './FichaRedonda';
import { IconoMascaras } from './IconosJuego';
import PersonajeEnFicha from './PersonajeEnFicha';
import PistaPersonaje from './PistaPersonaje';
import {
  alineamientoDe,
  alineamientoDeTipo,
  alineamientoReal,
  describirRecordatorio,
  identidadDe,
  mataDeNoche,
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
  /** Ya ha nominado hoy: «Nominar a…» lo avisa (pero deja). */
  yaNomino?: boolean;
  /**
   * Con narrador virtual, lo que puede hacer un jugador con esta ficha («Nominar»,
   * «Exterminar jugador»), detrás de lo de su grimorio.
   */
  opcionesJugador?: OpcionMenu[];
  /** Con narrador virtual, de día: su jugador está listo para pasar a la noche (se ve y se dice). */
  listo?: boolean;
  /**
   * Se está eligiendo a quién nomina una ficha: esta es un botón para elegirla
   * (también la que nomina, que se nominaría a sí misma; se distingue con un aro blanco).
   * También al elegir a alguien en la plaza para el despertar: `accion` es el verbo
   * del botón («Elegir»; si no, «Nominar»). `yaNominado`: ya la nominaron hoy (sale
   * apagada y con un rótulo, pero se puede elegir igual).
   */
  eligiendo?: { papel: 'origen' | 'candidata' | 'elegida'; onPulsar: () => void; accion?: string; yaNominado?: boolean };
  /** En una votación: votos acumulados si votó, null si no; sin definir si aún no le ha tocado. */
  voto?: number | null;
  /**
   * Revelando el grimorio: si ya se ha revelado (si no, está boca abajo) y, para
   * el narrador, cómo revelarla (pulsándola; al pasar el ratón la mira antes).
   */
  revelando?: { revelada: boolean; onRevelar?: () => void };
  /** Al revelarse (no si ya lo estaba): suelta el humo de su bando sobre la ficha. */
  onHumo?: (ancla: HTMLElement, alineamiento: SalaAlineamiento) => void;
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
  /** Los de `enJuego` que solo lo están probablemente (el Borracho si no cuadran los forasteros…). */
  probables?: Set<string>;
  /** Abre la nota del asiento para escribirla («Escribir nota», o «Editar nota» si ya la tiene); sin esto, no sale. */
  onEscribirNota?: () => void;
  /** El asiento ya tiene nota (para quien mira). */
  conNota?: boolean;
  /** Con el Gardener (narradores): elegir otra ficha con la que intercambiar el personaje; sin esto, no sale. */
  onIntercambiar?: () => void;
  /** En un señalamiento: a quién señala y quién la señala («señala a…, señalada por…»), o null. */
  senal?: string | null;
  /**
   * Narradores, cuando se puede (de noche, Lil' Monsta en el guion, sin demonio y con un
   * esbirro de más): despertar a los esbirros para que elijan quién lo cuida. Sale en
   * las fichas de esbirro; sin esto, no sale.
   */
  onLilmonsta?: () => void;
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
  yaNomino = false,
  opcionesJugador = [],
  listo = false,
  eligiendo,
  voto,
  revelando,
  onHumo,
  deNoche = false,
  reloj = false,
  despertar,
  seguir,
  enJuego,
  probables,
  onEscribirNota,
  conNota,
  onIntercambiar,
  senal = null,
  onLilmonsta,
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

  // Al revelarse, el humo de su bando (azul o rojo); no las que ya estaban reveladas al
  // llegar, ni las que no tienen personaje
  const revelada = !!revelando?.revelada;
  const reveladaAntes = useRef(revelada);
  useEffect(() => {
    if (revelada && !reveladaAntes.current && onHumo && fichaRef.current && personaje) {
      const bando = alineamientoDe(personaje, contenido.alineamiento);
      if (bando) onHumo(fichaRef.current, bando);
    }
    reveladaAntes.current = revelada;
    // Solo al cambiar: lo demás se lee tal como está en ese momento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revelada]);
  const ficha = (
    <span ref={fichaRef} data-resaltada={(resaltada && conPista) || undefined} className="relative block">
      <FichaRedonda
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
    // Ya elegida en el despertar (eligiendo varias en la plaza): marcada en latón, con su rótulo
    const elegida = eligiendo.papel === 'elegida';
    const yaNominado = !!eligiendo.yaNominado;
    return (
      <button
        id={idFichaNominar(asiento.id)}
        type="button"
        onClick={eligiendo.onPulsar}
        aria-label={`${eligiendo.accion ?? 'Nominar'} al ${describirAsiento(numero, ocupante)}${origen ? ', que es el que nomina' : ''}${
          yaNominado ? ', ya nominado hoy' : ''
        }${elegida ? ', elegido' : ''}`}
        title={yaNominado ? 'Ya nominado hoy' : undefined}
        className={`relative block cursor-pointer rounded-full ring-offset-2 ring-offset-background focus:outline-none focus-visible:ring-4 focus-visible:ring-white ${
          origen ? 'ring-4 ring-white/80' : elegida ? 'ring-4 ring-theme-main' : yaNominado ? 'ring-2 ring-white/20' : 'ring-2 ring-blood-bright'
        }`}
      >
        {/* Ya nominada hoy: apagada (se aviva al pasar por encima) y con su rótulo */}
        <span className={yaNominado ? 'block opacity-40 grayscale transition-opacity hover:opacity-100' : 'contents'}>{ficha}</span>
        {yaNominado && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-outline-ghost bg-surface-container px-1.5 text-[10px] leading-4 text-on-surface-muted"
          >
            Ya nominado
          </span>
        )}
        {elegida && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded border border-theme-main bg-surface-container px-1.5 font-ui text-[10px] font-semibold leading-4 text-theme-main"
          >
            <Check size={10} strokeWidth={3} />
            Elegido
          </span>
        )}
      </button>
    );
  }

  const nombreJugador = ocupante?.nombre ?? '';
  // El alineamiento se dice si no es el de su tipo (o si es un viajero y ya lo tiene)
  const alineamientoDistinto = personaje && contenido.alineamiento && contenido.alineamiento !== alineamientoDeTipo(personaje.tipo);
  // El farol que dice usar (lo ven quien se sienta ahí y el narrador)
  const farolEnUso = asiento.farolEnUso ? todosPorId.get(asiento.farolEnUso) : undefined;
  const estado = [
    personaje && `${personaje.nombre.texto}${alineamientoDistinto ? `, ${NOMBRE_ALINEAMIENTO[contenido.alineamiento!]}` : ''}`,
    asiento.muerto && (asiento.votoGastado ? 'muerta, sin voto' : 'muerta, con voto'),
    asiento.muertePendiente && 'muerta esta noche, sin anunciar',
    asiento.marcado && 'con la calavera',
    ocupante?.manoLevantada &&
      (ocupante.dosManos ? 'las dos manos levantadas' : `mano levantada (${nombreMano(ocupante.formaMano, todosPorId).toLocaleLowerCase('es')})`),
    voto === null && 'no vota',
    typeof voto === 'number' && `vota (${voto === 1 ? '1 voto' : `${voto} votos`})`,
    recordatorios.length > 0 &&
      `recordatorios: ${recordatorios.map((r) => describirRecordatorio(r, todosPorId.get(r.personaje))).join(', ')}`,
    senal,
    listo && 'lista para la noche',
    farolEnUso && `se hace pasar por ${farolEnUso.nombre.texto}`,
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
  // Ejecutar al que lleva la calavera: muere, se le ponen los recordatorios de las
  // ejecuciones (el Caníbal, el Enterrador…) y anochece, salvo con el Carnicero vivo o si
  // quedan dos vivos (entonces el narrador elige: noche o revelar el grimorio, ver SalaJuego)
  const ejecutar = async () => {
    const r = await pedir('narrador:ejecutar', { asientoId: asiento.id });
    if (!r.ok) onError(r.error);
    // false: el menú se cierra y el foco vuelve a la ficha, que ya dice que ha muerto.
    return false;
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
      const texto = p.recordatorios[indice]?.texto ?? '';
      // Únicos, como en la partida: si ya están todos los iguales, se quita uno (antes de otra ficha)
      const iguales = new Set(p.recordatorios.flatMap((r, i) => (r.texto === texto ? [i] : [])));
      const puestos = Object.entries(notasRecordatorios).flatMap(([a, lista]) =>
        lista.filter((r) => r.personaje === p.id && iguales.has(r.indice)).map((r) => ({ asientoId: a, id: r.id })),
      );
      const sobra = puestos.length >= iguales.size ? (puestos.find((x) => x.asientoId !== asiento.id) ?? puestos[0]) : undefined;
      const sin = (a: string) => (notasRecordatorios[a] ?? []).filter((r) => r.id !== sobra?.id);
      if (sobra && sobra.asientoId !== asiento.id) anotarRecordatorios(sobra.asientoId, sin(sobra.asientoId));
      anotarRecordatorios(asiento.id, [...sin(asiento.id), { id: crypto.randomUUID(), personaje: p.id, indice, texto }]);
      return;
    }
    const r = await pedir('narrador:ponerRecordatorio', { asientoId: asiento.id, personajeId: p.id, indice });
    if (!r.ok) onError(r.error);
  };
  // Con texto propio: igual, pero sin personaje (va en redondo en la ficha)
  const ponerRecordatorioTexto = async (texto: string, icono: string) => {
    if (modo !== 'narrador') {
      const nuevo = { id: crypto.randomUUID(), personaje: RECORDATORIO_TEXTO, indice: -1, texto, icono };
      anotarRecordatorios(asiento.id, [...(notasRecordatorios[asiento.id] ?? []), nuevo]);
      return;
    }
    const r = await pedir('narrador:ponerRecordatorioTexto', { asientoId: asiento.id, texto, icono });
    if (!r.ok) onError(r.error);
  };
  const opcionRecordatorio: OpcionMenu = {
    id: 'recordatorio',
    etiqueta: 'Poner recordatorio',
    abreDialogo: true,
    elegir: () => setEligiendoRecordatorio(true),
  };
  // La nota: un pósit junto al cuadro del asiento (lo abre la mesa)
  const opcionNota: OpcionMenu[] = onEscribirNota
    ? [{ id: 'nota', etiqueta: conNota ? 'Editar nota' : 'Escribir nota', abreDialogo: true, elegir: onEscribirNota }]
    : [];
  const quien = ocupante ? 'jugador' : 'ficha';
  const opciones: OpcionMenu[] =
    modo === 'narrador'
      ? [
          ...(asiento.marcado ? [{ id: 'ejecutar', etiqueta: `Ejecutar ${quien}`, elegir: ejecutar }] : []),
          vivo && deNoche
            ? { id: 'vida', etiqueta: `Matar ${quien}`, abreDialogo: true, elegir: () => setMatando(true) }
            : { id: 'vida', etiqueta: vivo ? `Matar ${quien}` : `Revivir ${quien}`, elegir: cambiarVida },
          ...(asiento.muertePendiente ? [{ id: 'anunciar', etiqueta: 'Anunciar su muerte', elegir: confirmarMuerte }] : []),
          ...(asiento.muerto
            ? [{ id: 'voto', etiqueta: asiento.votoGastado ? 'Devolver voto' : 'Quitar voto', elegir: cambiarVoto }]
            : []),
          // De noche no se marca a nadie
          ...(deNoche ? [] : [{ id: 'marca', etiqueta: asiento.marcado ? 'Desmarcar' : 'Marcar', elegir: cambiarMarca }]),
          // Solo cuando se puede nominar; si ya nominó hoy se avisa en la opción, pero puede volver a nominar
          ...(onNominar
            ? [{ id: 'nominar', etiqueta: yaNomino ? 'Nominar a… (ya nominó hoy)' : 'Nominar a…', elegir: onNominar }]
            : []),
          ...(hayGuion ? [cambiarFicha] : []),
          // Con el Gardener: lo mismo que arrastrarla sobre otra
          // Lil' Monsta: en las fichas de esbirro (se despierta a todos los esbirros)
          ...(onLilmonsta && personaje?.tipo === 'minion'
            ? [{ id: 'lilmonsta', etiqueta: "Iniciar Lil' Monsta", elegir: onLilmonsta }]
            : []),
          ...(onIntercambiar ? [{ id: 'intercambiar', etiqueta: 'Intercambiar con…', abreDialogo: true, elegir: onIntercambiar }] : []),
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
        [...opcionesJugador, cambiarFicha, ...opcionesAlineamiento, opcionRecordatorio, ...opcionNota];
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
      {listo && (
        // Listo para la noche (se dice en su descripción): un rótulo bajo la ficha
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-gold bg-background px-1.5 font-ui text-[0.6rem] font-semibold uppercase tracking-wider text-gold-bright"
        >
          Listo
        </span>
      )}
      {farolEnUso && (
        // El farol que usa (se dice en su descripción): un rótulo sobre la ficha
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 left-1/2 z-10 flex max-w-[7rem] -translate-x-1/2 items-center gap-1 truncate rounded-full border border-theme-main/60 bg-background px-1.5 font-ui text-[0.6rem] font-semibold text-theme-main"
        >
          <IconoMascaras size={10} className="shrink-0" />
          <span className="truncate">{farolEnUso.nombre.texto}</span>
        </span>
      )}
      {eligiendoRecordatorio && (
        <DialogoRecordatorio
          ficha={nombreFicha.replace(/^Ficha del /, '')}
          enJuego={todos.filter((p) => enJuego.has(p.id))}
          probables={probables}
          otros={todos.filter((p) => !enJuego.has(p.id))}
          onElegir={(p, i) => void ponerRecordatorio(p, i)}
          onTexto={(texto, icono) => void ponerRecordatorioTexto(texto, icono)}
          onCerrar={() => setEligiendoRecordatorio(false)}
        />
      )}
      {matando && (
        <DialogoRecordatorio
          ficha={nombreFicha.replace(/^Ficha del /, '')}
          titulo="Matar de noche"
          explicacion="Elige el recordatorio de quien lo mata: un demonio o un personaje que mata de noche (el Asesino, el Padrino…). Su muerte no se verá hasta que la anuncies de día, pulsando su sudario."
          // Solo los que matan de noche: los demonios y los personajes que lo hacen
          enJuego={todos.filter((p) => enJuego.has(p.id) && mataDeNoche(p))}
          probables={probables}
          otros={todos.filter((p) => !enJuego.has(p.id) && mataDeNoche(p))}
          cuales="que mate de noche"
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
