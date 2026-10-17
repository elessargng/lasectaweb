import { Fragment, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import Agujas from './Agujas';
import AnuncioGanador from './AnuncioGanador';
import AvisoGong from './AvisoGong';
import { useAriaLive, type TipoAviso } from './avisosConfig';
import AsaMover from './AsaMover';
import Asiento from './Asiento';
import NotasAsiento from './NotasAsiento';
import EnviarGrimorio from './EnviarGrimorio';
import GrimorioRecibido from './GrimorioRecibido';
import { BookOpen } from 'lucide-react';
import { describirAsiento } from './nombresAsiento';
import CuentaAtras from './CuentaAtras';
import Ondas, { type OndaMesa } from './Ondas';
import type { ContactoParticipante } from './BotonesContacto';
import type { PistasParticipante } from './useVideollamada';
import { hacenFalta } from './avisosSala';
import CuadroAvatar from './CuadroAvatar';
import FichaAsiento from './FichaAsiento';
import FichaRedonda from './FichaRedonda';
import PersonajeEnFicha from './PersonajeEnFicha';
import RecordatoriosFicha from './RecordatoriosFicha';
import { ESCALA_RECORDATORIO } from './FichaRecordatorio';
import { contarBolsa, describirRecordatorio, identidadDe, NOTAS_MAX, recordatoriosDeFicha, TIPOS_REPARTO, useFichas } from './fichas';
import { descuadres } from './comprobarReparto';
import LunaDespertar from './LunaDespertar';
import ManoLevantada from './ManoLevantada';
import PanelNominacion from './PanelNominacion';
import { botonPrincipal, botonSecundario } from './estilos';
import { ID_AYUDA_MOVER, idLunaFicha, idNombreAsiento, ID_GANADOR, idRevelarFicha } from './ids';
import { nombreDeAsiento } from './despertar';
import { tamanoAvatarAuto, tamanoFichaAuto } from './tamanosAutomaticos';
import { useMoverAsientos } from './useMoverAsientos';
import { useNominacion } from './useNominacion';
import type { SalaEstado, SalaParticipante, SalaRecordatorio, SalaResultado } from './useSala';

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
  /** Escribir y conversar con quien se sienta (lo que se pueda). */
  contacto?: (participante: SalaParticipante) => ContactoParticipante | undefined;
  /** Lo que se ve y se oye de cada uno en la mesa (cámaras, quién habla). */
  pistas: Map<string, PistasParticipante>;
  /** Susurros en curso: ondas de un asiento a otro. */
  ondas: OndaMesa[];
  /**
   * Narrador (y visitante que ve el grimorio): los asientos con despertar, los que
   * tienen mensajes sin ver y cómo abrir (o crear, de noche: solo el narrador) el
   * de un asiento. null para los demás.
   */
  /** `entendidos`: los asientos cuyo jugador ha contestado «Entendido» (la luna pasa a pulgar arriba). */
  despertares: { hilos: Set<string>; noLeidos: Set<string>; entendidos: Set<string>; onAbrir: (asientoId: string) => void } | null;
  /**
   * Visitantes y narradores: a quién siguen (id) y cómo seguir o dejar de seguir
   * al jugador de una ficha. null si no pueden seguir a nadie.
   */
  seguimiento: { siguiendo: string | null; onAlternar: (jugador: SalaParticipante) => void } | null;
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

/**
 * Dónde empiezan los recordatorios de la ficha `i`: junto a ella, hacia el
 * centro de la mesa (medio diámetro de la ficha y medio de un recordatorio más
 * adentro), y hacia dónde se apilan (el centro).
 */
function posicionRecordatorios(i: number, total: number): { style: CSSProperties; hacia: { x: number; y: number } } {
  const angulo = (2 * Math.PI * i) / total;
  const x = Math.sin(angulo);
  const y = -Math.cos(angulo);
  const t = 'var(--sala-ficha-distancia, 0.75)';
  const ficha = 'var(--sala-ficha, 4.5rem)';
  const radio = `(50% - var(--sala-avatar, 10rem) / 2 - ${t} * (var(--sala-avatar, 10rem) + ${ficha}) / 2 - ${ficha} * ${(1 + ESCALA_RECORDATORIO) / 2} - 2px)`;
  return {
    style: { left: `calc(50% + ${x.toFixed(4)} * ${radio})`, top: `calc(50% + ${y.toFixed(4)} * ${radio})` },
    hacia: { x: -x, y: -y },
  };
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
  contacto,
  pistas,
  ondas,
  despertares,
  seguimiento,
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

  // El narrador despierta (de noche) al jugador de una ficha, o a la ficha si el
  // asiento está libre (cuenta como un jugador más), o abre su despertar si ya lo tiene.
  const despertarDe = (asientoId: string) => {
    if (modoFichas !== 'narrador' || editando || !despertares) return undefined;
    const abierto = despertares.hilos.has(asientoId);
    if (!abierto && !acciones.includes('narrador:despertar')) return undefined;
    return { abierto, onAbrir: () => despertares.onAbrir(asientoId) };
  };
  const ariaLiveAsientos = useAriaLive('editarAsientos');
  // Lo que lleva cada ficha, para leerlo con el nombre del asiento: el personaje que
  // ve quien mira (el de la partida o, con grimorio, el que ha anotado), la calavera y el sudario.
  const { porId, notas, anotar, todosPorId, notasRecordatorios, anotarRecordatorios, notasEscritas, escribirNotas } = useFichas();
  const personajeVisto = (a: (typeof asientos)[number]) =>
    a.personaje ?? (modoFichas === 'grimorio' ? notas[a.id]?.personaje : null) ?? null;
  // Los recordatorios que se ven: los de la partida (a quien ve el grimorio) y, con grimorio propio, los anotados
  const recordatoriosDe = (a: (typeof asientos)[number]) =>
    recordatoriosDeFicha(a, modoFichas === 'grimorio' ? notasRecordatorios : null);
  const fichaDe = (a: (typeof asientos)[number]) => {
    const personajeId = personajeVisto(a);
    const personaje = personajeId ? porId.get(personajeId) : undefined;
    return {
      personaje: personaje?.nombre ?? null,
      marcado: a.marcado,
      muerto: a.muerto,
      votoGastado: a.votoGastado,
      muertePendiente: a.muertePendiente,
      recordatorios: recordatoriosDe(a).map((r) => describirRecordatorio(r, todosPorId.get(r.personaje))),
    };
  };
  // Los personajes en juego (para quien mira): sus recordatorios salen primero al poner uno
  // En juego: los de las fichas y los NPCs (legendarios y lóricos), que también llevan recordatorios
  // (también quién es de verdad, por su «Is The …»)
  const identidades = asientos.flatMap((a) => (identidadDe(a).personaje ? [identidadDe(a).personaje!] : []));
  const enJuego = new Set([...asientos.map(personajeVisto).filter((id): id is string => !!id), ...identidades, ...estado.npcs]);
  // Con todos los personajes ya puestos (quien ve el grimorio), si el reparto no cuadra
  // lo más seguro es que alguien no sea lo que cree: faltan forasteros (el Borracho)
  // o esbirros (la Marioneta). Sus recordatorios salen con los de los que están en juego.
  const cuentas = contarBolsa(identidades, (id) => todosPorId.get(id)?.tipo);
  const repartidos = TIPOS_REPARTO.reduce((n, { tipo }) => n + (cuentas[tipo] ?? 0), 0);
  const descuadre =
    repartidos > 0 && repartidos === estado.distribucion.jugadores
      ? descuadres(cuentas, estado.distribucion, [...identidades, ...estado.npcs])
      : { forasteros: false, esbirros: false };
  const probables = new Set<string>();
  if (descuadre.forasteros && todosPorId.has('drunk')) probables.add('drunk');
  if ((descuadre.forasteros || descuadre.esbirros) && todosPorId.has('marionette')) probables.add('marionette');
  for (const id of probables) enJuego.add(id);
  // Quitar un recordatorio: el narrador, de la partida; un jugador, de su grimorio.
  // El botón desaparece: el foco vuelve a la ficha, que dice los que quedan.
  const anotadoPorMi = (asientoId: string, r: SalaRecordatorio) => !!notasRecordatorios[asientoId]?.some((x) => x.id === r.id);
  const quitarRecordatorio = async (asientoId: string, r: SalaRecordatorio) => {
    if (anotadoPorMi(asientoId, r)) {
      anotarRecordatorios(asientoId, (notasRecordatorios[asientoId] ?? []).filter((x) => x.id !== r.id));
    } else {
      const res = await pedir('narrador:quitarRecordatorio', { asientoId, recordatorioId: r.id });
      if (!res.ok) return onError(res.error);
    }
    window.setTimeout(() => document.getElementById(`sala-ficha-${asientoId}-boton`)?.focus(), 0);
  };
  // Las notas de cada asiento: las del narrador (a quien ve el grimorio) o, con grimorio
  // propio, las del jugador (en su navegador). Las escriben el narrador y el jugador con grimorio.
  const [notasAbiertas, setNotasAbiertas] = useState<{ asientoId: string; nueva: boolean } | null>(null);
  const notasDe = (a: (typeof asientos)[number]) => (modoFichas === 'grimorio' ? (notasEscritas[a.id] ?? []) : (a.notas ?? []));
  const escriboNotas = modoFichas === 'narrador' || modoFichas === 'grimorio';
  const guardarNota = async (asientoId: string, notaId: string | null, texto: string): Promise<string | null> => {
    if (modoFichas === 'grimorio') {
      const lista = notasEscritas[asientoId] ?? [];
      if (notaId) escribirNotas(asientoId, lista.map((n) => (n.id === notaId ? { ...n, texto } : n)));
      else if (lista.length >= NOTAS_MAX) return `Cada asiento puede tener como mucho ${NOTAS_MAX} notas.`;
      else escribirNotas(asientoId, [...lista, { id: crypto.randomUUID(), texto }]);
      return null;
    }
    const r = await pedir('narrador:escribirNota', { asientoId, notaId, texto });
    return r.ok ? null : r.error;
  };
  const borrarNota = async (asientoId: string, notaId: string): Promise<string | null> => {
    if (modoFichas === 'grimorio') {
      escribirNotas(asientoId, (notasEscritas[asientoId] ?? []).filter((n) => n.id !== notaId));
      return null;
    }
    const r = await pedir('narrador:borrarNota', { asientoId, notaId });
    return r.ok ? null : r.error;
  };

  // El Espía y la Viuda: el narrador les envía una copia del grimorio (que puede cambiar
  // antes); a ellos se les abre al llegar y la pueden volver a ver (y copiar en el suyo).
  const nombresAsientos = Object.fromEntries(
    // (participante() se define más abajo: aquí, a mano)
    asientos.map((a, i) => [a.id, participantes.find((p) => p.id === a.ocupante)?.nombre ?? `Asiento ${i + 1}`]),
  );
  const veGrimorioAjeno = (a: (typeof asientos)[number]) =>
    ['spy', 'widow'].includes(a.personaje ?? '') || ['spy', 'widow'].includes(identidadDe(a).personaje ?? '');
  const [enviandoA, setEnviandoA] = useState<string | null>(null);
  const copiaGrimorio = () =>
    asientos.map((a) => ({
      asientoId: a.id,
      personaje: a.personaje,
      alineamiento: a.alineamiento,
      muerto: a.muerto,
      recordatorios: a.recordatorios ?? [],
    }));
  const recibido = estado.grimorioRecibido;
  const [verRecibido, setVerRecibido] = useState(false);
  const horaRecibidoRef = useRef(recibido?.hora ?? null);
  useEffect(() => {
    const hora = recibido?.hora ?? null;
    if (hora !== null && hora !== horaRecibidoRef.current) {
      setVerRecibido(true);
      onAnuncio('despertar', 'El narrador te ha enviado el grimorio.');
    }
    horaRecibidoRef.current = hora;
    // Solo al llegar uno nuevo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recibido?.hora]);
  const copiarRecibido = () => {
    for (const f of recibido?.fichas ?? []) {
      anotar(f.asientoId, { personaje: f.personaje, alineamiento: f.alineamiento });
      anotarRecordatorios(f.asientoId, f.recordatorios.map((r) => ({ ...r, id: crypto.randomUUID() })));
    }
  };

  // Seguir al jugador de una ficha (no a uno mismo, ni editando asientos o revelando el grimorio)
  const seguirA = (ocupante: SalaParticipante | null) => {
    if (!seguimiento || editando || estado.revelacion || !ocupante || ocupante.id === estado.yo || ocupante.rol !== 'jugador') return undefined;
    return { siguiendo: seguimiento.siguiendo === ocupante.id, onAlternar: () => seguimiento.onAlternar(ocupante) };
  };

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
  const { nominacion, revelacion } = estado;
  // Revelando el grimorio (narradores): pulsar una ficha la revela a todos; «Terminar» revela las que quedan
  const puedeRevelar = acciones.includes('narrador:revelarFicha');
  // La ficha revelada deja de ser un botón: el foco va a la siguiente boca abajo (en
  // el sentido del reloj) o, si era la última, al bando ganador.
  const revelar = async (asientoId: string) => {
    const r = await pedir('narrador:revelarFicha', { asientoId });
    if (!r.ok) {
      onError(r.error);
      return;
    }
    const i = asientos.findIndex((a) => a.id === asientoId);
    const siguiente = [...asientos.slice(i + 1), ...asientos.slice(0, i)].find(
      (a) => !revelacion?.reveladas.includes(a.id),
    );
    window.setTimeout(() => document.getElementById(siguiente ? idRevelarFicha(siguiente.id) : ID_GANADOR)?.focus(), 0);
  };
  // Gardener: entregar los personajes repartidos. El botón desaparece: el foco va al
  // nombre del primer asiento, y se confirma
  const gardener = todosPorId.get('gardener');
  // Hace efectiva una muerte de la noche (el sudario semitransparente): ya la ven todos
  const anunciarMuerte = async (asientoId: string) => {
    const r = await pedir('narrador:confirmarMuerte', { asientoId });
    if (!r.ok) onError(r.error);
    else onAnuncio('muertes', `Muerte anunciada: ${nombreDeAsiento(estado, asientoId)}.`);
  };
  const entregarFichas = async () => {
    const r = await pedir('narrador:entregarFichas');
    if (!r.ok) return onError(r.error);
    onAnuncio('bolsa', 'Personajes entregados a los jugadores.');
    if (asientos[0]) window.setTimeout(() => document.getElementById(idNombreAsiento(asientos[0].id))?.focus(), 0);
  };
  const terminarRevelacion = async () => {
    const r = await pedir('narrador:terminarRevelacion');
    if (!r.ok) onError(r.error);
    else window.setTimeout(() => document.getElementById(ID_GANADOR)?.focus(), 0);
  };
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
      className="sala-mesa-halo relative isolate mx-auto aspect-square w-full max-w-[calc(100vh-8rem)]"
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
                  contacto={ocupante ? contacto?.(ocupante) : undefined}
                  video={ocupante ? pistas.get(ocupante.id)?.video : undefined}
                  espejo={!!ocupante && ocupante.id === estado.yo}
                  hablando={!!ocupante && !!pistas.get(ocupante.id)?.hablando}
                  enConversacion={!!ocupante && estado.conversaciones.some((c) => c.miembros.includes(ocupante.id))}
                  // Micro cerrado en la mesa (quien conversa en privado ya lleva su icono)
                  silenciado={
                    !!ocupante &&
                    !!pistas.get(ocupante.id) &&
                    !pistas.get(ocupante.id)!.microfono &&
                    !estado.conversaciones.some((c) => c.miembros.includes(ocupante.id))
                  }
                  asa={editando && real && <AsaMover {...mover.propsAsa(a.id)} nombre={real.nombre} numero={i + 1} />}
                  ficha={fichaDe(a)}
                  siguiendo={!!ocupante && seguimiento?.siguiendo === ocupante.id}
                />
                {/* Las notas: una pestaña hacia fuera de la mesa (la izquierda o la derecha del cuadro) */}
                {!editando && (
                  <NotasAsiento
                    asientoId={a.id}
                    nombre={describirAsiento(i + 1, ocupante)}
                    notas={notasDe(a)}
                    editable={escriboNotas}
                    lado={Math.sin((2 * Math.PI * i) / total) < -0.01 ? 'izquierda' : 'derecha'}
                    abierto={notasAbiertas?.asientoId === a.id}
                    nueva={notasAbiertas?.asientoId === a.id && notasAbiertas.nueva}
                    onAbrir={() => setNotasAbiertas({ asientoId: a.id, nueva: false })}
                    onCerrar={() => setNotasAbiertas((n) => (n?.asientoId === a.id ? null : n))}
                    onGuardar={(notaId, texto) => guardarNota(a.id, notaId, texto)}
                    onBorrar={(notaId) => borrarNota(a.id, notaId)}
                  />
                )}
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
      {/* Solo se ve (sin menú): fuera del árbol de accesibilidad, salvo las que se pueden seguir */}
      <div
        aria-hidden={modoFichas === 'ver' && !seguimiento && !despertares ? true : undefined}
        className="pointer-events-none absolute inset-0 z-10 has-[[aria-expanded=true]]:z-40"
      >
        {asientos.map((a, i) => {
          // La ficha es del asiento; quien se ve sentado (con el movimiento provisional, si lo hay).
          const visible = editando ? mover.ocupanteVisible(a) : a.ocupante;
          const ocupante = participante(visible);
          const eligiendo = nominar.eligiendo(a.id);
          const seguir = seguirA(ocupante);
          // La luna del despertar (narradores, y visitantes que ven el grimorio) también se pulsa
          const conLuna = !!despertares?.hilos.has(a.id) && !editando;
          const soloSeVe = modoFichas === 'ver' && !eligiendo && !seguir && !conLuna;
          const posRecordatorios = posicionRecordatorios(i, total);
          return (
            <Fragment key={a.id}>
              <div
                aria-hidden={soloSeVe || undefined}
                // La ficha con el menú abierto, por encima de las demás (si no, su menú quedaría debajo)
                className={`absolute -translate-x-1/2 -translate-y-1/2 has-[[aria-expanded=true]]:z-50 ${soloSeVe ? '' : 'pointer-events-auto'}`}
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
                  reloj={!!nominacion && !revelacion}
                  deNoche={estado.fase.momento === 'noche'}
                  despertar={despertarDe(a.id)}
                  seguir={seguir}
                  enJuego={enJuego}
                  probables={probables}
                  onEscribirNota={escriboNotas && !editando ? () => setNotasAbiertas({ asientoId: a.id, nueva: true }) : undefined}
                  onEnviarGrimorio={
                    modoFichas === 'narrador' && !editando && a.ocupante && veGrimorioAjeno(a) && acciones.includes('narrador:enviarGrimorio')
                      ? () => setEnviandoA(a.id)
                      : undefined
                  }
                  revelando={
                    revelacion
                      ? {
                          revelada: revelacion.reveladas.includes(a.id),
                          onRevelar: puedeRevelar ? () => void revelar(a.id) : undefined,
                        }
                      : undefined
                  }
                />
                {a.muertePendiente && acciones.includes('narrador:confirmarMuerte') && !editando && (
                  // La muerte de la noche, por anunciar: el sudario semitransparente es un botón que
                  // la hace efectiva (la ven todos). Al pasar el ratón o con el foco se ve ya entero.
                  <button
                    type="button"
                    onClick={() => void anunciarMuerte(a.id)}
                    className="group/sudario absolute left-1/2 top-[-6%] z-10 h-[56%] w-[42%] -translate-x-1/2 cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <img
                      src="/sudario.webp"
                      alt=""
                      className="mx-auto h-full w-auto opacity-0 drop-shadow-[0_0_6px_rgba(212,175,106,0.6)] transition-opacity group-hover/sudario:opacity-100 group-focus-visible/sudario:opacity-100 motion-reduce:transition-none"
                    />
                    <span className="sr-only">Anunciar la muerte de {nombreDeAsiento(estado, a.id)}</span>
                  </button>
                )}
                {conLuna && despertares && (
                  // El despertar: una luna con cara sobre toda la ficha (como la calavera), color
                  // hueso con contorno de tinta; dorada y con un halo quieto (y lo dice) si el
                  // jugador ha mandado algo que el narrador no ha visto. Solo la luna recibe el
                  // clic (lo vuelve a abrir): el resto de la ficha sigue abriendo su menú.
                  <button
                    id={idLunaFicha(a.id)}
                    type="button"
                    onClick={() => despertares.onAbrir(a.id)}
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <LunaDespertar nueva={despertares.noLeidos.has(a.id)} entendido={despertares.entendidos.has(a.id)} className="w-[72%]" />
                    <span className="sr-only">
                      {a.ocupante === estado.yo ? 'Tu despertar' : `Despertar de ${nombreDeAsiento(estado, a.id)}`}
                      {despertares.entendidos.has(a.id) ? ', entendido' : ''}
                      {despertares.noLeidos.has(a.id) ? ', mensajes nuevos' : ''}
                    </span>
                  </button>
                )}
                {ocupante && (
                  // La mano levantada: en la esquina de la ficha (sube y baja) o, en una
                  // nominación, grande en el centro; se dice en el nombre de la ficha y en los avisos
                  <ManoLevantada levantada={ocupante.manoLevantada} forma={ocupante.formaMano} enNominacion={!!nominacion} />
                )}
              </div>
              {/* Sus recordatorios, después de la ficha (en el orden del tabulador también) */}
              {!revelacion && (
                <RecordatoriosFicha
                  recordatorios={recordatoriosDe(a)}
                  style={posRecordatorios.style}
                  hacia={posRecordatorios.hacia}
                  puedeQuitar={(r) => modoFichas === 'narrador' || anotadoPorMi(a.id, r)}
                  onQuitar={(r) => void quitarRecordatorio(a.id, r)}
                />
              )}
            </Fragment>
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

      <Ondas ondas={ondas} total={total} />

      {/* Todas reveladas: el bando ganador, en grande (se anuncia aparte) */}
      {revelacion?.terminada && <AnuncioGanador ganador={revelacion.ganador} />}

      {/* El grimorio que me ha enviado el narrador (Espía, Viuda): en la esquina de la mesa, para volver a verlo */}
      {recibido && (
        <button
          type="button"
          onClick={() => setVerRecibido(true)}
          className="absolute left-0 top-0 z-20 flex items-center gap-1.5 rounded-full border border-gold/50 bg-background/85 px-3 py-1.5 font-ui text-xs font-semibold text-gold-bright shadow hover:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
        >
          <BookOpen size={14} aria-hidden="true" />
          Grimorio del narrador
        </button>
      )}
      {recibido && verRecibido && (
        <GrimorioRecibido
          grimorio={recibido}
          nombres={nombresAsientos}
          onCopiar={modoFichas === 'grimorio' ? copiarRecibido : undefined}
          onCerrar={() => setVerRecibido(false)}
        />
      )}
      {enviandoA && (
        <EnviarGrimorio
          destino={{ asientoId: enviandoA, nombre: nombreDeAsiento(estado, enviandoA) }}
          copia={copiaGrimorio()}
          nombres={nombresAsientos}
          pedir={pedir}
          onEnviado={() => onAnuncio('despertar', `Grimorio enviado a ${nombreDeAsiento(estado, enviandoA)}.`)}
          onCerrar={() => setEnviandoA(null)}
        />
      )}

      {/* El gong del narrador: el aviso de volver a la plaza, alrededor de la mesa */}
      <AvisoGong gong={estado.gong} ahora={estado.ahora} mesaRef={mesaRef} onAnuncio={(m) => onAnuncio('gong', m)} />

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
        <p className="absolute left-1/2 top-[calc(50%+3rem)] z-30 -translate-x-1/2 whitespace-nowrap rounded border border-gold/30 bg-background/80 px-3 py-1 font-ui text-sm font-semibold tracking-wide text-on-surface-bright">
          {hacenFalta(nominacion.votosNecesarios)}
        </p>
      )}

      {/* El centro de la mesa: la cuenta atrás (todos), el panel de la nominación y
          el de editar asientos (narradores). Por encima de las agujas. */}
      {(nominacion?.cuentaAtrasFin || nominar.panel || nominar.cancelar || editando || revelacion || estado.fichasRetenidas) && (
        <div className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
          {/* Gardener: los personajes repartidos esperan a que el narrador los entregue */}
          {estado.fichasRetenidas &&
            (acciones.includes('narrador:entregarFichas') ? (
              <button
                type="button"
                onClick={() => void entregarFichas()}
                className="group flex flex-col items-center gap-2 rounded-lg p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main"
              >
                {gardener && (
                  <span aria-hidden="true" className="block transition-transform group-hover:scale-105 motion-reduce:transition-none" style={{ '--sala-ficha': '6rem' } as CSSProperties}>
                    <FichaRedonda>
                      <PersonajeEnFicha personaje={gardener} alineamiento={null} />
                    </FichaRedonda>
                  </span>
                )}
                <span className={botonPrincipal}>
                  Entregar los personajes
                </span>
              </button>
            ) : (
              <p className="max-w-56 sala-cofre p-3 text-center text-sm text-on-surface-muted">
                El narrador aún no ha entregado los personajes.
              </p>
            ))}
          {revelacion && !revelacion.terminada && acciones.includes('narrador:terminarRevelacion') && (
            <div className="flex max-w-56 flex-col items-center gap-2 sala-cofre p-4 text-center">
              <p className="text-sm text-on-surface-muted">Pulsa cada ficha para revelarla a todos.</p>
              <button type="button" onClick={() => void terminarRevelacion()} className={botonPrincipal}>
                Terminar revelación
              </button>
            </div>
          )}
          {nominacion?.votacion ? (
            // Votando: los votos que lleva, en grande (se anuncian al terminar)
            <p
              aria-hidden="true"
              className="font-teutonic1 text-5xl leading-none text-gold-bright drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
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
            <div className="sala-cofre p-4">
              <button type="button" onClick={nominar.cancelar} className={botonSecundario}>
                Cancelar nominación
              </button>
            </div>
          )}
          {nominar.panel && (
            <div className="sala-cofre p-4">
              <PanelNominacion {...nominar.panel} />
            </div>
          )}
          {editando && (
            <div className="flex flex-col items-center gap-3 sala-cofre p-4">
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
