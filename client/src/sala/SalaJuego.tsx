import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { botonPrincipal } from './estilos';
import Cabecera from './Cabecera';
import DialogoPreferencias, { type Pestana } from './DialogoPreferencias';
import ListaParticipantes from './ListaParticipantes';
import MenuMano from './MenuMano';
import MenuNarrador from './MenuNarrador';
import Mesa, { type FocoAsiento, type TamanosMesa } from './Mesa';
import type { OpcionMenu } from './MenuDesplegable';
import MenuUsuario from './MenuUsuario';
import PanelAccesibilidad from './PanelAccesibilidad';
import PanelAtajos from './PanelAtajos';
import PanelInterfaz from './PanelInterfaz';
import PanelPartida from './PanelPartida';
import PanelUsuario, { type ResultadoPerfil } from './PanelUsuario';
import PanelIdiomas from './PanelIdiomas';
import RegistroVotaciones from './RegistroVotaciones';
import TituloGuion from './TituloGuion';
import FasePartida from './FasePartida';
import PanelChat from './PanelChat';
import PanelComunicaciones from './PanelComunicaciones';
import PanelConversaciones from './PanelConversaciones';
import VentanaConversacion from './VentanaConversacion';
import PanelInvitaciones from './PanelInvitaciones';
import ControlesVideo from './ControlesVideo';
import type { ContactoParticipante } from './BotonesContacto';
import { useVideollamada } from './useVideollamada';
import type { OndaMesa } from './Ondas';
import {
  CANAL_GENERAL,
  CANAL_VISITANTES,
  canalesComunes,
  canalPrivado,
  esPrivado,
  puedeEscribirA,
  type SalaMensaje,
  type SalaSusurro,
} from './chat';
import RepartoPartida from './RepartoPartida';
import { FichasContexto, TIPOS_EN_FICHA, type ContenidoFicha, type ContextoFichas } from './fichas';
import { mostrarPersonajes, tituloDeGuion, useTraducciones, type PersonajeMostrado } from './guiones';
import ZonaNarradores from './ZonaNarradores';
import { esAtajo, puedeUsarAtajo, useAtajos, type Atajo } from './atajos';
import { AvisosContexto, useAvisosActivos, type TipoAviso } from './avisosConfig';
import { avisosDeCambio, nombreFase } from './avisosSala';
import { setSonidosActivos, tocarSinVoto, tocarVoto } from './sonidos';
import { ID_BOTON_MENU_NARRADOR, ID_SIN_NARRADOR, idNombreNarrador } from './ids';
import { getPerfil, limpiarNombre, setPerfil } from './invitado';
import { usePreferencias } from './preferencias';
import { tamanoFichaAuto, tamanoNarradorAuto } from './tamanosAutomaticos';
import { nombreMano } from './formasMano';
import { useSala, type FormaMano, type SalaConfiguracion, type SalaEstado, type SalaParticipante } from './useSala';

interface SalaJuegoProps {
  /** Con cuenta: su token, su id de usuario (para recordar su perfil en la sala) y su avatar en la web. */
  cuenta: { token: string; id: string; username: string; avatar: string | null } | null;
  /** Nombre de invitado; se ignora si hay `cuenta`. */
  invitado: string | null;
  /** Hay que mover el foco al título (se acaba de entrar). */
  enfocar: boolean;
  /** Cerrar sesión (con cuenta) o salir de la sala (invitado). */
  onSalir: () => void;
  /** Como invitado, el nombre ya lo usa otro en la sala: hay que elegir otro. */
  onNombreOcupado: (nombre: string) => void;
}

const MENSAJE_CONEXION = {
  conectando: 'Conectando con la sala…',
  reconectando: 'Se ha perdido la conexión. Reconectando…',
  error: 'No se pudo entrar en la sala. Recarga la página para intentarlo de nuevo.',
};

const narradoresDe = (estado: SalaEstado) => estado.participantes.filter((p) => p.rol === 'narrador');

/** A dónde va el foco tras un cambio de narradores: el cuadro de uno mismo, el primero, o el aviso de que no hay. */
function destinoFoco(estado: SalaEstado): string {
  const narradores = narradoresDe(estado);
  const yo = narradores.find((n) => n.id === estado.yo);
  const destino = yo ?? narradores[0];
  return destino ? idNombreNarrador(destino.id) : ID_SIN_NARRADOR;
}

/**
 * La sala por dentro: en la cabecera, a la derecha, las opciones del narrador
 * (si narras), el botón de participantes y el menú del usuario; debajo, los
 * narradores arriba a la izquierda y la mesa con los asientos.
 *
 * Avisos:
 * - Cambios que hacen otros (narradores que entran, salen o cambian; quién se
 *   sienta o se levanta; ver avisosSala): solo para el lector, sin interrumpir
 *   (en pantalla ya se ven). Los que provoca uno mismo no se avisan: ya sabe lo
 *   que ha hecho; si le afectan (hacerse narrador, dejarlo), el foco pasa a su
 *   cuadro o al aviso de que no hay narrador.
 * - Errores y estado de la conexión: a la vista, flotando abajo para no mover
 *   la página, y también para el lector.
 */
const SalaJuego = ({ cuenta, invitado, enfocar, onSalir, onNombreOcupado }: SalaJuegoProps) => {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Errores de las acciones, a la vista; se van solos al rato.
  const [aviso, setAviso] = useState('');
  // Cambios que hacen otros, solo para el lector.
  const [anuncio, setAnuncio] = useState('');
  // El próximo cambio de narradores viene de una acción propia.
  const accionPropiaRef = useRef(false);
  // id al que llevar el foco cuando se pinte el nuevo estado.
  const focoPendienteRef = useRef<string | null>(null);
  // El foco estaba en un control que puede desaparecer con el cambio.
  const rescatarFocoRef = useRef<string | null>(null);

  // Qué avisos quiere el lector (Preferencias > Accesibilidad). Todo aviso pasa por anunciar().
  const { activos: avisosActivos, cambiar: cambiarAviso, cambiarTodos: cambiarTodosAvisos } = useAvisosActivos();
  const anunciar = (tipo: TipoAviso, texto: string) => {
    if (avisosActivos[tipo]) setAnuncio(texto);
  };

  const alCambiar = (anterior: SalaEstado | null, nuevo: SalaEstado) => {
    if (!anterior) return;
    // ¿Este cambio viene de una acción propia? (La marca vale para el siguiente cambio.)
    const propia = accionPropiaRef.current;
    accionPropiaRef.current = false;

    // Votación: cada ficha por la que pasa la aguja suena (el voto si vota, un tic si no).
    const votoAntes = anterior.nominacion?.votacion;
    const votoAhora = nuevo.nominacion?.votacion;
    if (votoAhora) {
      for (const id of votoAhora.orden.slice(votoAntes?.paso ?? 0, votoAhora.paso)) {
        if (typeof votoAhora.resultados[id] === 'number') tocarVoto();
        else tocarSinVoto();
      }
    }

    // Lo que han hecho otros (ver avisosSala); lo propio no se avisa: ya se sabe.
    const avisos = propia ? [] : avisosDeCambio(anterior, nuevo);
    // Salvo la noche y el día: el narrador puede cambiarlos con un atajo, sin ver nada.
    if (propia) {
      const f = nuevo.fase;
      if (f.reinicios !== anterior.fase.reinicios) {
        avisos.push({ tipo: 'fase', texto: 'Grimorio limpio: preparación de la partida.' });
      } else if (f.momento !== anterior.fase.momento || f.numero !== anterior.fase.numero) {
        avisos.push({ tipo: 'fase', texto: `${nombreFase(f)}.` });
      }
    }

    // Revelar el grimorio: que empieza (a los demás), cada ficha que se revela (a los
    // demás: el narrador la acaba de pulsar) y, al acabar, el bando ganador (a todos).
    const revAntes = anterior.revelacion;
    const revAhora = nuevo.revelacion;
    if (revAhora && !revAntes && !propia) avisos.push({ tipo: 'revelacion', texto: 'El narrador revela el grimorio.' });
    if (revAhora && !propia) {
      for (const asientoId of revAhora.reveladas.filter((id) => !revAntes?.reveladas.includes(id))) {
        const numero = nuevo.asientos.findIndex((a) => a.id === asientoId) + 1;
        const asiento = nuevo.asientos[numero - 1];
        const ocupante = nuevo.participantes.find((p) => p.id === asiento?.ocupante);
        const personaje = asiento?.personaje ? nombresPersonajesRef.current.get(asiento.personaje) : undefined;
        avisos.push({
          tipo: 'revelacion',
          texto: `${ocupante ? ocupante.nombre : `Asiento ${numero}`}: ${personaje?.nombre.texto ?? 'sin personaje'}.`,
        });
      }
    }
    if (revAhora?.terminada && !revAntes?.terminada) {
      avisos.push({ tipo: 'revelacion', texto: revAhora.ganador === 'bueno' ? 'Los buenos ganan.' : 'Los malvados ganan.' });
    }

    // Al limpiar el grimorio, también se borran las notas del grimorio propio.
    if (nuevo.fase.reinicios !== anterior.fase.reinicios) setNotasGrimorio({});

    // Mi personaje: si el narrador me lo cambia (o el alineamiento), se me dice.
    const miFicha = (e: SalaEstado) => e.asientos.find((a) => a.ocupante === e.yo);
    const antes = miFicha(anterior);
    const ahora = miFicha(nuevo);
    if (ahora && (ahora.personaje !== antes?.personaje || ahora.alineamiento !== antes?.alineamiento)) {
      const p = ahora.personaje ? nombresPersonajesRef.current.get(ahora.personaje) : undefined;
      if (!ahora.personaje) {
        if (antes?.personaje) avisos.push({ tipo: 'miPersonaje', texto: 'Ya no tienes personaje.' });
      } else if (ahora.personaje !== antes?.personaje) {
        avisos.push({ tipo: 'miPersonaje', texto: `Tu personaje: ${p?.nombre.texto ?? ahora.personaje}.` });
      } else if (ahora.alineamiento) {
        avisos.push({ tipo: 'miPersonaje', texto: `Ahora eres ${ahora.alineamiento}.` });
      }
    }

    // El narrador cambia el grimorio para los jugadores: se avisa a los jugadores,
    // que son a quienes les cambia lo que ven.
    const grimorio = nuevo.configuracion.grimorioJugadores;
    const juego = nuevo.participantes.some((p) => p.id === nuevo.yo && p.rol === 'jugador');
    if (grimorio !== anterior.configuracion.grimorioJugadores && juego) {
      avisos.push({
        tipo: 'grimorio',
        texto: grimorio
          ? 'El narrador ha activado el grimorio para los jugadores: puedes cambiar las fichas en el tuyo.'
          : 'El narrador ha desactivado el grimorio para los jugadores.',
      });
    }
    // Solo los tipos que se quieren oír.
    const textos = avisos.filter((a) => avisosActivos[a.tipo]).map((a) => a.texto);
    if (textos.length) setAnuncio(textos.join(' '));

    // Cambio de narradores: si es fruto de la propia acción y le afecta a uno, el
    // foco va a su cuadro o al aviso de que no hay; si no, se rescata si se pierde.
    const ids = (e: SalaEstado) =>
      narradoresDe(e)
        .map((p) => p.id)
        .join();
    if (ids(anterior) === ids(nuevo)) return;
    const meAfecta =
      narradoresDe(anterior).some((p) => p.id === nuevo.yo) !== narradoresDe(nuevo).some((p) => p.id === nuevo.yo);
    if (propia && meAfecta) focoPendienteRef.current = destinoFoco(nuevo);
    else rescatarFocoRef.current = destinoFoco(nuevo);
  };

  const cuentaId = cuenta?.id ?? null;
  // Nombre y avatar elegidos para la sala (vacío: los de siempre); se recuerdan en el navegador.
  const [alias, setAlias] = useState(() => getPerfil('alias', cuentaId));
  const [avatarElegido, setAvatarElegido] = useState(() => getPerfil('avatar', cuentaId));
  // Los personajes que pueden ir en las fichas (los del guion, en el idioma elegido) y
  // el grimorio propio del jugador (sus notas: solo en este navegador, mientras está en la sala).
  const [notasGrimorio, setNotasGrimorio] = useState<Record<string, ContenidoFicha>>({});
  const nombresPersonajesRef = useRef<Map<string, PersonajeMostrado>>(new Map());

  // Mensajes de texto: la conversación que se ve, las privadas abiertas (aún sin
  // mensajes), hasta cuándo se ha leído cada una y las ondas de los susurros.
  const [canalChat, setCanalChat] = useState<string | null>(null);
  const [privadosAbiertos, setPrivadosAbiertos] = useState<string[]>([]);
  const [leidoHasta, setLeidoHasta] = useState<Record<string, number>>({});
  const [ondas, setOndas] = useState<OndaMesa[]>([]);
  const ondaIdRef = useRef(0);
  const entradaChatRef = useRef<HTMLInputElement>(null);

  const alMensaje = (m: SalaMensaje) => {
    if (!estado) return;
    // Leído si llega a la conversación que se está viendo
    if (m.canal === canalActual) setLeidoHasta((l) => ({ ...l, [m.canal]: m.hora }));
    if (m.autor === estado.yo) return;
    const donde = m.canal === CANAL_GENERAL ? ' en General' : m.canal === CANAL_VISITANTES ? ' en Visitantes' : ' te escribe';
    anunciar('mensajes', `${m.autorNombre}${donde}: ${m.texto}`);
  };

  // Un susurro: ondas de un asiento a otro (unos segundos) y, a los demás, quién a quién
  const alSusurro = (s: SalaSusurro) => {
    if (!estado) return;
    const desde = estado.asientos.findIndex((a) => a.id === s.desde);
    const hasta = estado.asientos.findIndex((a) => a.id === s.hasta);
    if (desde < 0 || hasta < 0) return;
    const id = ++ondaIdRef.current;
    setOndas((o) => [...o, { id, desde, hasta, intensidad: s.intensidad }]);
    window.setTimeout(() => setOndas((o) => o.filter((x) => x.id !== id)), 3200);
    const quien = (i: number) => estado.participantes.find((p) => p.id === estado.asientos[i].ocupante);
    const emisor = quien(desde);
    const receptor = quien(hasta);
    if (emisor && receptor && emisor.id !== estado.yo && receptor.id !== estado.yo) {
      anunciar('susurros', `${emisor.nombre} susurra a ${receptor.nombre}.`);
    }
  };

  const {
    estado,
    guion,
    conexion,
    desfaseReloj,
    pedir,
    reconectar,
    mensajes,
    enviarMensaje,
    pedirHistorial,
    pedirPaseVideo,
    invitarAConversar,
    responderInvitacion,
    cancelarInvitacion,
    escucharConversacion,
    salirConversacion,
  } = useSala(
    cuenta?.token ?? null,
    cuenta ? null : invitado,
    { alias, avatar: avatarElegido },
    {
      alCambiar,
      alNombreOcupado: () => onNombreOcupado(alias || invitado || ''),
      alCambiarGuion: (g) => g && anunciar('guion', `Guion: ${tituloDeGuion(g)}.`),
      alMensaje,
      alSusurro,
    },
  );
  const yo = estado?.participantes.find((p) => p.id === estado.yo);

  // La conversación que se ve: la elegida si sigue disponible; si no, la primera
  const privadosChat = [...new Set([...mensajes.map((m) => m.canal).filter(esPrivado), ...privadosAbiertos])];
  const canalesChat = yo ? [...canalesComunes(yo), ...privadosChat] : [];
  const canalActual = canalChat && canalesChat.includes(canalChat) ? canalChat : (canalesChat[0] ?? null);

  // Al cambiar de papel cambia lo que se puede leer: se vuelve a pedir el historial
  const miRol = yo?.rol;
  useEffect(() => {
    if (miRol) pedirHistorial();
  }, [miRol, pedirHistorial]);

  // Cambiar de conversación: lo que había en las dos queda leído (hasta su último mensaje)
  const ultimoDe = (canal: string) => Math.max(0, ...mensajes.filter((m) => m.canal === canal).map((m) => m.hora));
  const elegirCanal = (canal: string) => {
    setLeidoHasta((l) => ({
      ...l,
      ...(canalActual ? { [canalActual]: ultimoDe(canalActual) } : {}),
      [canal]: ultimoDe(canal),
    }));
    setCanalChat(canal);
  };

  // Abrir una conversación privada (desde el retrato de alguien): se elige y el foco va a escribir
  const abrirPrivado = (otroId: string) => {
    if (!estado) return;
    const canal = canalPrivado(estado.yo, otroId);
    setPrivadosAbiertos((a) => (a.includes(canal) ? a : [...a, canal]));
    elegirCanal(canal);
    window.setTimeout(() => entradaChatRef.current?.focus(), 0);
  };
  const mensajePara = (otro: SalaParticipante) =>
    estado && yo && puedeEscribirA(estado, yo, otro) ? () => abrirPrivado(otro.id) : undefined;

  const { preferencias, cambiar: cambiarPreferencias } = usePreferencias();
  useEffect(() => setSonidosActivos(preferencias.sonidos), [preferencias.sonidos]);

  // Videollamada: cámaras y micrófonos en la mesa y en la conversación privada
  // La conversación en la que estoy: hablando (miembro) o escuchando (visitante)
  const miConversacion =
    estado?.conversaciones.find((c) => c.miembros.includes(estado.yo) || c.oyentes.includes(estado.yo)) ?? null;
  const hablaEnConversacion = !!miConversacion?.miembros.includes(estado?.yo ?? '');
  const puedeEmitirVideo = yo?.rol === 'jugador' || yo?.rol === 'narrador';
  const noche = estado?.fase.momento === 'noche';
  const video = useVideollamada({
    activa: !!estado?.video && conexion === 'conectada',
    puedeEmitir: puedeEmitirVideo,
    noche,
    conversacion: miConversacion?.id ?? null,
    hablaEnConversacion,
    idCamara: preferencias.idCamara,
    idMicrofono: preferencias.idMicrofono,
    pedirPase: pedirPaseVideo,
  });
  // De noche, fuera de una conversación privada, no hay cámaras
  const sinCamaraDeNoche = noche && !hablaEnConversacion;
  const tituloConversacionRef = useRef<HTMLHeadingElement>(null);

  // Invitar a conversar (a una nueva o a la propia). De día, jugadores y narradores;
  // de noche, solo el narrador. Quien ya está en otra no se puede invitar.
  const conversa = (p: SalaParticipante) => p.rol === 'jugador' || p.rol === 'narrador';
  const puedeInvitarA = (otro: SalaParticipante) => {
    if (!estado?.video || !yo || yo.id === otro.id) return false;
    if (!conversa(yo) || !conversa(otro)) return false;
    if (noche && yo.rol !== 'narrador') return false;
    return !estado.conversaciones.some((c) => c.miembros.includes(otro.id));
  };
  const invitar = async (otro: SalaParticipante) => {
    const r = await invitarAConversar(otro.id);
    if (!r.ok) setAviso(r.error);
    else anunciar('conversaciones', `Invitación enviada a ${otro.nombre}.`);
  };
  // Aceptar: se entra en la conversación y el foco va a su título; rechazar: nada más
  const responder = async (invitacionId: string, aceptar: boolean) => {
    const r = await responderInvitacion(invitacionId, aceptar);
    if (!r.ok) setAviso(r.error);
    else if (aceptar) window.setTimeout(() => tituloConversacionRef.current?.focus(), 0);
    else window.setTimeout(() => tituloRef.current?.focus(), 0);
  };
  const retirar = async (invitacionId: string) => {
    const r = await cancelarInvitacion(invitacionId);
    if (!r.ok) setAviso(r.error);
    else window.setTimeout(() => tituloRef.current?.focus(), 0);
  };
  // Visitantes: escuchar la conversación de alguien (sin invitación; los jugadores no lo saben)
  const escuchar = async (conversacionId: string) => {
    const r = await escucharConversacion(conversacionId);
    if (!r.ok) setAviso(r.error);
    else window.setTimeout(() => tituloConversacionRef.current?.focus(), 0);
  };
  const salirDeConversacion = async () => {
    const r = await salirConversacion();
    if (!r.ok) setAviso(r.error);
    // La conversación desaparece: el foco vuelve al título de la página
    else window.setTimeout(() => tituloRef.current?.focus(), 0);
  };
  /**
   * Lo que se puede hacer con alguien desde su nombre: escribirle y conversar
   * (invitarle, o «invitación enviada» mientras no responde) o, si soy visitante
   * y está conversando, escuchar su conversación.
   */
  const contacto = (otro: SalaParticipante): ContactoParticipante | undefined => {
    const onMensaje = mensajePara(otro);
    let conversar: ContactoParticipante['conversar'];
    if (estado?.video && yo?.rol === 'visitante') {
      const suya = estado.conversaciones.find((c) => c.miembros.includes(otro.id));
      if (suya && suya.id !== miConversacion?.id) {
        conversar = { etiqueta: `Escuchar la conversación de ${otro.nombre}`, onIniciar: () => void escuchar(suya.id) };
      }
    } else if (estado?.invitaciones.some((i) => i.de === estado.yo && i.para === otro.id)) {
      conversar = { etiqueta: `Invitación enviada a ${otro.nombre}`, pendiente: true };
    } else if (puedeInvitarA(otro)) {
      conversar = {
        etiqueta: hablaEnConversacion ? `Invitar a ${otro.nombre} a la conversación` : `Invitar a ${otro.nombre} a conversar`,
        onIniciar: () => void invitar(otro),
      };
    }
    return onMensaje || conversar ? { onMensaje, conversar } : undefined;
  };

  // Micrófono y cámara con atajo (sin el foco en el botón): se dice cómo quedan
  const alternarMicrofonoConAtajo = () => {
    video.alternarMicrofono();
    anunciar('comunicaciones', video.microfono ? 'Micrófono silenciado.' : 'Micrófono abierto.');
  };
  const alternarCamaraConAtajo = () => {
    if (sinCamaraDeNoche) {
      anunciar('comunicaciones', 'De noche no hay cámaras, salvo en las conversaciones privadas.');
      return;
    }
    video.alternarCamara();
    anunciar('comunicaciones', video.camara ? 'Cámara apagada.' : 'Cámara encendida.');
  };

  const traduccionesNombres = useTraducciones(preferencias.idiomaNombres, preferencias.genero);
  // (Sin useMemo: el compilador de React ya memoriza lo que no cambia)
  const personajesFichas = guion
    ? mostrarPersonajes(guion.personajes, traduccionesNombres, null).filter((p) => TIPOS_EN_FICHA.includes(p.tipo))
    : [];
  const contextoFichas: ContextoFichas = {
    hayGuion: !!guion,
    personajes: personajesFichas,
    porId: new Map(personajesFichas.map((p) => [p.id, p])),
    notas: notasGrimorio,
    anotar: (asientoId, contenido) => setNotasGrimorio((n) => ({ ...n, [asientoId]: contenido })),
  };
  useEffect(() => {
    nombresPersonajesRef.current = contextoFichas.porId;
  });
  // Tamaños con los que pinta la mesa (automáticos o no), para la vista previa.
  const [tamanosMesa, setTamanosMesa] = useState<TamanosMesa | null>(null);
  // Tamaño de la ventana, para el tamaño automático de los cuadros de narrador.
  const [ventana, setVentana] = useState(() => ({ ancho: window.innerWidth, alto: window.innerHeight }));
  useEffect(() => {
    const alCambiar = () => setVentana({ ancho: window.innerWidth, alto: window.innerHeight });
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);

  // Opciones del menú de usuario según tu situación en la sala (hacerse narrador,
  // levantarse, dejar de narrar); salen si el servidor las permite.
  const focoAsientoRef = useRef<FocoAsiento | null>(null);
  const levantarme = async () => {
    const mio = estado?.asientos.find((a) => a.ocupante === estado.yo);
    if (mio) focoAsientoRef.current = { asientoId: mio.id, sentado: false };
    const r = await pedir('sala:levantarse');
    if (!r.ok) {
      focoAsientoRef.current = null;
      setAviso(r.error);
    }
    return r.ok;
  };
  const dejarDeNarrar = async () => {
    const r = await pedirPropio('narrador:dejar');
    if (!r.ok) setAviso(r.error);
    return r.ok;
  };
  const hacermeNarrador = async () => {
    const r = await pedirPropio('sala:hacerseNarrador');
    if (!r.ok) setAviso(r.error);
    return r.ok;
  };
  const puedeHacermeNarrador = !!estado?.acciones.includes('sala:hacerseNarrador');
  const puedeLevantarme = !!estado?.acciones.includes('sala:levantarse');
  const puedeDejarDeNarrar = !!estado?.acciones.includes('narrador:dejar');
  // Levantar o bajar la mano y elegir su forma (jugadores): con el atajo de
  // teclado o desde el menú de la mano de la cabecera. Como no cambia nada donde
  // está el foco, se confirma al lector.
  const puedeLevantarMano = !!estado?.acciones.includes('sala:levantarMano');
  const manoLevantada = !!yo?.manoLevantada;
  const alternarMano = async () => {
    const levantada = !manoLevantada;
    const r = await pedir('sala:levantarMano', { levantada });
    if (r.ok) anunciar('miMano', levantada ? 'Has levantado la mano.' : 'Has bajado la mano.');
    else setAviso(r.error);
    // false: el menú (si se ha usado) se cierra y el foco vuelve a su botón.
    return false;
  };
  const elegirFormaMano = async (forma: FormaMano) => {
    const r = await pedir('sala:elegirMano', { forma });
    if (r.ok) anunciar('miMano', `Tu mano: ${nombreMano(forma).toLocaleLowerCase('es')}.`);
    else setAviso(r.error);
    return false;
  };
  const { atajos, cambiar: cambiarAtajo } = useAtajos();
  // Narradores: ir a la noche (desde la preparación o el día) o amanecer (desde la noche).
  const accionFase = estado?.acciones.includes('narrador:irANoche')
    ? 'narrador:irANoche'
    : estado?.acciones.includes('narrador:amanecer')
      ? 'narrador:amanecer'
      : null;
  const cambiarFase = async () => {
    if (!accionFase) return;
    const r = await pedirPropio(accionFase);
    if (!r.ok) setAviso(r.error);
  };

  // Los atajos que se pueden usar ahora, con lo que hace cada uno.
  const atajosActivos: [Atajo, () => void][] = [
    ...(puedeLevantarMano ? [[atajos.levantarMano, alternarMano] as [Atajo, () => void]] : []),
    ...(accionFase ? [[atajos.cambiarFase, () => void cambiarFase()] as [Atajo, () => void]] : []),
    ...(estado?.video && puedeEmitirVideo
      ? [
          [atajos.microfono, alternarMicrofonoConAtajo] as [Atajo, () => void],
          [atajos.camara, alternarCamaraConAtajo] as [Atajo, () => void],
        ]
      : []),
  ];
  // Los atajos tienen prioridad sobre el control con el foco: se escuchan en la fase
  // de captura (antes que él) y no se dejan seguir, ni al pulsar ni al soltar
  // (con Espacio, algunos navegadores pulsan el botón al soltar).
  useEffect(() => {
    if (atajosActivos.length === 0) return;
    const delAtajo = (e: KeyboardEvent) =>
      puedeUsarAtajo(e) ? atajosActivos.find(([atajo]) => esAtajo(e, atajo)) : undefined;
    const alPulsar = (e: KeyboardEvent) => {
      const encontrado = delAtajo(e);
      if (!encontrado) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) encontrado[1]();
    };
    const alSoltar = (e: KeyboardEvent) => {
      if (!delAtajo(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', alPulsar, true);
    window.addEventListener('keyup', alSoltar, true);
    return () => {
      window.removeEventListener('keydown', alPulsar, true);
      window.removeEventListener('keyup', alSoltar, true);
    };
  });

  const enLaSala: OpcionMenu[] = [
    ...(puedeHacermeNarrador
      ? [{ id: 'sala:hacerseNarrador', etiqueta: 'Hacerse narrador', elegir: hacermeNarrador }]
      : []),
    ...(puedeLevantarme ? [{ id: 'sala:levantarse', etiqueta: 'Levantarse del asiento', elegir: levantarme }] : []),
    ...(puedeDejarDeNarrar ? [{ id: 'narrador:dejar', etiqueta: 'Dejar de ser narrador', elegir: dejarDeNarrar }] : []),
  ];

  // Edición de asientos (narradores): botones en el centro de la mesa.
  const [editandoAsientos, setEditandoAsientos] = useState(false);
  const editando = editandoAsientos && !!estado?.acciones.includes('narrador:asientos');
  const terminarAsientos = () => {
    setEditandoAsientos(false);
    document.getElementById(ID_BOTON_MENU_NARRADOR)?.focus();
  };
  const [preferenciasAbiertas, setPreferenciasAbiertas] = useState(false);

  // Pestaña Usuario: se mandan solo los cambios, primero el nombre.
  const guardarPerfil = async (nombre: string, avatar: string): Promise<ResultadoPerfil> => {
    const nuevoAlias = limpiarNombre(nombre);
    if (nuevoAlias !== alias) {
      const r = await pedir('sala:cambiarNombre', { nombre: nuevoAlias });
      if (!r.ok) return { ...r, campo: 'nombre' };
      setPerfil('alias', cuentaId, nuevoAlias);
      setAlias(nuevoAlias);
    }
    let guardado = avatar;
    if (avatar.startsWith('data:')) {
      // Imagen propia nueva: se sube y queda su ruta
      const r = await pedir('sala:subirAvatar', { imagen: avatar });
      if (!r.ok) return { ...r, campo: 'avatar' };
      guardado = r.valor ?? '';
    } else if (avatar !== avatarElegido) {
      const r = await pedir('sala:cambiarAvatar', { avatar: avatar || null });
      if (!r.ok) return { ...r, campo: 'avatar' };
    }
    if (guardado !== avatarElegido) {
      setPerfil('avatar', cuentaId, guardado);
      setAvatarElegido(guardado);
    }
    return { ok: true, avatar: guardado };
  };

  const configurarPartida = async (cambios: Partial<SalaConfiguracion>) => {
    const r = await pedir('narrador:configurarPartida', cambios);
    if (!r.ok) setAviso(r.error);
  };

  const pestanasPreferencias: Pestana[] = [
    {
      id: 'usuario',
      etiqueta: 'Usuario',
      conControles: true,
      contenido: (
        <div className="flex flex-col gap-6">
          <PanelUsuario
            nombreActual={yo?.nombre ?? alias}
            avatarElegido={avatarElegido}
            cuenta={cuenta && { avatar: cuenta.avatar }}
            onGuardar={guardarPerfil}
          />
          <PanelIdiomas preferencias={preferencias} onCambiar={cambiarPreferencias} />
        </div>
      ),
    },
    {
      id: 'interfaz',
      etiqueta: 'Interfaz',
      conControles: true,
      contenido: (
        <PanelInterfaz
          nombre={yo?.nombre ?? (alias || cuenta?.username || invitado || '')}
          preferencias={preferencias}
          tamanosMesa={tamanosMesa}
          onCambiar={cambiarPreferencias}
        />
      ),
    },
    {
      id: 'accesibilidad',
      etiqueta: 'Accesibilidad',
      conControles: true,
      contenido: (
        <PanelAccesibilidad activos={avisosActivos} onCambiar={cambiarAviso} onCambiarTodos={cambiarTodosAvisos} />
      ),
    },
    {
      id: 'atajos',
      etiqueta: 'Atajos de teclado',
      conControles: true,
      contenido: <PanelAtajos atajos={atajos} onCambiar={cambiarAtajo} />,
    },
    {
      id: 'comunicaciones',
      etiqueta: 'Comunicaciones',
      conControles: true,
      contenido: (
        <PanelComunicaciones preferencias={preferencias} onCambiar={cambiarPreferencias} hayVideo={!!estado?.video} />
      ),
    },
    // Solo si el servidor deja configurar la partida (narradores).
    ...(estado?.acciones.includes('narrador:configurarPartida')
      ? [
          {
            id: 'partida',
            etiqueta: 'Partida',
            conControles: true,
            contenido: <PanelPartida configuracion={estado.configuracion} onCambiar={configurarPartida} />,
          },
        ]
      : []),
  ];

  const pedirPropio = async (accion: string, datos?: unknown) => {
    setAviso('');
    accionPropiaRef.current = true;
    const r = await pedir(accion, datos);
    if (!r.ok) accionPropiaRef.current = false;
    return r;
  };

  useEffect(() => {
    if (enfocar) tituloRef.current?.focus();
  }, [enfocar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(''), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Expulsada: la sala desaparece de esta ventana. El foco va al botón para volver,
  // que lleva el motivo como descripción (por eso ese mensaje no va en aria-live).
  // Si lo ha expulsado un narrador no hay botón: el foco va al mensaje.
  const volverRef = useRef<HTMLButtonElement>(null);
  const expulsadoRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (conexion === 'expulsada') volverRef.current?.focus();
    if (conexion === 'expulsadaPorNarrador') expulsadoRef.current?.focus();
  }, [conexion]);

  // Tras pintar un cambio de narradores: llevar el foco a donde toca, o
  // recuperarlo si el control que lo tenía ha desaparecido.
  useEffect(() => {
    const pendiente = focoPendienteRef.current;
    const rescate = rescatarFocoRef.current;
    focoPendienteRef.current = null;
    rescatarFocoRef.current = null;
    const perdido = document.activeElement === document.body || !document.activeElement;
    const destino = pendiente ?? (perdido ? rescate : null);
    if (destino) document.getElementById(destino)?.focus();
  });

  // Los tamaños elegidos llegan a los cuadros (CuadroAvatar) y a las fichas
  // (FichaRedonda, Mesa) por estas variables CSS.
  // Fuera de la mesa (cuadros de narrador): automático según la ventana. La mesa
  // pone los suyos (ver Mesa).
  const avatarFuera = preferencias.avatarAuto
    ? tamanoNarradorAuto(ventana.ancho, ventana.alto)
    : preferencias.tamanoAvatar;
  const tamanos = {
    '--sala-avatar': `${avatarFuera}px`,
    '--sala-ficha': `${preferencias.fichaAuto ? tamanoFichaAuto(avatarFuera) : preferencias.tamanoFicha}px`,
    '--sala-ficha-distancia': `${preferencias.distanciaFicha / 100}`,
  } as CSSProperties;

  return (
    <AvisosContexto.Provider value={avisosActivos}>
      <FichasContexto.Provider value={contextoFichas}>
      <div className="contents" style={tamanos}>
        <Cabecera
          centro={
            estado && (
              <div className="flex min-w-0 items-center gap-2">
                <FasePartida fase={estado.fase} />
                <TituloGuion
                  guion={guion}
                  puedeCambiar={estado.acciones.includes('narrador:cambiarGuion')}
                  pedir={pedirPropio}
                  onError={setAviso}
                  idiomas={{
                    nombres: preferencias.idiomaNombres,
                    descripciones: preferencias.idiomaDescripciones,
                    genero: preferencias.genero,
                  }}
                  onCambiarIdiomaDescripciones={(idiomaDescripciones) => cambiarPreferencias({ idiomaDescripciones })}
                  bolsa={
                    estado.acciones.includes('narrador:bolsa')
                      ? { bolsa: estado.bolsa, distribucion: estado.distribucion }
                      : null
                  }
                  onAnuncio={anunciar}
                  // En juego y vivos: las fichas con personaje y sin sudario que ve quien mira
                  enJuego={estado.asientos.filter((a) => a.personaje && !a.muerto).map((a) => a.personaje!)}
                />
              </div>
            )
          }
          derecha={
            <div className="flex items-center gap-2">
              {estado?.video && (
                <ControlesVideo
                  puedeEmitir={puedeEmitirVideo}
                  microfono={video.microfono}
                  camara={video.camara}
                  sinCamaraDeNoche={sinCamaraDeNoche}
                  onMicrofono={video.alternarMicrofono}
                  onCamara={video.alternarCamara}
                  teclaMicrofono={atajos.microfono.key}
                  teclaCamara={atajos.camara.key}
                  problema={video.problema}
                  onCerrarProblema={video.cerrarProblema}
                  sonidoBloqueado={video.sonidoBloqueado}
                  onActivarSonido={video.activarSonido}
                />
              )}
              {estado && (
                <MenuNarrador
                  estado={estado}
                  pedir={pedirPropio}
                  onAsientos={() => setEditandoAsientos((v) => !v)}
                />
              )}
              {puedeLevantarMano && yo && (
                <MenuMano
                  forma={yo.formaMano}
                  levantada={manoLevantada}
                  onAlternar={alternarMano}
                  onElegirForma={elegirFormaMano}
                />
              )}
              {/* Solo narradores: el servidor solo les manda a ellos el registro */}
              {yo?.rol === 'narrador' && estado && <RegistroVotaciones votaciones={estado.votaciones} />}
              {estado && <ListaParticipantes participantes={estado.participantes} yo={estado.yo} />}
              <MenuUsuario
                nombre={yo?.nombre ?? (alias || cuenta?.username || invitado || '')}
                avatar={yo?.avatar ?? null}
                conCuenta={!!cuenta}
                onPreferencias={() => setPreferenciasAbiertas(true)}
                enLaSala={enLaSala}
                onSalir={onSalir}
              />
            </div>
          }
        />

        {/* La sala ocupa todo el ancho: los narradores van arriba a la izquierda */}
        <main className="flex-1 w-full px-4 py-6">
          {/* Oculto a la vista (ocupaba sitio), pero es el título de la página para el lector y el destino del foco al entrar */}
          <h1 ref={tituloRef} tabIndex={-1} className="sr-only">
            Sala de juego
          </h1>

          <div aria-live="polite" className="sr-only">
            {anuncio}
          </div>

          {/* Flota abajo: no empuja el contenido ni genera scroll. Conexión y errores se
            ven siempre; se leen si se quiere (Preferencias > Accesibilidad). */}
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 flex w-[min(90vw,32rem)] -translate-x-1/2 flex-col gap-2">
            <div aria-live={avisosActivos.conexion ? 'polite' : 'off'}>
              {(conexion === 'conectando' || conexion === 'reconectando' || conexion === 'error') && (
                <p className="rounded border border-outline-ghost bg-surface px-4 py-2 text-center text-on-surface-muted shadow-lg">
                  {MENSAJE_CONEXION[conexion]}
                </p>
              )}
            </div>
            <div aria-live={avisosActivos.errores ? 'polite' : 'off'}>
              {aviso && (
                <p className="rounded border border-red-400/60 bg-surface px-4 py-2 text-center shadow-lg">{aviso}</p>
              )}
            </div>
          </div>

          {conexion === 'expulsadaPorNarrador' && (
            <p ref={expulsadoRef} tabIndex={-1} className="focus:outline-none">
              Un narrador te ha expulsado de la sala.
            </p>
          )}

          {conexion === 'expulsada' && (
            <div className="flex flex-col items-start gap-4">
              <p id="sala-expulsada">
                Has entrado en la sala desde otra ventana o dispositivo, así que aquí se ha cerrado.
              </p>
              <button
                ref={volverRef}
                type="button"
                onClick={reconectar}
                aria-describedby="sala-expulsada"
                className={botonPrincipal}
              >
                Volver a entrar aquí
              </button>
            </div>
          )}

          {estado && (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* A la izquierda: los narradores y, debajo, los mensajes */}
              <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80">
                <ZonaNarradores
                  estado={estado}
                  pedir={pedirPropio}
                  onError={setAviso}
                  contacto={contacto}
                  pistas={video.mesa}
                />
                {/* Las invitaciones a conversar (recibidas y enviadas) */}
                <PanelInvitaciones
                  invitaciones={estado.invitaciones}
                  conversaciones={estado.conversaciones}
                  participantes={estado.participantes}
                  yo={estado.yo}
                  onResponder={(i, aceptar) => void responder(i.id, aceptar)}
                  onCancelar={(i) => void retirar(i.id)}
                />
                {/* Quién está en una conversación privada (para todos; la llamada, en el centro) */}
                {yo && (
                  <PanelConversaciones
                    conversaciones={estado.conversaciones}
                    participantes={estado.participantes}
                    yo={yo}
                    onEscuchar={(id) => void escuchar(id)}
                  />
                )}
                {yo && canalActual && (
                  <PanelChat
                    estado={estado}
                    yo={yo}
                    mensajes={mensajes}
                    activo={canalActual}
                    abiertos={privadosAbiertos}
                    leidoHasta={leidoHasta}
                    onElegir={elegirCanal}
                    onEnviar={enviarMensaje}
                    entradaRef={entradaChatRef}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Mesa
                  estado={estado}
                  manual={{ avatar: preferencias.tamanoAvatar, ficha: preferencias.tamanoFicha }}
                  auto={{ avatar: preferencias.avatarAuto, ficha: preferencias.fichaAuto }}
                  onTamanos={setTamanosMesa}
                  editando={editando}
                  grimorio={yo?.rol === 'jugador' && estado.configuracion.grimorioJugadores}
                  pedir={pedirPropio}
                  onError={setAviso}
                  onAnuncio={anunciar}
                  focoAsientoRef={focoAsientoRef}
                  onTerminar={terminarAsientos}
                  desfaseReloj={desfaseReloj}
                  contacto={contacto}
                  pistas={video.mesa}
                  ondas={ondas}
                />
              </div>
              {/* Fuera de la mesa, para no tapar sus fichas: en pantallas anchas, abajo
                  del todo a la derecha (apartándose de la hoja del guion); en estrechas, debajo de la mesa */}
              <RepartoPartida
                distribucion={estado.distribucion}
                bolsa={estado.acciones.includes('narrador:bolsa') ? estado.bolsa : null}
              />
            </div>
          )}
        </main>

        {/* La llamada privada de quien está en ella: en grande en el centro, o pequeña y movible */}
        {estado && miConversacion && (
          <VentanaConversacion
            key={miConversacion.id}
            tituloRef={tituloConversacionRef}
            conversacion={miConversacion}
            participantes={estado.participantes}
            yo={estado.yo}
            pistas={video.privada}
            onSalir={() => void salirDeConversacion()}
          />
        )}

        {preferenciasAbiertas && (
          <DialogoPreferencias pestanas={pestanasPreferencias} onCerrar={() => setPreferenciasAbiertas(false)} />
        )}
      </div>
      </FichasContexto.Provider>
    </AvisosContexto.Provider>
  );
};

export default SalaJuego;
