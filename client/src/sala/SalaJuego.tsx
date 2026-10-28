import { MessagesSquare, Phone } from 'lucide-react';
import { IconoConversar, IconoDestellos, IconoMascaras } from './IconosJuego';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { urlDelServidor } from '../utils/api';
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
import { sonVecinos } from './nombresAsiento';
import { useGestos, useReconocerGestos, type Gesto } from './gestos';
import PanelInterfaz from './PanelInterfaz';
import CiudadPlaza from './CiudadPlaza';
import PanelSonido from './PanelSonido';
import PanelPartida from './PanelPartida';
import PanelUsuario, { type ResultadoPerfil } from './PanelUsuario';
import PanelIdiomas from './PanelIdiomas';
import RegistroVotaciones from './RegistroVotaciones';
import TituloGuion from './TituloGuion';
import FasePartida from './FasePartida';
import PanelChat from './PanelChat';
import PanelComunicaciones from './PanelComunicaciones';
import PanelConversaciones from './PanelConversaciones';
import PanelFaroles, { FarolesFijados } from './PanelFaroles';
import PanelNpcs from './PanelNpcs';
import ColumnaLateral, { type PestanaLateral } from './ColumnaLateral';
import VentanaConversacion from './VentanaConversacion';
import VentanaDespertar from './VentanaDespertar';
import DespertarJugador from './DespertarJugador';
import { useSenalamientoCongelado } from './senales';
import { describirMensaje, esEntendido, nombreDeAsiento } from './despertar';
import { CAUSAS_FINAL } from './causasFinal';
import PanelInvitaciones from './PanelInvitaciones';
import ControlesVideo from './ControlesVideo';
import type { ContactoParticipante } from './BotonesContacto';
import { useVideollamada } from './useVideollamada';
import type { OndaMesa } from './Ondas';
import {
  CANAL_GENERAL,
  CANAL_VISITANTES,
  canalesComunes,
  CANAL_SUSURROS,
  canalPrivado,
  deQuienAQuien,
  esAjeno,
  mensajesDe,
  privadosPropios,
  puedeEscribirA,
  sinLeerDe,
  type SalaMensaje,
  type SalaSusurro,
} from './chat';
import RepartoPartida from './RepartoPartida';
import { duracionReloj, RELOJ_TRAS_FIN_MS } from './reloj';
import { ESTILOS_CALAVERA, ESTILOS_MANO, ESTILOS_SILLA, estiloDePartida, MarcasContexto } from './marcas';
import { FichasContexto, identidadDe, TIPOS_EN_FICHA, type ContenidoFicha, type ContextoFichas } from './fichas';
import { actuaAlMorir, mostrarPersonajes, tituloDeGuion, useTraducciones, type PersonajeMostrado } from './guiones';
import ZonaNarradores from './ZonaNarradores';
import {
  accionCogerLlamada,
  describirAtajo,
  esAtajo,
  NUM_TECLAS_LLAMADA,
  puedeUsarAtajo,
  useAtajos,
  type AccionAtajo,
  type Atajo,
} from './atajos';
import { AvisosContexto, useAvisosActivos, type TipoAviso } from './avisosConfig';
import { avisosDeCambio, manosVigiladas, nombreFase } from './avisosSala';
import { recibidasDe, reconciliarSlots } from './slotsLlamada';
import { setSonidosActivos, setTonoLlamada, tocarDespertar, tocarPrivado, tocarSinVoto, tocarSolicitud, tocarVoto } from './sonidos';
import { esTeclaLlamadaBotc, LlamadaBotcContexto } from './llamadaBotc';
import CieloEstrellado from './CieloEstrellado';
import DialogoFinal from './DialogoFinal';
import { rutaFondo } from './fondos';
import { idFichaNominar, idPestanaLateral, ID_BOTON_MENU_NARRADOR, ID_SIN_NARRADOR, ID_TITULO_DESPERTAR, idLunaFicha, idNombreNarrador } from './ids';
import { ElegirEnPlazaContexto, type PedidoEleccion } from './elegirEnPlaza';
import { getPerfil, limpiarNombre, setPerfil } from './invitado';
import { sinComunicaciones, usePreferencias } from './preferencias';
import { useConfiguracionCuenta, type ConfiguracionSala, type PerfilConfiguracion } from './configuracion';
import PanelPerfiles from './PanelPerfiles';
import { tamanoFichaAuto, tamanoNarradorAuto } from './tamanosAutomaticos';
import { anguloAsiento } from './geometriaMesa';
import { nombreMano } from './formasMano';
import {
  useSala,
  type FormaMano,
  type SalaConfiguracion,
  type SalaDespertar,
  type SalaEstado,
  type SalaHabilidadNoche,
  type SalaParticipante,
  type SalaRecordatorio,
} from './useSala';
import type { DespertarFila } from './PanelGuion';
import type { Revision } from './VentanaDespertar';
import { aEnvio, describirAviso, describirOpcion, ESTADO_HABILIDAD, type ContextoHabilidades } from './habilidadesNoche';
import DialogoNuevoImp from './DialogoNuevoImp';

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
  // Vigilar la mano de alguien (botón solo para el lector junto a su nombre): se
  // lee al momento, interrumpiendo, siempre que la levanta o la baja.
  const [vigilados, setVigilados] = useState<Set<string>>(new Set());
  const [anuncioUrgente, setAnuncioUrgente] = useState('');
  const urgenteRef = useRef(0);
  const anunciarUrgente = (texto: string) => {
    // Se vacía antes, para que se lea aunque sea igual que el anterior
    setAnuncioUrgente('');
    const n = ++urgenteRef.current;
    window.setTimeout(() => n === urgenteRef.current && setAnuncioUrgente(texto), 50);
  };
  // El próximo cambio de narradores viene de una acción propia.
  const accionPropiaRef = useRef(false);
  // id al que llevar el foco cuando se pinte el nuevo estado.
  const focoPendienteRef = useRef<string | null>(null);
  // Despertares a los que el narrador acaba de mandar «Entendido»: se cierra su ventana
  const entendidosPorCerrarRef = useRef<string[]>([]);
  // El foco estaba en un control que puede desaparecer con el cambio.
  const rescatarFocoRef = useRef<string | null>(null);
  // Llamadas entrantes: a cada una, por orden de llegada, una tecla para cogerla
  // (ver slotsLlamada). El ref recuerda qué slot tiene cada una; el estado lo pinta.
  const slotsLlamadaRef = useRef<Map<string, number>>(new Map());
  const [slotsLlamada, setSlotsLlamada] = useState<Record<string, number>>({});

  // Qué avisos quiere el lector (Preferencias > Accesibilidad). Todo aviso pasa por anunciar().
  const {
    activos: avisosActivos,
    cambiar: cambiarAviso,
    cambiarTodos: cambiarTodosAvisos,
    reemplazar: reemplazarAvisos,
  } = useAvisosActivos();
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
    const avisos = propia ? [] : avisosDeCambio(anterior, nuevo, vigilados, personajesGuionRef.current);
    // Las manos vigiladas: siempre (también tras una acción propia), sin filtros
    const urgentes = manosVigiladas(anterior, nuevo, vigilados, personajesGuionRef.current);
    if (urgentes.length) anunciarUrgente(urgentes.join(' '));

    // Llamadas entrantes: a las nuevas se les da su tecla (slot), suena un toque
    // breve y se avisa con quién llama y qué tecla la coge. (El aviso va al mismo
    // lote que los demás, para que no se pisen.)
    const nuevasLlamadas = reconciliarSlots(slotsLlamadaRef.current, recibidasDe(nuevo), NUM_TECLAS_LLAMADA);
    setSlotsLlamada(Object.fromEntries(slotsLlamadaRef.current));
    if (nuevasLlamadas.length) {
      tocarSolicitud();
      const nombreDe = (id: string) => nuevo.participantes.find((p) => p.id === id)?.nombre ?? 'Alguien';
      for (const { invitacion, slot } of nuevasLlamadas) {
        const quien = nombreDe(invitacion.de);
        const base = invitacion.conversacion
          ? `${quien} pide unirse a tu conversación.`
          : `${quien} te invita a una conversación privada.`;
        const tecla = slot === null ? '' : ` Pulsa ${describirAtajo(atajos[accionCogerLlamada(slot)])} para cogerla.`;
        avisos.push({ tipo: 'conversaciones', texto: base + tecla });
      }
    }
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
        // Quién es de verdad (su «Is The …»), no la ficha que llevaba
        const real = asiento ? identidadDe(asiento).personaje : null;
        const personaje = real ? personajesGuionRef.current.get(real) : undefined;
        avisos.push({
          tipo: 'revelacion',
          texto: `${ocupante ? ocupante.nombre : `Asiento ${numero}`}: ${personaje?.nombre.texto ?? 'sin personaje'}.`,
        });
      }
    }
    if (revAhora?.terminada && !revAntes?.terminada) {
      avisos.push({ tipo: 'revelacion', texto: revAhora.ganador === 'bueno' ? 'Gana el bando bueno.' : 'Gana el bando malo.' });
      // Y lo que ha pasado (ver causasFinal.ts), una frase por personaje
      for (const id of revAhora.causas ?? []) {
        const causa = CAUSAS_FINAL.find((c) => c.personaje === id);
        const nombre = personajesGuionRef.current.get(id)?.nombre.texto ?? id;
        if (causa) avisos.push({ tipo: 'revelacion', texto: `${nombre}: ${causa.texto.charAt(0).toLocaleLowerCase('es') + causa.texto.slice(1)}.` });
      }
    }

    // El silencio del narrador (Bibliotecario del Infierno): a los jugadores, al momento
    // (quien habla puede llevarse algo malo); a los demás, como un aviso más
    if (nuevo.silencio !== anterior.silencio && !propia) {
      const juego = nuevo.participantes.some((p) => p.id === nuevo.yo && p.rol === 'jugador');
      const texto = nuevo.silencio ? 'El narrador pide silencio.' : 'Se acabó el silencio: ya se puede hablar.';
      if (juego) anunciarUrgente(texto);
      else avisos.push({ tipo: 'comunicaciones', texto });
    }

    // NPCs: los que el narrador pone o quita (a los demás; él ya lo ve)
    if (!propia) {
      const nombreNpc = (id: string) => npcsPorIdRef.current.get(id)?.nombre.texto ?? id;
      for (const id of nuevo.npcs.filter((n) => !anterior.npcs.includes(n))) {
        avisos.push({ tipo: 'npcs', texto: `Nuevo NPC en juego: ${nombreNpc(id)}.` });
      }
      for (const id of anterior.npcs.filter((n) => !nuevo.npcs.includes(n))) {
        avisos.push({ tipo: 'npcs', texto: `${nombreNpc(id)} ya no está en juego.` });
      }
    }

    // Al revelar el grimorio (se acaba la partida) y al limpiarlo, se borra el grimorio
    // propio: los personajes, recordatorios y notas que anotó el jugador.
    if ((nuevo.revelacion && !anterior.revelacion) || nuevo.fase.reinicios !== anterior.fase.reinicios) {
      setNotasGrimorio({});
      setNotasRecordatorios({});
      setNotasEscritas({});
    }

    // Mi personaje: al repartir la bolsa (lo único que me llega de mi ficha), se me dice.
    const miFicha = (e: SalaEstado) => e.asientos.find((a) => a.ocupante === e.yo);
    const antes = miFicha(anterior);
    const ahora = miFicha(nuevo);
    if (ahora && (ahora.personaje !== antes?.personaje || ahora.alineamiento !== antes?.alineamiento)) {
      const p = ahora.personaje ? nombresPersonajesRef.current.get(ahora.personaje) : undefined;
      if (!ahora.personaje) {
        // Con Tor (no se sabe hasta morir) o el Gardener (aún no entregado) no es que no lo tenga
        const oculto = nuevo.npcs.includes('tor') || nuevo.fichasRetenidas;
        if (antes?.personaje && !oculto) avisos.push({ tipo: 'miPersonaje', texto: 'Ya no tienes personaje.' });
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
    // El narrador deja ver (o vuelve a ocultar) las cámaras de las conversaciones en la
    // plaza: se avisa a quien no lo ha cambiado (es su cámara la que se ve o no)
    const ocultas = nuevo.configuracion.ocultarCamarasConversacion;
    if (ocultas !== anterior.configuracion.ocultarCamarasConversacion && !propia) {
      avisos.push({
        tipo: 'conversaciones',
        texto: ocultas
          ? 'El narrador oculta las cámaras de las conversaciones privadas: en la plaza ya no se ven.'
          : 'El narrador deja ver las cámaras de las conversaciones privadas: en la plaza se ven, sin voz.',
      });
    }
    // Despertares: lo que manda el narrador (al jugador) o lo que contesta el jugador (a
    // los narradores); lo propio no, ya se confirma al mandarlo. Si el narrador manda
    // algo al jugador que tenía su ventana cerrada, se le vuelve a abrir. (Al jugador el
    // despertar le llega con lo primero que le manda el narrador, no al abrirlo.)
    const soyNarrador = nuevo.participantes.some((p) => p.id === nuevo.yo && p.rol === 'narrador');
    const hilosAntes = new Map(anterior.despertares.map((d) => [d.asiento, d]));
    // Al amanecer se acaban los despertares de la noche: se cierran sus ventanas y, si
    // el foco estaba en una (que desaparece), va al título de la sala.
    if (nuevo.fase.momento !== 'noche' && anterior.fase.momento === 'noche' && anterior.despertares.length) {
      setWakesAbiertos([]);
      setWakeActivo(null);
      setLeidoWake({});
      window.setTimeout(() => {
        if (document.activeElement === document.body || !document.activeElement) tituloRef.current?.focus();
      }, 0);
    }
    const veoTodos = nuevo.participantes.some((p) => p.id === nuevo.yo && p.rol === 'visitante');
    let suenaDespertar = false;
    for (const d of nuevo.despertares) {
      const antes = hilosAntes.get(d.asiento);
      const yaDichos = new Set(antes?.mensajes.map((m) => m.id));
      const nuevos = d.mensajes.filter((m) => !yaDichos.has(m.id));
      for (const m of nuevos) {
        const texto = describirMensaje(m, nuevo, personajesGuionRef.current);
        if (soyNarrador && m.autor !== 'narrador') {
          avisos.push({ tipo: 'despertar', texto: `${nombreDeAsiento(nuevo, m.autor)}: ${texto}.` });
        }
        // Un visitante que ve el grimorio oye los dos lados, con quién es cada uno
        else if (veoTodos && m.autor === 'narrador') {
          avisos.push({ tipo: 'despertar', texto: `El narrador a ${nombreDeAsiento(nuevo, d.asiento)}: ${texto}.` });
        } else if (veoTodos) {
          avisos.push({ tipo: 'despertar', texto: `${nombreDeAsiento(nuevo, m.autor)}: ${texto}.` });
        } else if (!soyNarrador && m.autor === 'narrador') avisos.push({ tipo: 'despertar', texto: `El narrador: ${texto}.` });
      }
      // (Un «Entendido» del narrador no se la vuelve a abrir: ya está hablado.)
      if (!soyNarrador && (!antes || nuevos.some((m) => m.autor === 'narrador' && m.ficha !== 'entendido'))) {
        setWakeCerradoJugador(false);
        // Al jugador despertado le suena como una llamada entrante (al visitante no)
        if (!veoTodos) suenaDespertar = true;
      }
      // «Entendido» cierra el despertar de quien lo manda, y el foco va a la ficha (con el
      // pulgar arriba). El jugador: también al volver a entrar en la sala, si fue lo último
      // suyo. El narrador: su ventana de ese despertar (tras pintar, ver más abajo).
      const ultimo = d.mensajes[d.mensajes.length - 1];
      if (!soyNarrador && !veoTodos && nuevos.length > 0 && esEntendido(d) && ultimo.autor !== 'narrador') {
        setWakeCerradoJugador(true);
        if (antes) focoPendienteRef.current = idLunaFicha(d.asiento);
      }
      if (soyNarrador && propia && esEntendido(d) && ultimo.autor === 'narrador' && nuevos.includes(ultimo)) {
        entendidosPorCerrarRef.current.push(d.asiento);
      }
      if (soyNarrador && !propia && !antes) {
        avisos.push({ tipo: 'despertar', texto: `Otro narrador despierta a ${nombreDeAsiento(nuevo, d.asiento)}.` });
      }
      if (veoTodos && !antes) avisos.push({ tipo: 'despertar', texto: `El narrador despierta a ${nombreDeAsiento(nuevo, d.asiento)}.` });
    }
    if (suenaDespertar) tocarDespertar();
    // El despertar guiado: al elegir el jugador, lo que se ha hecho solo o que hay que
    // revisarlo (a quién ha elegido ya se ha dicho con su mensaje)
    if (soyNarrador) {
      const guiadoAntes = new Map(anterior.habilidadesNoche.map((h) => [h.personaje, h.estado]));
      const c: ContextoHabilidades = { estado: nuevo, porId: personajesGuionRef.current, indiceRecordatorio: () => -1 };
      for (const h of nuevo.habilidadesNoche) {
        if (guiadoAntes.get(h.personaje) !== 'esperando' || h.estado === 'esperando') continue;
        const nombre = personajesGuionRef.current.get(h.personaje)?.nombre.texto ?? h.personaje;
        const detalles = h.avisos.filter((a) => a.tipo !== 'elegido').map((a) => describirAviso(c, a));
        avisos.push({ tipo: 'despertar', texto: [`${nombre}: ${ESTADO_HABILIDAD[h.estado].toLocaleLowerCase('es')}.`, ...detalles].join(' ') });
      }
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
  const [notasRecordatorios, setNotasRecordatorios] = useState<Record<string, SalaRecordatorio[]>>({});
  const [notasEscritas, setNotasEscritas] = useState<Record<string, string>>({});
  const nombresPersonajesRef = useRef<Map<string, PersonajeMostrado>>(new Map());
  const [wakesAbiertos, setWakesAbiertos] = useState<string[]>([]);
  const [wakeActivo, setWakeActivo] = useState<string | null>(null);
  const [leidoWake, setLeidoWake] = useState<Record<string, number>>({});
  const [wakeCerradoJugador, setWakeCerradoJugador] = useState(false);
  // «¿Quién es el nuevo Imp?» aplazado («Ahora no»): el asiento del Imp que muere (vuelve a salir con otro)
  const [nuevoImpAplazado, setNuevoImpAplazado] = useState<string | null>(null);
  // Recordatorios del orden de noche (narradores, compartidos): los automáticos son
  // los personajes en juego y vivos, y Esbirros y Demonios si hay alguno vivo; lo que
  // los narradores quitan o ponen a mano lo guarda el servidor hasta limpiar el grimorio.
  // Quien ha muerto esta noche (sudario transparente, sin anunciar) ya no cuenta como vivo:
  // no se despierta. Salvo los personajes que actúan precisamente por morir esa noche
  // (el Ravenkeeper, el Sage…, ver actuaAlMorir).
  const sigueVivo = (a: SalaEstado['asientos'][number]) => !a.muerto && !a.muertePendiente;
  const recordatoriosNoche = (e: SalaEstado) => {
    const actua = (id: string) => {
      const p = guion?.personajes.find((x) => x.id === id);
      return !!p && actuaAlMorir(p);
    };
    const vivos = e.asientos
      .filter((a) => a.personaje && (sigueVivo(a) || (!a.muerto && actua(a.personaje))))
      .map((a) => a.personaje!);
    const vivosDeVerdad = e.asientos.filter((a) => a.personaje && sigueVivo(a)).map((a) => a.personaje!);
    const tipoDe = (id: string) => personajesGuionPorId.get(id)?.tipo;
    const automaticos = new Set(vivos);
    if (vivosDeVerdad.some((id) => tipoDe(id) === 'minion')) automaticos.add('esbirros');
    if (vivosDeVerdad.some((id) => tipoDe(id) === 'demon')) automaticos.add('demonios');
    // El Caníbal (vivo) tiene la habilidad del muerto que lleva su recordatorio «Lunch»:
    // ese personaje también se despierta (en su sitio del orden de noche)
    const canibalVivo = e.asientos.some((a) => sigueVivo(a) && (a.personaje === 'cannibal' || identidadDe(a).personaje === 'cannibal'));
    const porCanibal = canibalVivo
      ? e.asientos
          .filter((a) => a.muerto && a.recordatorios.some((r) => r.personaje === 'cannibal' && /\blunch\b/i.test(r.texto)))
          .flatMap((a) => (identidadDe(a).personaje ? [identidadDe(a).personaje!] : []))
      : [];
    for (const id of porCanibal) automaticos.add(id);
    const cambios = e.recordatoriosNoche;
    const activo = (id: string) => cambios[id] ?? automaticos.has(id);
    // Los viajeros en juego (vivos o muertos), en el orden de los asientos, sin repetir
    const viajeros = [
      ...new Set(e.asientos.flatMap((a) => (a.personaje && tipoDe(a.personaje) === 'traveller' ? [a.personaje] : []))),
    ];
    return {
      activos: [...new Set([...automaticos, ...Object.keys(cambios)])].filter(activo),
      porCanibal,
      viajeros,
      onAlternar: (id: string) => {
        void pedirPropio('narrador:recordatorio', { id, activo: !activo(id) }).then((r) => {
          if (!r.ok) setAviso(r.error);
        });
      },
      despertar: (id: string): DespertarFila | undefined => {
        const h = e.habilidadesNoche.find((x) => x.personaje === id);
        if (!h) return undefined;
        return {
          estado: h.estado,
          avisos: h.avisos.map((a) => describirAviso(contextoHabilidades(e), a)),
          onPulsar: () => void despertarHabilidad(h),
        };
      },
    };
  };
  // El despertar guiado (ver SalaHabilidadNoche): cómo se dice lo que avisa el servidor
  const contextoHabilidades = (e: SalaEstado): ContextoHabilidades => ({
    estado: e,
    porId: personajesGuionPorId,
    indiceRecordatorio: (personaje, texto) =>
      guion?.personajes.find((p) => p.id === personaje)?.recordatorios.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1,
  });
  // Listo: se hace solo (y se dice qué). Si no, se abre su despertar (para revisarlo o verlo)
  const despertarHabilidad = async (h: SalaHabilidadNoche) => {
    if (h.estado !== 'listo') return abrirDespertar(h.asiento);
    const r = await pedirPropio('narrador:despertarHabilidad', { personajeId: h.personaje });
    if (!r.ok) return setAviso(r.error);
    const nombre = personajesGuionPorId.get(h.personaje)?.nombre.texto ?? h.personaje;
    const enviado = h.opciones[0] ? describirMensaje(h.opciones[0].envio, estado!, personajesGuionPorId) : '';
    anunciar('despertar', enviado ? `${nombre}: enviado ${enviado}.` : `${nombre}: despertado.`);
  };
  // Los despertares guiados que el narrador tiene que revisar, por asiento (ver VentanaDespertar)
  const revisionesDe = (e: SalaEstado) => {
    const c = contextoHabilidades(e);
    return new Map(
      e.habilidadesNoche
        .filter((h) => h.estado === 'revisar')
        .map((h): [string, Revision] => [
          h.asiento,
          {
            personajeId: h.personaje,
            nombre: personajesGuionPorId.get(h.personaje)?.nombre ?? { texto: h.personaje, lang: 'en' },
            avisos: h.avisos.map((a) => describirAviso(c, a)),
            propuestas: h.opciones.map((o) => ({ envio: aEnvio(o.envio), ...describirOpcion(c, o) })),
          },
        ]),
    );
  };
  // Todos los del guion (también los que no van en fichas), para los mensajes al despertar.
  const personajesGuionRef = useRef<Map<string, PersonajeMostrado>>(new Map());
  // Los legendarios y lóricos que pueden ser NPCs (para decir sus nombres al ponerlos o quitarlos)
  const npcsPorIdRef = useRef<Map<string, PersonajeMostrado>>(new Map());

  // Mensajes de texto: la conversación que se ve, las privadas abiertas (aún sin
  // mensajes), hasta cuándo se ha leído cada una y las ondas de los susurros.
  const [canalChat, setCanalChat] = useState<string | null>(null);
  const [privadosAbiertos, setPrivadosAbiertos] = useState<string[]>([]);
  const [leidoHasta, setLeidoHasta] = useState<Record<string, number>>({});
  const [ondas, setOndas] = useState<OndaMesa[]>([]);
  const ondaIdRef = useRef(0);
  const entradaChatRef = useRef<HTMLInputElement>(null);
  // Si el panel de mensajes es el que se ve en la columna de la izquierda (lo que llega, queda leído)
  const chatVisibleRef = useRef(true);

  const alMensaje = (m: SalaMensaje) => {
    if (!estado) return;
    // Un privado entre jugadores (solo les llega a los narradores): va a Susurros
    const ajeno = esAjeno(m.canal, estado.yo);
    const pestana = ajeno ? CANAL_SUSURROS : m.canal;
    // Leído si llega a la conversación que se está viendo
    if (pestana === canalActual && chatVisibleRef.current) setLeidoHasta((l) => ({ ...l, [pestana]: m.hora }));
    if (m.autor === estado.yo) return;
    if (ajeno) {
      anunciar('susurros', `${deQuienAQuien(m, estado.participantes, mensajes)}: ${m.texto}`);
      return;
    }
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
    // Los narradores no: leen el mensaje entero (alMensaje)
    const narro = estado.participantes.find((p) => p.id === estado.yo)?.rol === 'narrador';
    if (!narro && emisor && receptor && emisor.id !== estado.yo && receptor.id !== estado.yo) {
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
    pedirUnirse,
    responderInvitacion,
    cancelarInvitacion,
    escucharConversacion,
    entrarConversacion,
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
  const privadosChat = yo ? privadosPropios(mensajes, privadosAbiertos, yo.id) : [];
  const canalesChat = yo ? [...canalesComunes(yo), ...privadosChat] : [];
  const canalActual = canalChat && canalesChat.includes(canalChat) ? canalChat : (canalesChat[0] ?? null);

  // Al cambiar de papel cambia lo que se puede leer: se vuelve a pedir el historial
  const miRol = yo?.rol;
  useEffect(() => {
    if (miRol) pedirHistorial();
  }, [miRol, pedirHistorial]);

  // Cambiar de conversación: lo que había en las dos queda leído (hasta su último mensaje)
  const ultimoDe = (canal: string) =>
    Math.max(0, ...mensajesDe(mensajes, canal, estado?.yo ?? '').map((m) => m.hora));
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
    cambiarPreferencias({ panelLateral: 'mensajes', panelLateralContraido: false });
    elegirCanal(canal);
    window.setTimeout(() => entradaChatRef.current?.focus(), 0);
  };
  const mensajePara = (otro: SalaParticipante) =>
    estado && yo && puedeEscribirA(estado, yo, otro) ? () => abrirPrivado(otro.id) : undefined;

  const {
    preferencias,
    cambiar: cambiarPreferencias,
    reemplazar: reemplazarPreferencias,
  } = usePreferencias(!!cuenta);
  useEffect(() => setSonidosActivos(preferencias.sonidos), [preferencias.sonidos]);
  useEffect(() => setTonoLlamada(preferencias.tonoLlamada), [preferencias.tonoLlamada]);

  // El fondo: el de la sala (el del guion o el que ha elegido el narrador; sin él, el
  // de La Secta) o el que ha elegido cada uno en Preferencias > Interfaz (ver fondos.ts)
  const fondoSala = estado?.configuracion.fondo ?? null;
  const fondoDeLaSala = fondoSala ? urlDelServidor(fondoSala) : null;
  const fondoVisto = rutaFondo(preferencias.fondo, fondoDeLaSala);
  useEffect(() => {
    document.documentElement.style.setProperty('--sala-fondo', `url("${fondoVisto}")`);
    return () => {
      document.documentElement.style.removeProperty('--sala-fondo');
    };
  }, [fondoVisto]);
  // De noche, el fondo se oscurece con un velo de medianoche (ver sala.css)
  const esNoche = estado?.fase.momento === 'noche';
  useEffect(() => {
    document.documentElement.toggleAttribute('data-noche', esNoche);
    return () => document.documentElement.removeAttribute('data-noche');
  }, [esNoche]);

  // Videollamada: cámaras y micrófonos en la mesa y en la conversación privada
  // La conversación en la que estoy: hablando (miembro) o escuchando (visitante)
  // Despertares. El narrador tiene abiertos en su ventana los que quiere (una pestaña
  // cada uno) y, por asiento, hasta qué mensaje del jugador ha visto (para iluminar
  // la luna de la ficha). El jugador ve el suyo en una ventana modal que puede cerrar;
  // mientras está abierta, los avisos se dicen dentro (lo de fuera de un modal no se lee).
  const despertares = estado?.despertares ?? [];
  const narro = yo?.rol === 'narrador';
  // Los visitantes que ven el grimorio también ven los despertares (solo para leer)
  const veoDespertares = narro || (yo?.rol === 'visitante' && yo.accesoGrimorio === 'concedido');
  const abiertosNarrador = veoDespertares
    ? wakesAbiertos.map((id) => despertares.find((d) => d.asiento === id)).filter((d): d is SalaDespertar => !!d)
    : [];
  const activoNarrador = abiertosNarrador.some((d) => d.asiento === wakeActivo) ? wakeActivo : (abiertosNarrador[0]?.asiento ?? null);
  const ultimaDelJugador = (asientoId: string) =>
    Math.max(0, ...(despertares.find((d) => d.asiento === asientoId)?.mensajes ?? []).filter((m) => m.autor !== 'narrador').map((m) => m.hora));
  const noLeidos = new Set(
    despertares
      .filter((d) => d.asiento !== activoNarrador && ultimaDelJugador(d.asiento) > (leidoWake[d.asiento] ?? 0))
      .map((d) => d.asiento),
  );
  const marcarLeido = (asientoId: string | null) => {
    if (asientoId) setLeidoWake((l) => ({ ...l, [asientoId]: ultimaDelJugador(asientoId) }));
  };
  const activarDespertar = (asientoId: string) => {
    if (asientoId !== activoNarrador) marcarLeido(activoNarrador);
    setWakeActivo(asientoId);
  };
  // Abre (o crea, de noche) el despertar de un asiento y lleva el foco a su ventana
  const abrirDespertar = async (asientoId: string) => {
    if (!estado) return;
    if (!estado.despertares.some((d) => d.asiento === asientoId)) {
      const r = await pedirPropio('narrador:despertar', { asientoId });
      if (!r.ok) {
        setAviso(r.error);
        return;
      }
    }
    setWakesAbiertos((a) => (a.includes(asientoId) ? a : [...a, asientoId]));
    activarDespertar(asientoId);
    focoPendienteRef.current = ID_TITULO_DESPERTAR;
  };
  // Cierra su ventana (el despertar sigue): el foco va al siguiente abierto o a la luna de la ficha
  const cerrarDespertar = (asientoId: string) => {
    marcarLeido(asientoId);
    const quedan = abiertosNarrador.map((d) => d.asiento).filter((id) => id !== asientoId);
    setWakesAbiertos(quedan);
    setWakeActivo(quedan[0] ?? null);
    focoPendienteRef.current = quedan.length ? ID_TITULO_DESPERTAR : idLunaFicha(asientoId);
  };
  const miDespertar = yo?.rol === 'jugador' ? despertares[0] : undefined;
  const despiertoYo = !!miDespertar && !wakeCerradoJugador;
  // Me toca señalar (un señalamiento sin congelar): la ventana del despertar se esconde
  // para que se vean y se pulsen las fichas; al congelarse, vuelve
  const senalCongelada = useSenalamientoCongelado(estado?.senalamiento ?? null, desfaseReloj);
  const senalandoYo = !!estado?.senalamiento && !senalCongelada && !!estado.acciones.includes('jugador:senalar');

  // Elegir a un jugador del despertar en la plaza (Preferencias > Accesibilidad): la
  // ventana del despertar se esconde, las fichas se pulsan para elegir y, al elegir
  // (o cancelar con Escape o «Cancelar»), vuelve como estaba y el foco, al botón que lo pidió.
  const [eleccion, setEleccion] = useState<(Omit<PedidoEleccion, 'volver'> & { volver: HTMLElement | null }) | null>(null);
  const focoEleccionRef = useRef<HTMLElement | string | null>(null);
  useEffect(() => {
    const destino = focoEleccionRef.current;
    if (!destino) return;
    focoEleccionRef.current = null;
    (typeof destino === 'string' ? document.getElementById(destino) : destino)?.focus();
  }, [eleccion]);
  const elegirEnPlaza =
    preferencias.eleccionDespertar === 'plaza' && estado
      ? (pedido: PedidoEleccion) => {
          const primera = estado.asientos.find((a) => !pedido.excluidos.includes(a.id));
          if (!primera) return anunciar('despertar', 'Ya están elegidos todos los jugadores.');
          const volver = (pedido.volver && document.getElementById(pedido.volver)) || document.activeElement;
          setEleccion({ ...pedido, volver: volver instanceof HTMLElement ? volver : null });
          focoEleccionRef.current = idFichaNominar(primera.id);
          anunciar('despertar', `Elige en la plaza un jugador para «${pedido.titulo}»: pulsa su ficha. Escape para cancelar.`);
        }
      : null;
  const terminarEleccion = (aviso: string) => {
    focoEleccionRef.current = eleccion?.volver ?? null;
    setEleccion(null);
    // Después de que vuelva la ventana (su aviso, si es el del jugador, va en ella)
    window.setTimeout(() => anunciar('despertar', aviso), 100);
  };
  const elegidoEnPlaza = (asientoId: string) => {
    if (!eleccion || !estado) return;
    eleccion.onElegido(asientoId);
    terminarEleccion(`Añadido: ${nombreDeAsiento(estado, asientoId)}.`);
  };
  const cancelarEleccion = () => terminarEleccion('Elección cancelada.');
  // Escape cancela mientras se elige (el despertar del jugador, escondido, no lo atiende)
  useEffect(() => {
    if (!eleccion) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      cancelarEleccion();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  });
  const miConversacion =
    estado?.conversaciones.find((c) => c.miembros.includes(estado.yo) || c.oyentes.includes(estado.yo)) ?? null;
  const hablaEnConversacion = !!miConversacion?.miembros.includes(estado?.yo ?? '');
  const puedeEmitirVideo = yo?.rol === 'jugador' || yo?.rol === 'narrador';
  const noche = estado?.fase.momento === 'noche';
  // Silencio del narrador (Bibliotecario del Infierno): los jugadores no pueden hablar
  const callado = !!estado?.silencio && yo?.rol === 'jugador';
  // Sonido envolvente: cada voz desde el ángulo de su asiento en la plaza (por id de quien se sienta)
  const asientosSala = estado?.asientos;
  const posicionesVoz = useMemo(() => {
    const posiciones = new Map<string, number>();
    asientosSala?.forEach((a, i, todos) => {
      if (a.ocupante) posiciones.set(a.ocupante, anguloAsiento(i, todos.length));
    });
    return posiciones;
  }, [asientosSala]);
  const envolvente = useMemo(
    () => (preferencias.sonidoEnvolvente ? { salida: preferencias.salidaAudio, posiciones: posicionesVoz } : null),
    [preferencias.sonidoEnvolvente, preferencias.salidaAudio, posicionesVoz],
  );
  const video = useVideollamada({
    activa: !!estado?.video && conexion === 'conectada',
    puedeEmitir: puedeEmitirVideo,
    noche,
    conversacion: miConversacion?.id ?? null,
    hablaEnConversacion,
    camaraEnMesaConversando: estado?.configuracion.ocultarCamarasConversacion === false,
    silenciado: callado,
    idCamara: preferencias.idCamara,
    idMicrofono: preferencias.idMicrofono,
    pedirPase: pedirPaseVideo,
    envolvente,
  });
  // De noche, fuera de una conversación privada, no hay cámaras
  const sinCamaraDeNoche = noche && !hablaEnConversacion;
  const tituloConversacionRef = useRef<HTMLHeadingElement>(null);

  // Invitar a conversar (a una nueva o a la propia). De día, jugadores y narradores;
  // de noche, el narrador a cualquiera y los jugadores solo al narrador (no ven si ya
  // conversa con otro: su invitación espera). Quien ya está en otra no se puede invitar.
  const conversa = (p: SalaParticipante) => p.rol === 'jugador' || p.rol === 'narrador';
  // Con la Institutriz viva: un jugador solo conversa con sus vecinos (tiene que serlo de
  // todos los jugadores de la conversación en la que entra)
  const vecinoDeTodos = (quien: string, con: string[]) =>
    !estado?.institutriz ||
    con.every((id) => id === quien || estado.participantes.find((p) => p.id === id)?.rol !== 'jugador' || sonVecinos(estado, quien, id));
  const puedeInvitarA = (otro: SalaParticipante) => {
    if (!estado?.video || !yo || yo.id === otro.id) return false;
    if (!conversa(yo) || !conversa(otro)) return false;
    if (noche && yo.rol !== 'narrador' && otro.rol !== 'narrador') return false;
    const mia = estado.conversaciones.find((c) => c.miembros.includes(yo.id));
    if (otro.rol === 'jugador' && !vecinoDeTodos(otro.id, mia ? mia.miembros : [yo.id])) return false;
    return !estado.conversaciones.some((c) => c.miembros.includes(otro.id));
  };
  // Pedir unirse a la conversación de alguien (con las mismas reglas que invitar)
  const puedePedirUnirseA = (otro: SalaParticipante) => {
    if (!estado?.video || !yo || yo.id === otro.id) return false;
    if (!conversa(yo) || !conversa(otro)) return false;
    if (noche && yo.rol !== 'narrador') return false;
    const suya = estado.conversaciones.find((c) => c.miembros.includes(otro.id));
    if (suya && yo.rol === 'jugador' && !vecinoDeTodos(yo.id, suya.miembros)) return false;
    return !!suya && !suya.miembros.includes(yo.id);
  };
  const pedirUnirseA = async (otro: SalaParticipante) => {
    const r = await pedirUnirse(otro.id);
    if (!r.ok) setAviso(r.error);
    else anunciar('conversaciones', `Petición enviada para unirte a la conversación de ${otro.nombre}.`);
  };
  const invitar = async (otro: SalaParticipante) => {
    const r = await invitarAConversar(otro.id);
    if (!r.ok) setAviso(r.error);
    else anunciar('conversaciones', `Invitación enviada a ${otro.nombre}.`);
  };
  // Aceptar: se entra en la conversación y el foco va a su título; rechazar: nada más
  const responder = async (invitacionId: string, aceptar: boolean) => {
    if (aceptar) dejarDeSeguir();
    const r = await responderInvitacion(invitacionId, aceptar);
    if (!r.ok) setAviso(r.error);
    else if (aceptar) window.setTimeout(() => tituloConversacionRef.current?.focus(), 0);
    else window.setTimeout(() => tituloRef.current?.focus(), 0);
  };
  // Retirar es propio: no se avisa de que «no la han aceptado»
  const retirar = async (invitacionId: string) => {
    accionPropiaRef.current = true;
    const r = await cancelarInvitacion(invitacionId);
    if (!r.ok) {
      accionPropiaRef.current = false;
      setAviso(r.error);
    }
    else window.setTimeout(() => tituloRef.current?.focus(), 0);
  };
  // Seguir a un jugador (visitantes y narradores, desde su ficha): ir con él a sus
  // conversaciones privadas, como oyente, y volver a la mesa cuando sale. Mientras
  // uno habla en una conversación no se mueve; escuchar, salir o aceptar una
  // invitación a mano deja de seguirle. Si deja de jugar, se deja de seguir.
  const [siguiendo, setSiguiendo] = useState<string | null>(null);
  const puedeSeguir = !!estado?.video && (yo?.rol === 'visitante' || yo?.rol === 'narrador');
  const seguido = siguiendo ? estado?.participantes.find((p) => p.id === siguiendo) : undefined;
  const sigoA = puedeSeguir && seguido?.rol === 'jugador' ? seguido : null;
  const alternarSeguir = (jugador: SalaParticipante) => setSiguiendo((s) => (s === jugador.id ? null : jugador.id));
  const dejarDeSeguir = (salvoConversacion?: string) => {
    if (!sigoA) return;
    const suya = estado?.conversaciones.find((c) => c.miembros.includes(sigoA.id));
    if (salvoConversacion && suya?.id === salvoConversacion) return;
    setSiguiendo(null);
    anunciar('conversaciones', `Dejas de seguir a ${sigoA.nombre}.`);
  };
  // Adónde hay que ir: la conversación del seguido o la mesa ('mesa')
  const destinoSeguir =
    sigoA && !hablaEnConversacion
      ? (estado?.conversaciones.find((c) => c.miembros.includes(sigoA.id))?.id ?? 'mesa')
      : null;
  const dondeEstoy = miConversacion && !hablaEnConversacion ? miConversacion.id : 'mesa';
  const pidiendoSeguirRef = useRef<string | null>(null);
  useEffect(() => {
    if (!destinoSeguir || destinoSeguir === dondeEstoy) {
      pidiendoSeguirRef.current = null;
      return;
    }
    if (pidiendoSeguirRef.current === destinoSeguir) return;
    pidiendoSeguirRef.current = destinoSeguir;
    // Volviendo a la mesa, la ventana de la conversación desaparece: si tenía el foco, va al título
    const focoDentro = !!document.activeElement?.closest('[aria-labelledby="sala-conversacion-titulo"]');
    const peticion = destinoSeguir === 'mesa' ? salirConversacion() : escucharConversacion(destinoSeguir);
    void peticion.then((r) => {
      if (!r.ok) setAviso(r.error);
      else if (destinoSeguir === 'mesa' && focoDentro) window.setTimeout(() => tituloRef.current?.focus(), 0);
    });
  }, [destinoSeguir, dondeEstoy, salirConversacion, escucharConversacion]);

  // Visitantes: escuchar la conversación de alguien (sin invitación; los jugadores no lo saben)
  const escuchar = async (conversacionId: string) => {
    dejarDeSeguir(conversacionId);
    const r = await escucharConversacion(conversacionId);
    if (!r.ok) setAviso(r.error);
    else window.setTimeout(() => tituloConversacionRef.current?.focus(), 0);
  };
  // Narradores: entrar en una conversación como uno más (también desde escucharla)
  const entrar = async (conversacionId: string) => {
    dejarDeSeguir();
    // Propia: no se avisa (el foco va al título, que ya dice con quién)
    accionPropiaRef.current = true;
    const r = await entrarConversacion(conversacionId);
    if (!r.ok) {
      accionPropiaRef.current = false;
      setAviso(r.error);
    } else window.setTimeout(() => tituloConversacionRef.current?.focus(), 0);
  };
  const salirDeConversacion = async () => {
    dejarDeSeguir();
    const r = await salirConversacion();
    if (!r.ok) setAviso(r.error);
    // La conversación desaparece: el foco vuelve al título de la página
    else window.setTimeout(() => tituloRef.current?.focus(), 0);
  };
  // Quitar el sonido (no oír a los demás) se ve junto al nombre: se le dice al servidor
  // cuando cambia, y también si al volver a entrar no coincide con lo que tiene
  const sinSonidoAqui = !video.sonido;
  const sinSonidoServidor = yo?.sinSonido;
  useEffect(() => {
    if (sinSonidoServidor === undefined || sinSonidoServidor === sinSonidoAqui) return;
    void pedir('sala:sonido', { sinSonido: sinSonidoAqui });
  }, [sinSonidoAqui, sinSonidoServidor, pedir]);

  // Los sonidos de las conversaciones privadas: al entrar (o cambiar de una a otra), al
  // salir y cuando sale alguien con quien se hablaba. Al cargar la página, ninguno.
  const miembrosConversacion = miConversacion?.miembros.filter((id) => id !== estado?.yo).join(',') ?? '';
  const conversacionAntesRef = useRef<{ id: string; otros: string[] } | null | undefined>(undefined);
  useEffect(() => {
    if (!estado) return;
    const antes = conversacionAntesRef.current;
    const ahora = miConversacion ? { id: miConversacion.id, otros: miembrosConversacion ? miembrosConversacion.split(',') : [] } : null;
    conversacionAntesRef.current = ahora;
    if (antes === undefined) return;
    if (ahora && (!antes || antes.id !== ahora.id)) tocarPrivado('entrarPrivado');
    else if (antes && !ahora) tocarPrivado('salirPrivado');
    else if (antes && ahora && antes.otros.some((id) => !ahora.otros.includes(id))) tocarPrivado('saleOtro');
    // Compara con lo de antes: solo suena si cambian la conversación o quienes hablan en ella
  }, [estado, miConversacion, miembrosConversacion]);
  // Si se van los demás, la conversación sigue hasta que uno sale; salvo que haya
  // elegido salir automáticamente (Preferencias > Comunicaciones). El foco solo se
  // mueve si estaba en la ventana de la conversación, que desaparece.
  const sinNadieMas = hablaEnConversacion && miConversacion?.miembros.length === 1;
  const salidaAutomaticaRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sinNadieMas || !preferencias.salirConversacionSinNadie || !miConversacion) return;
    if (salidaAutomaticaRef.current === miConversacion.id) return;
    salidaAutomaticaRef.current = miConversacion.id;
    const focoDentro = !!document.activeElement?.closest('[aria-labelledby="sala-conversacion-titulo"]');
    void salirConversacion().then((r) => {
      if (!r.ok) setAviso(r.error);
      else if (focoDentro) window.setTimeout(() => tituloRef.current?.focus(), 0);
    });
  }, [sinNadieMas, preferencias.salirConversacionSinNadie, miConversacion, salirConversacion]);
  /**
   * Lo que se puede hacer con alguien desde su nombre: escribirle y conversar
   * (invitarle, o «invitación enviada» mientras no responde) o, si soy visitante
   * y está conversando, escuchar su conversación.
   */
  // El nombre del botón cambia («Dejar de vigilar a…»), pero no todos los lectores
  // lo releen: se confirma.
  const alternarVigilar = (otro: SalaParticipante) => {
    const vigilaba = vigilados.has(otro.id);
    setVigilados((v) => {
      const nuevos = new Set(v);
      if (vigilaba) nuevos.delete(otro.id);
      else nuevos.add(otro.id);
      return nuevos;
    });
    anunciar('manos', vigilaba ? `Dejas de vigilar a ${otro.nombre}.` : `Vigilas a ${otro.nombre}.`);
  };
  // La llamada estilo botc.app (Preferencias > Interfaz): Intro muestra (o quita) los
  // botones de llamar y escribir en los cuadros; Escape los quita. Solo si Intro no es
  // de otra cosa (un botón, un campo, un diálogo). Al usar uno, se esconden.
  const [iconosLlamada, setIconosLlamada] = useState(false);
  const llamadaBotc = preferencias.llamadaBotc;
  useEffect(() => {
    if (!llamadaBotc) {
      setIconosLlamada(false);
      return;
    }
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.key !== 'Enter' && e.key !== 'Escape') || !esTeclaLlamadaBotc(e)) return;
      const ahora = e.key === 'Enter' ? !iconosLlamada : false;
      if (ahora === iconosLlamada) return;
      setIconosLlamada(ahora);
      anunciar('conversaciones', ahora ? 'Botones de llamada a la vista.' : 'Botones de llamada ocultos.');
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llamadaBotc, iconosLlamada]);
  const contextoLlamadaBotc = useMemo(
    () => ({ activa: llamadaBotc, visibles: llamadaBotc && iconosLlamada, ocultar: () => setIconosLlamada(false) }),
    [llamadaBotc, iconosLlamada],
  );
  const contacto = (otro: SalaParticipante): ContactoParticipante | undefined => {
    const onMensaje = mensajePara(otro);
    let conversar: ContactoParticipante['conversar'];
    if (estado?.video && yo?.rol === 'visitante') {
      const suya = estado.conversaciones.find((c) => c.miembros.includes(otro.id));
      if (suya && suya.id !== miConversacion?.id) {
        conversar = { etiqueta: `Escuchar la conversación de ${otro.nombre}`, onIniciar: () => void escuchar(suya.id) };
      }
    } else if (estado?.invitaciones.some((i) => i.de === estado.yo && i.para === otro.id && !i.conversacion)) {
      conversar = { etiqueta: `Invitación enviada a ${otro.nombre}`, pendiente: true };
    } else if (puedeInvitarA(otro)) {
      conversar = {
        etiqueta: hablaEnConversacion ? `Invitar a ${otro.nombre} a la conversación` : `Invitar a ${otro.nombre} a conversar`,
        onIniciar: () => void invitar(otro),
      };
    } else if (puedePedirUnirseA(otro)) {
      // Ya conversa con otros: en vez de invitarle, se pide entrar en su conversación
      // (los narradores no piden: entran)
      const suya = estado!.conversaciones.find((c) => c.miembros.includes(otro.id))!;
      conversar = yo?.rol === 'narrador'
        ? { etiqueta: `Entrar en la conversación de ${otro.nombre}`, onIniciar: () => void entrar(suya.id), unirse: true }
        : estado!.invitaciones.some((i) => i.de === estado!.yo && i.conversacion === suya.id)
        ? { etiqueta: `Petición enviada para unirte a la conversación de ${otro.nombre}`, pendiente: true, unirse: true }
        : { etiqueta: `Pedir unirte a la conversación de ${otro.nombre}`, onIniciar: () => void pedirUnirseA(otro), unirse: true };
    }
    // Vigilar su mano (solo jugadores, que son quienes la levantan; uno mismo no)
    const vigilar =
      otro.rol === 'jugador' && otro.id !== estado?.yo
        ? { activo: vigilados.has(otro.id), onAlternar: () => alternarVigilar(otro) }
        : undefined;
    return onMensaje || conversar || vigilar ? { onMensaje, conversar, vigilar } : undefined;
  };

  // Micrófono y cámara con atajo (sin el foco en el botón): se dice cómo quedan
  const alternarMicrofonoConAtajo = () => {
    if (callado) {
      anunciar('comunicaciones', 'El narrador ha pedido silencio: no puedes hablar.');
      return;
    }
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
  // La habilidad (la pista de las fichas, la de los NPCs), en el idioma de las descripciones
  const traduccionesDescripciones = useTraducciones(preferencias.idiomaDescripciones, preferencias.genero);
  // (Sin useMemo: el compilador de React ya memoriza lo que no cambia)
  const personajesGuion = guion ? mostrarPersonajes(guion.personajes, traduccionesNombres, traduccionesDescripciones) : [];
  // Los viajeros del catálogo que no trae el guion: se pueden poner en una ficha o meter en la bolsa
  const viajerosCatalogo = guion ? mostrarPersonajes(guion.viajeros ?? [], traduccionesNombres, traduccionesDescripciones) : [];
  const personajesGuionPorId = new Map([...personajesGuion, ...viajerosCatalogo].map((p) => [p.id, p]));
  // NPCs: los legendarios y lóricos del guion y los del catálogo
  const npcsDisponibles = guion
    ? mostrarPersonajes(
        [...guion.personajes.filter((p) => p.tipo === 'fabled' || p.tipo === 'loric'), ...(guion.npcs ?? [])],
        traduccionesNombres,
        traduccionesDescripciones,
      )
    : [];
  // Las reglas del Djinn del guion, con sus dos personajes (en la tarjeta del Djinn)
  const reglasDjinn = (guion?.djinn ?? []).flatMap((r) => {
    const a = personajesGuionPorId.get(r.personajes[0]);
    const b = personajesGuionPorId.get(r.personajes[1]);
    return a && b ? [{ personajes: [a, b] as [PersonajeMostrado, PersonajeMostrado], texto: r.texto }] : [];
  });
  const personajesFichas = personajesGuion.filter((p) => TIPOS_EN_FICHA.includes(p.tipo));
  // Los del catálogo (no del guion) que están en juego: viajeros en alguna ficha y NPCs
  const idsEnJuego = new Set([...(estado?.asientos.map((a) => a.personaje) ?? []), ...(estado?.npcs ?? [])]);
  const enGuion = new Set(personajesGuion.map((p) => p.id));
  const extrasEnJuego = [...viajerosCatalogo, ...npcsDisponibles].filter((p) => !enGuion.has(p.id) && idsEnJuego.has(p.id));
  const contextoFichas: ContextoFichas = {
    hayGuion: !!guion,
    personajes: personajesFichas,
    // Los del guion primero (en su orden) y luego los demás
    viajeros: [...personajesFichas.filter((p) => p.tipo === 'traveller'), ...viajerosCatalogo],
    porId: new Map([...personajesFichas, ...viajerosCatalogo].map((p) => [p.id, p])),
    notas: notasGrimorio,
    anotar: (asientoId, contenido) => setNotasGrimorio((n) => ({ ...n, [asientoId]: contenido })),
    // Los del guion y los del catálogo que están en juego (viajeros en una ficha, NPCs):
    // también llevan recordatorios
    todos: [...personajesGuion, ...extrasEnJuego],
    todosPorId: new Map([...personajesGuion, ...viajerosCatalogo, ...npcsDisponibles].map((p) => [p.id, p])),
    notasRecordatorios,
    anotarRecordatorios: (asientoId, lista) => setNotasRecordatorios((n) => ({ ...n, [asientoId]: lista })),
    notasEscritas,
    escribirNota: (asientoId, nota) =>
      setNotasEscritas((n) => {
        const nuevas = { ...n };
        if (nota === null) delete nuevas[asientoId];
        else nuevas[asientoId] = nota;
        return nuevas;
      }),
  };


  useEffect(() => {
    nombresPersonajesRef.current = contextoFichas.porId;
    personajesGuionRef.current = personajesGuionPorId;
    npcsPorIdRef.current = new Map(npcsDisponibles.map((p) => [p.id, p]));
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
  // Muerto y sin voto: no puede levantar la mano (el atajo lo dice sin preguntar al servidor)
  const asientoPropio = estado?.asientos.find((a) => a.ocupante === estado.yo);
  // (la Banshee con su habilidad, que puede levantar las dos, vota sin gastarlo). Con el
  // Voudon vivo, solo votan él y los muertos, sin hacerles falta el voto.
  const soyVoudon = asientoPropio?.personaje === 'voudon';
  // En la expulsión de un viajero vota cualquiera (los muertos, sin gastar su voto).
  const sinVoto = estado?.nominacion?.expulsion
    ? false
    : estado?.voudon
    ?!!asientoPropio && !asientoPropio.muerto && !soyVoudon
    : !!asientoPropio?.muerto && asientoPropio.votoGastado && !estado?.acciones.includes('sala:levantarDosManos');
  // La Banshee muerta con su habilidad puede levantar las dos manos (vota doble): 0, 1 o 2
  const puedeDosManos = !!estado?.acciones.includes('sala:levantarDosManos');
  const manos: 0 | 1 | 2 = !manoLevantada ? 0 : yo?.dosManos ? 2 : 1;
  // Mientras se señala (si lo veo), las manos no se levantan: las de señalar van en las fichas
  const senalandoMano = !!estado?.senalamiento;
  const ponerManos = async (n: 0 | 1 | 2) => {
    if (n > 0 && senalandoMano) {
      setAviso('Mientras se señala no se puede levantar la mano.');
      return false;
    }
    if (n > 0 && sinVoto) {
      setAviso(estado?.voudon ? 'Con el Voudon vivo, solo votan él y los muertos.' : 'Ya has gastado tu voto: no puedes levantar la mano.');
      return false;
    }
    const r = await (n === 2 ? pedir('sala:levantarDosManos') : pedir('sala:levantarMano', { levantada: n === 1 }));
    if (r.ok) anunciar('miMano', n === 2 ? 'Has levantado las dos manos.' : n === 1 ? 'Has levantado la mano.' : manos === 2 ? 'Has bajado las manos.' : 'Has bajado la mano.');
    else setAviso(r.error);
    // false: el menú (si se ha usado) se cierra y el foco vuelve a su botón.
    return false;
  };
  // La tecla: levantar y bajar o, con dos manos, una, dos y bajarlas
  const siguientesManos: 0 | 1 | 2 = manos === 0 ? 1 : manos === 1 && puedeDosManos ? 2 : 0;
  const alternarMano = () => ponerManos(siguientesManos);
  const elegirFormaMano = async (forma: FormaMano) => {
    const r = await pedir('sala:elegirMano', { forma });
    if (r.ok) anunciar('miMano', `Tu mano: ${nombreMano(forma, personajesGuionPorId).toLocaleLowerCase('es')}.`);
    else setAviso(r.error);
    return false;
  };
  const { atajos, cambiar: cambiarAtajo, reemplazar: reemplazarAtajos } = useAtajos();
  const { gestos, cambiar: cambiarGesto, reemplazar: reemplazarGestos } = useGestos();
  // La tecla rápida que coge una llamada entrante (la de su slot), si tiene.
  const teclaLlamada = (invitacionId: string): Atajo | undefined => {
    const slot = slotsLlamada[invitacionId];
    return slot === undefined ? undefined : atajos[accionCogerLlamada(slot)];
  };

  // Con cuenta, la configuración se guarda en el servidor (los invitados no guardan nada).
  const configuracionActual: ConfiguracionSala = {
    preferencias: sinComunicaciones(preferencias),
    avisos: avisosActivos,
    atajos,
    gestos,
  };
  const aplicarConfiguracion = (datos: Partial<Record<keyof ConfiguracionSala, unknown>>) => {
    reemplazarPreferencias(datos.preferencias);
    reemplazarAvisos(datos.avisos);
    reemplazarAtajos(datos.atajos);
    reemplazarGestos(datos.gestos);
  };
  const {
    carga: cargaConfiguracion,
    perfiles,
    guardarPerfil: guardarPerfilConfiguracion,
    borrarPerfil: borrarPerfilConfiguracion,
  } = useConfiguracionCuenta(cuenta?.token ?? null, configuracionActual, aplicarConfiguracion);
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

  // El diálogo de revelar el grimorio: desde el menú del narrador o con su tecla
  const [revelandoGrimorio, setRevelandoGrimorio] = useState(false);
  // Una ejecución que deja solo dos jugadores vivos no anochece sola: quien ejecutó
  // elige entre la noche y revelar el grimorio (DialogoFinal)
  const [decidiendoFinal, setDecidiendoFinal] = useState(false);
  const pedirEnMesa = async (accion: string, datos?: unknown) => {
    const r = await pedirPropio(accion, datos);
    if (accion === 'narrador:ejecutar' && r.ok && r.valor === 'final') setDecidiendoFinal(true);
    return r;
  };

  // El gong del narrador: desde el menú o con su tecla
  const sonarGong = async () => {
    const r = await pedirPropio('narrador:sonarGong');
    if (!r.ok) setAviso(r.error);
  };

  // El reloj del narrador: su diálogo se abre desde el menú o con su tecla
  const [poniendoReloj, setPoniendoReloj] = useState(false);
  // Con su tecla (Preferencias > Accesibilidad): lo que queda y el mensaje. Se lee
  // siempre (lo ha pedido) y al momento, aunque sea lo mismo que la última vez.
  const leerReloj = () => {
    const reloj = estado?.reloj;
    const queda = reloj ? reloj.fin - (Date.now() + desfaseReloj) : 0;
    if (!reloj || queda < -RELOJ_TRAS_FIN_MS) return anunciarUrgente('No hay ningún reloj.');
    const mensaje = reloj.mensaje ? ` ${reloj.mensaje}.` : '';
    if (queda <= 0) return anunciarUrgente(`Se acabó el tiempo.${mensaje}`);
    const segundos = Math.ceil(queda / 1000);
    // «Queda 1 minuto y 30 segundos», «Quedan 2 minutos»
    const verbo = (segundos >= 60 ? Math.floor(segundos / 60) : segundos) === 1 ? 'Queda' : 'Quedan';
    anunciarUrgente(`${verbo} ${duracionReloj(segundos)}.${mensaje}`);
  };

  // «Entendido» con su tecla, sin pasar por «Enviar»: el jugador, en su despertar; el
  // narrador, en la ventana de despertar que tiene delante. Al llegar, se cierra como siempre.
  const despertarEntendido = narro ? activoNarrador : miDespertar ? miDespertar.asiento : null;
  const mandarEntendido = async () => {
    const r = await pedirPropio('despertar:enviar', narro ? { ficha: 'entendido', asientoId: despertarEntendido } : { ficha: 'entendido' });
    if (r.ok) anunciar('despertar', 'Enviado: Entendido.');
    else setAviso(r.error);
  };

  // Los atajos que se pueden usar ahora, con lo que hace cada uno: con su tecla y, si
  // tiene, con su gesto (móviles y tabletas).
  const accionesActivas: [AccionAtajo, () => void][] = [
    ...(puedeLevantarMano ? [['levantarMano', alternarMano] as [AccionAtajo, () => void]] : []),
    ...(accionFase ? [['cambiarFase', () => void cambiarFase()] as [AccionAtajo, () => void]] : []),
    // G: revelar el grimorio (abre el diálogo de quién gana; al cerrarse, el foco vuelve donde estaba)
    ...(estado?.acciones.includes('narrador:revelarGrimorio') && !revelandoGrimorio
      ? [['revelarGrimorio', () => setRevelandoGrimorio(true)] as [AccionAtajo, () => void]]
      : []),
    // R: sonar el gong (todos a la plaza)
    ...(estado?.acciones.includes('narrador:sonarGong') ? [['sonarGong', () => void sonarGong()] as [AccionAtajo, () => void]] : []),
    // Z: poner el reloj (abre su diálogo; al cerrarse, el foco vuelve donde estaba)
    ...(estado?.acciones.includes('narrador:reloj') && !poniendoReloj
      ? [['reloj', () => setPoniendoReloj(true)] as [AccionAtajo, () => void]]
      : []),
    ...(estado?.video && puedeEmitirVideo
      ? [
          ['microfono', alternarMicrofonoConAtajo] as [AccionAtajo, () => void],
          ['camara', alternarCamaraConAtajo] as [AccionAtajo, () => void],
        ]
      : []),
    // Retroceso: salir de la conversación privada (o dejar de escuchar)
    ...(miConversacion ? [['salirConversacion', () => void salirDeConversacion()] as [AccionAtajo, () => void]] : []),
    // E: «Entendido» en el despertar (el propio, o el que el narrador tiene abierto)
    ...(despertarEntendido && estado?.acciones.includes('despertar:enviar')
      ? [['entendidoDespertar', () => void mandarEntendido()] as [AccionAtajo, () => void]]
      : []),
    // D: volver a abrir el despertar propio, si se había cerrado
    ...(miDespertar && wakeCerradoJugador ? [['abrirDespertar', () => setWakeCerradoJugador(false)] as [AccionAtajo, () => void]] : []),
    // Teclas de coger llamada: cada llamada entrante, con la tecla de su slot, la acepta
    ...Object.entries(slotsLlamada).map(
      ([id, slot]) => [accionCogerLlamada(slot), () => void responder(id, true)] as [AccionAtajo, () => void],
    ),
  ];
  const atajosActivos = [
    // La tecla de leer el reloj (Accesibilidad, no es de la pestaña Atajos): si coincide con un atajo, gana ella
    ...(preferencias.teclaLeerReloj ? [[preferencias.teclaLeerReloj, leerReloj] as [Atajo, () => void]] : []),
    ...accionesActivas.map(([accion, hacer]) => [atajos[accion], hacer] as [Atajo, () => void]),
  ];
  useReconocerGestos(
    accionesActivas.flatMap(([accion, hacer]) => {
      const gesto = gestos[accion];
      return gesto ? [[gesto, hacer] as [Gesto, () => void]] : [];
    }),
  );
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

  // Slots de las llamadas al día también en el primer estado y en los re-renders
  // (alCambiar ya los lleva en cada cambio; esto es la red de seguridad, idempotente).
  const idsRecibidas = estado ? recibidasDe(estado).map((i) => i.id).join(',') : '';
  useEffect(() => {
    if (!estado) return;
    reconciliarSlots(slotsLlamadaRef.current, recibidasDe(estado), NUM_TECLAS_LLAMADA);
    setSlotsLlamada(Object.fromEntries(slotsLlamadaRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsRecibidas]);

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

  // Pestaña Perfiles: un perfil lleva la configuración y el nombre en la sala.
  // Al aplicar uno, la pestaña Usuario se rehace para mostrar el nombre nuevo.
  const [versionPerfil, setVersionPerfil] = useState(0);
  const aplicarPerfil = async (perfil: PerfilConfiguracion): Promise<string | null> => {
    const datos = perfil.datos ?? {};
    aplicarConfiguracion(datos);
    let fallo: string | null = null;
    const nuevoAlias = limpiarNombre(typeof datos.alias === 'string' ? datos.alias : '');
    if (nuevoAlias !== alias) {
      const r = await pedir('sala:cambiarNombre', { nombre: nuevoAlias });
      if (r.ok) {
        setPerfil('alias', cuentaId, nuevoAlias);
        setAlias(nuevoAlias);
      } else {
        fallo = `Perfil ${perfil.nombre} aplicado, salvo el nombre: ${r.error}`;
      }
    }
    setVersionPerfil((v) => v + 1);
    return fallo;
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
            key={versionPerfil}
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
          fondoDeLaSala={fondoDeLaSala}
          onCambiar={cambiarPreferencias}
        />
      ),
    },
    {
      id: 'sonido',
      etiqueta: 'Sonido',
      conControles: true,
      contenido: <PanelSonido preferencias={preferencias} onCambiar={cambiarPreferencias} />,
    },
    {
      id: 'accesibilidad',
      etiqueta: 'Accesibilidad',
      conControles: true,
      contenido: (
        <PanelAccesibilidad
          activos={avisosActivos}
          onCambiar={cambiarAviso}
          onCambiarTodos={cambiarTodosAvisos}
          invitacionesFuera={preferencias.invitacionesFuera}
          onInvitacionesFuera={(invitacionesFuera) => cambiarPreferencias({ invitacionesFuera })}
          teclaLeerReloj={preferencias.teclaLeerReloj}
          onTeclaLeerReloj={(teclaLeerReloj) => cambiarPreferencias({ teclaLeerReloj })}
          atajos={atajos}
          eleccionDespertar={preferencias.eleccionDespertar}
          onEleccionDespertar={(eleccionDespertar) => cambiarPreferencias({ eleccionDespertar })}
          sonidoEnvolvente={preferencias.sonidoEnvolvente}
          onSonidoEnvolvente={(sonidoEnvolvente) => cambiarPreferencias({ sonidoEnvolvente })}
          salidaAudio={preferencias.salidaAudio}
          onSalidaAudio={(salidaAudio) => cambiarPreferencias({ salidaAudio })}
          canalesSalida={video.canalesSalida}
          onProbarSonido={video.probarEnvolvente}
        />
      ),
    },
    {
      id: 'atajos',
      etiqueta: 'Atajos',
      conControles: true,
      contenido: <PanelAtajos atajos={atajos} onCambiar={cambiarAtajo} gestos={gestos} onCambiarGesto={cambiarGesto} />,
    },
    {
      id: 'comunicaciones',
      etiqueta: 'Comunicaciones',
      conControles: true,
      contenido: (
        <PanelComunicaciones preferencias={preferencias} onCambiar={cambiarPreferencias} hayVideo={!!estado?.video} />
      ),
    },
    {
      id: 'perfiles',
      etiqueta: 'Perfiles',
      conControles: !!cuenta,
      contenido: (
        <PanelPerfiles
          conCuenta={!!cuenta}
          carga={cargaConfiguracion}
          perfiles={perfiles}
          onGuardar={(nombre) => guardarPerfilConfiguracion(nombre, { ...configuracionActual, alias })}
          onBorrar={borrarPerfilConfiguracion}
          onAplicar={aplicarPerfil}
        />
      ),
    },
    // Solo si el servidor deja configurar la partida (narradores).
    ...(estado?.acciones.includes('narrador:configurarPartida')
      ? [
          {
            id: 'partida',
            etiqueta: 'Partida',
            conControles: true,
            contenido: (
              <PanelPartida
                configuracion={estado.configuracion}
                onCambiar={configurarPartida}
                onCambiarFondo={(cambio) => pedir('narrador:cambiarFondo', cambio)}
              />
            ),
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

  // Faroles: los del narrador (narradores y visitantes) o, si soy el demonio, los míos.
  // Soy el demonio si mi ficha lo lleva (o, sin personaje dado, si me lo he anotado).
  const miAsiento = estado?.asientos.find((a) => a.ocupante === estado.yo);
  const miPersonaje = miAsiento ? (miAsiento.personaje ?? notasGrimorio[miAsiento.id]?.personaje ?? null) : null;
  const soyDemonio = yo?.rol === 'jugador' && !!miPersonaje && personajesGuionPorId.get(miPersonaje)?.tipo === 'demon';
  const modoFaroles = yo?.rol === 'narrador' ? 'narrador' : yo?.rol === 'visitante' ? 'visitante' : soyDemonio ? 'jugador' : null;
  const farolesVisibles = (modoFaroles === 'jugador' ? miAsiento?.faroles : estado?.faroles) ?? [null, null, null];

  // La columna de la izquierda: Mensajes, Charlas (si hay conversaciones o invitaciones) y Faroles (a quien le tocan)
  // Invitaciones y peticiones que esperan mi respuesta (las peticiones llegan a todos los miembros)
  // Sin conversaciones: cómo empezar una, según quién mira y el momento de la partida
  // El icono del botón de llamar (un teléfono), en el texto; el lector oye su nombre
  const iconoConversar = (
    <>
      <Phone size={13} aria-hidden="true" className="mx-0.5 inline align-[-2px] text-theme-main" />
      <span className="sr-only">el botón de llamar</span>
    </>
  );
  const ayudaCharlas = !estado?.video ? (
      'Esta sala no tiene llamadas: no se puede conversar en privado.'
    ) : yo?.rol === 'visitante' ? (
      'Cuando alguien converse en privado, aparecerá aquí y podrás escucharle.'
    ) : noche && yo?.rol === 'jugador' ? (
      <>De noche solo puedes hablar con el narrador: pulsa {iconoConversar} junto a su nombre para pedírselo.</>
    ) : (
      <>Para hablar en privado con alguien, pulsa {iconoConversar} junto a su nombre.</>
    );
  const invitacionesRecibidas =
    estado?.invitaciones.filter((i) => (i.conversacion ? i.de !== estado.yo : i.para === estado.yo)).length ?? 0;
  // Los mensajes se ven si la columna no está contraída y su panel es el elegido (o el
  // elegido ya no sale: entonces se ve el primero, que es el de los mensajes)
  const elegidoDisponible =
    preferencias.panelLateral === 'conversaciones' ||
    preferencias.panelLateral === 'npcs' ||
    (preferencias.panelLateral === 'faroles' && !!modoFaroles);
  const chatVisible = !preferencias.panelLateralContraido && !elegidoDisponible;
  const pestanasLaterales: PestanaLateral[] =
    estado && yo
      ? [
          ...(canalActual
            ? [
                {
                  id: 'mensajes' as const,
                  etiqueta: 'Mensajes',
                  Icono: MessagesSquare,
                  contador: {
                    valor: canalesChat.reduce(
                      (n, c) =>
                        n + (c === canalActual && chatVisible ? 0 : sinLeerDe(mensajes, c, yo.id, leidoHasta)),
                      0,
                    ),
                    texto: 'sin leer',
                  },
                  contenido: (
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
                  ),
                },
              ]
            : []),
          // Siempre: sin conversaciones, explica cómo empezar una
          {
            id: 'conversaciones' as const,
            etiqueta: 'Charlas',
            Icono: IconoConversar,
            // Lo que espera respuesta, antes que las conversaciones en curso
            contador: invitacionesRecibidas > 0
              ? { valor: invitacionesRecibidas, texto: 'por responder', destacado: true }
              : { valor: estado.conversaciones.length, texto: 'en curso' },
            contenido: (
              <div className="h-full overflow-y-auto">
                {/* Las invitaciones y peticiones (recibidas y enviadas), arriba; salvo que
                    la accesibilidad las saque fuera del panel (entonces van encima de la columna) */}
                {!preferencias.invitacionesFuera && (
                  <PanelInvitaciones
                    invitaciones={estado.invitaciones}
                    conversaciones={estado.conversaciones}
                    participantes={estado.participantes}
                    yo={estado.yo}
                    onResponder={(i, aceptar) => void responder(i.id, aceptar)}
                    onCancelar={(i) => void retirar(i.id)}
                    teclaLlamada={teclaLlamada}
                  />
                )}
                <PanelConversaciones
                  conversaciones={estado.conversaciones}
                  participantes={estado.participantes}
                  yo={yo}
                  onEscuchar={(id) => void escuchar(id)}
                  onEntrar={(id) => void entrar(id)}
                  ayuda={ayudaCharlas}
                  compacto={!preferencias.invitacionesFuera && estado.invitaciones.length > 0}
                />
              </div>
            ),
          },
          // NPCs: siempre (sin ninguno, lo dice)
          {
            id: 'npcs' as const,
            etiqueta: 'NPCs',
            Icono: IconoDestellos,
            contador: { valor: estado.npcs.length, texto: 'en juego' },
            contenido: (
              <PanelNpcs
                npcs={estado.npcs}
                disponibles={npcsDisponibles}
                narro={yo.rol === 'narrador'}
                hayGuion={!!guion}
                bootlegger={estado.bootlegger}
                djinn={reglasDjinn}
                rolStormcatcher={estado.rolStormcatcher ? (personajesGuionPorId.get(estado.rolStormcatcher) ?? null) : null}
                buenos={personajesGuion.filter((p) => p.tipo === 'townsfolk' || p.tipo === 'outsider')}
                pedir={pedirPropio}
                onError={setAviso}
              />
            ),
          },
          ...(modoFaroles
            ? [
                {
                  id: 'faroles' as const,
                  etiqueta: 'Faroles',
                  Icono: IconoMascaras,
                  contenido: (
                    <PanelFaroles
                      modo={modoFaroles}
                      faroles={farolesVisibles}
                      estado={estado}
                      pedir={pedirPropio}
                      onError={setAviso}
                      onAnuncio={(t) => anunciar('faroles', t)}
                      fijados={preferencias.farolesFijados}
                      onFijar={(farolesFijados) => cambiarPreferencias({ farolesFijados })}
                    />
                  ),
                },
              ]
            : []),
        ]
      : [];
  const panelLateral = pestanasLaterales.some((p) => p.id === preferencias.panelLateral)
    ? preferencias.panelLateral
    : (pestanasLaterales[0]?.id ?? 'mensajes');
  useEffect(() => {
    chatVisibleRef.current = chatVisible;
  });

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

  // El narrador ha mandado «Entendido»: se cierra la ventana de ese despertar (y el foco va a
  // la ficha). Antes que el foco pendiente, para que lo recoja.
  useEffect(() => {
    const asientos = entendidosPorCerrarRef.current;
    if (!asientos.length) return;
    entendidosPorCerrarRef.current = [];
    for (const id of asientos) if (abiertosNarrador.some((d) => d.asiento === id)) cerrarDespertar(id);
  });

  // Tras pintar un cambio de narradores: llevar el foco a donde toca, o
  // recuperarlo si el control que lo tenía ha desaparecido.
  useEffect(() => {
    const pendiente = focoPendienteRef.current;
    const rescate = rescatarFocoRef.current;
    focoPendienteRef.current = null;
    rescatarFocoRef.current = null;
    const perdido = document.activeElement === document.body || !document.activeElement;
    const destino = pendiente ?? (perdido ? rescate : null);
    const elemento = destino ? document.getElementById(destino) : null;
    if (elemento) elemento.focus();
    // La ventana de un despertar recién abierto aparece cuando llega el estado: se espera a ella
    else if (pendiente === ID_TITULO_DESPERTAR) focoPendienteRef.current = pendiente;
  });

  // Los tamaños elegidos llegan a los cuadros (CuadroAvatar) y a las fichas
  // (FichaRedonda, Mesa) por estas variables CSS.
  // Fuera de la mesa (cuadros de narrador): automático según la ventana. La mesa
  // pone los suyos (ver Mesa).
  const avatarFuera = preferencias.avatarAuto
    ? tamanoNarradorAuto(ventana.ancho, ventana.alto)
    : preferencias.tamanoAvatar;
  // La semilla de los estilos «al azar»: quién mira (su nombre, que no cambia al recargar)
  // y la partida (sube al limpiar el grimorio o cambiar de guion)
  const semillaPartida = `${yo?.nombre ?? ''}:${estado?.fase.reinicios ?? 0}`;
  // Tu mano (la elegida o, al azar, la de esta partida) es tu «skin»: la ven así todos, así que
  // se le dice a la sala cada vez que cambia. Las de los demás se ven con la suya.
  const miEstiloMano = estiloDePartida(preferencias.mano, ESTILOS_MANO, `${semillaPartida}:mano`);
  useEffect(() => {
    if (conexion !== 'conectada' || !yo || yo.estiloMano === miEstiloMano) return;
    void pedir('sala:estiloMano', { estilo: miEstiloMano });
    // Solo cuando cambia la tuya o lo que la sala tiene de ti
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conexion, yo?.estiloMano, miEstiloMano]);
  const tamanos = {
    '--sala-avatar': `${avatarFuera}px`,
    '--sala-ficha': `${preferencias.fichaAuto ? tamanoFichaAuto(avatarFuera) : preferencias.tamanoFicha}px`,
    '--sala-ficha-distancia': `${preferencias.distanciaFicha / 100}`,
  } as CSSProperties;

  return (
    <AvisosContexto.Provider value={avisosActivos}>
      {/* Cómo eligen jugadores las ventanas del despertar: en la plaza o en una lista */}
      <ElegirEnPlazaContexto.Provider value={elegirEnPlaza}>
      {/* La calavera, la mano, la silla y el voto de los muertos que se pintan: las elegidas o, al azar, unas por partida (y por persona) */}
      <MarcasContexto.Provider
        value={{
          calavera: estiloDePartida(preferencias.calavera, ESTILOS_CALAVERA, `${semillaPartida}:calavera`),
          mano: miEstiloMano,
          silla: estiloDePartida(preferencias.silla, ESTILOS_SILLA, `${semillaPartida}:silla`),
          voto: preferencias.voto,
        }}
      >
      <FichasContexto.Provider value={contextoFichas}>
      <LlamadaBotcContexto.Provider value={contextoLlamadaBotc}>
      <div className="contents" style={tamanos}>
        {/* De noche, el cielo estrellado detrás de la sala */}
        <CieloEstrellado activo={esNoche && preferencias.cieloEstrellado} ajustes={preferencias} />
        <Cabecera
          centro={
            estado && (
              <div className="flex min-w-0 items-center gap-2">
                <FasePartida
                  fase={estado.fase}
                  onVolverAtras={
                    estado.acciones.includes('narrador:volverAtras')
                      ? async () => {
                          const r = await pedirPropio('narrador:volverAtras');
                          if (!r.ok) setAviso(r.error);
                          return r.ok;
                        }
                      : undefined
                  }
                />
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
                      ? {
                          bolsa: estado.bolsa,
                          distribucion: estado.distribucion,
                          npcs: estado.npcs,
                          puedeAsignar: estado.acciones.includes('narrador:asignarPersonajes'),
                        }
                      : null
                  }
                  onAnuncio={anunciar}
                  recordatorios={yo?.rol === 'narrador' ? recordatoriosNoche(estado) : null}
                  // En la preparación y la primera noche, la primera; desde el primer día, las demás
                  nochePorDefecto={estado.fase.momento === 'preparacion' || (estado.fase.momento === 'noche' && estado.fase.numero <= 1) ? 'primera' : 'otras'}
                  partidaEmpezada={
                    estado.fase.momento !== 'preparacion' ||
                    estado.bolsa.length > 0 ||
                    estado.votaciones.length > 0 ||
                    estado.asientos.some((a) => a.personaje || a.muerto || a.marcado || a.recordatorios.length > 0)
                  }
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
                  sonido={video.sonido}
                  onSonido={video.alternarSonido}
                  teclaMicrofono={atajos.microfono.key}
                  teclaCamara={atajos.camara.key}
                  problema={video.problema}
                  onCerrarProblema={video.cerrarProblema}
                  sonidoBloqueado={video.sonidoBloqueado}
                  onActivarSonido={video.activarSonido}
                  silenciado={callado}
                  silencio={
                    estado.acciones.includes('narrador:silencio')
                      ? {
                          activo: estado.silencio,
                          onAlternar: () => {
                            void pedirPropio('narrador:silencio', { activo: !estado.silencio }).then((r) => {
                              if (!r.ok) setAviso(r.error);
                              else anunciar('comunicaciones', estado.silencio ? 'Silencio levantado.' : 'Has pedido silencio.');
                            });
                          },
                        }
                      : null
                  }
                />
              )}
              {estado && (
                <MenuNarrador
                  estado={estado}
                  pedir={pedirPropio}
                  onAsientos={() => setEditandoAsientos((v) => !v)}
                  revelando={revelandoGrimorio}
                  onRevelando={setRevelandoGrimorio}
                  atajoFase={atajos.cambiarFase}
                  atajoRevelar={atajos.revelarGrimorio}
                  atajoGong={atajos.sonarGong}
                  poniendoReloj={poniendoReloj}
                  onPoniendoReloj={setPoniendoReloj}
                  atajoReloj={atajos.reloj}
                  onRelojPuesto={(texto) => anunciar('reloj', texto)}
                />
              )}
              {puedeLevantarMano && yo && (
                <MenuMano
                  forma={yo.formaMano}
                  levantada={manoLevantada}
                  manos={manos}
                  puedeDosManos={puedeDosManos}
                  siguientes={siguientesManos}
                  onManos={ponerManos}
                  sinVoto={sinVoto}
                  senalando={senalandoMano}
                  atajoLevantar={atajos.levantarMano}
                  onAlternar={alternarMano}
                  onElegirForma={elegirFormaMano}
                  // Los del guion, que conoce todo el mundo (los en juego solo los sabe el narrador)
                  personajes={personajesGuion}
                />
              )}
              {/* Solo narradores: el servidor solo les manda a ellos el registro */}
              {yo?.rol === 'narrador' && estado && <RegistroVotaciones votaciones={estado.votaciones} />}
              {estado && (
                <ListaParticipantes
                  participantes={estado.participantes}
                  yo={estado.yo}
                  escuchando={new Set(estado.conversaciones.flatMap((c) => c.oyentes))}
                  volumen={estado.video ? { de: (id) => video.volumenes[id] ?? 1, cambiar: video.cambiarVolumen } : null}
                />
              )}
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
            {despiertoYo && !eleccion && !senalandoYo ? '' : anuncio}
          </div>
          <div aria-live="assertive" className="sr-only">
            {despiertoYo && !eleccion && !senalandoYo ? '' : anuncioUrgente}
          </div>

          {/* Flota abajo: no empuja el contenido ni genera scroll. Conexión y errores se
            ven siempre; se leen si se quiere (Preferencias > Accesibilidad). */}
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 flex w-[min(90vw,32rem)] -translate-x-1/2 flex-col gap-2">
            <div aria-live={avisosActivos.conexion ? 'polite' : 'off'}>
              {(conexion === 'conectando' || conexion === 'reconectando' || conexion === 'error') && (
                <p className="sala-aviso px-4 py-2 text-center font-ui text-sm tracking-wide text-on-surface-muted">
                  {MENSAJE_CONEXION[conexion]}
                </p>
              )}
            </div>
            <div aria-live={avisosActivos.errores ? 'polite' : 'off'}>
              {aviso && (
                <p className="sala-aviso sala-aviso-error px-4 py-2 text-center">{aviso}</p>
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
              {/* A la izquierda: los narradores y, debajo, la barra lateral (mensajes, conversaciones, faroles).
                  En pantallas anchas, del alto de la ventana (como la mesa, ver sala.css): la barra
                  lateral ocupa lo que dejan los narradores, sin alargar la página */}
              <div className="flex w-full shrink-0 flex-col gap-4 lg:h-[calc(100vh-8rem)] lg:w-[23rem]">
                <ZonaNarradores
                  estado={estado}
                  pedir={pedirPropio}
                  onError={setAviso}
                  contacto={contacto}
                  pistas={video.mesa}
                />
                {/* Si la accesibilidad lo pide, las invitaciones y peticiones de llamada van aquí fuera,
                    encima de la columna y a la vista se vea el panel que se vea (si no, dentro de Charlas) */}
                {preferencias.invitacionesFuera && (
                  <PanelInvitaciones
                    invitaciones={estado.invitaciones}
                    conversaciones={estado.conversaciones}
                    participantes={estado.participantes}
                    yo={estado.yo}
                    onResponder={(i, aceptar) => void responder(i.id, aceptar)}
                    onCancelar={(i) => void retirar(i.id)}
                    teclaLlamada={teclaLlamada}
                    fuera
                  />
                )}
                {/* Mensajes, conversaciones privadas y faroles: uno a la vez, con su barra de iconos */}
                <ColumnaLateral
                  pestanas={pestanasLaterales}
                  activa={panelLateral}
                  onElegir={(panelLateral) => cambiarPreferencias({ panelLateral })}
                  contraida={preferencias.panelLateralContraido}
                  fijado={
                    modoFaroles && preferencias.farolesFijados
                      ? {
                          panel: 'faroles',
                          contenido: (
                            <FarolesFijados
                              faroles={farolesVisibles}
                              onDesfijar={() => {
                                cambiarPreferencias({ farolesFijados: false });
                                // El botón desaparece: el foco vuelve a la pestaña del panel que se ve
                                window.setTimeout(() => document.getElementById(idPestanaLateral(panelLateral))?.focus(), 0);
                              }}
                            />
                          ),
                        }
                      : null
                  }
                  onContraer={(panelLateralContraido) => cambiarPreferencias({ panelLateralContraido })}
                />
              </div>
              {/* sala-columna-mesa: la mesa centrada en la ventana y apartada de la hoja del guion (sala.css) */}
              <section aria-labelledby="sala-plaza-titulo" className="sala-columna-mesa min-w-0 flex-1">
                {/* Para saltar con el lector a la mesa: los asientos, cada uno con su ficha */}
                <h2 id="sala-plaza-titulo" className="sr-only">
                  La plaza
                </h2>
                <Mesa
                  estado={estado}
                  manual={{ avatar: preferencias.tamanoAvatar, ficha: preferencias.tamanoFicha }}
                  auto={{ avatar: preferencias.avatarAuto, ficha: preferencias.fichaAuto }}
                  onTamanos={setTamanosMesa}
                  editando={editando}
                  grimorio={yo?.rol === 'jugador' && estado.configuracion.grimorioJugadores}
                  pedir={pedirEnMesa}
                  onError={setAviso}
                  onAnuncio={anunciar}
                  focoAsientoRef={focoAsientoRef}
                  onTerminar={terminarAsientos}
                  desfaseReloj={desfaseReloj}
                  contacto={contacto}
                  pistas={video.mesa}
                  ondas={ondas}
                  ciudad={preferencias.ciudad !== 'nunca' ? <CiudadPlaza fase={estado.fase.momento} poblado={preferencias.pobladoCabecera} siempre={preferencias.ciudad === 'siempre'} /> : undefined}
                  despertares={
                    veoDespertares
                      ? {
                          hilos: new Set(despertares.map((d) => d.asiento)),
                          noLeidos,
                          entendidos: new Set(despertares.filter(esEntendido).map((d) => d.asiento)),
                          onAbrir: (id) => void abrirDespertar(id),
                        }
                      : miDespertar
                        ? // El jugador despertado: la luna en su ficha le vuelve a abrir su despertar
                          // (se le abre solo cuando el narrador le escribe: no hay «sin leer»)
                          {
                            hilos: new Set([miDespertar.asiento]),
                            noLeidos: new Set(),
                            entendidos: esEntendido(miDespertar) ? new Set([miDespertar.asiento]) : new Set(),
                            onAbrir: () => setWakeCerradoJugador(false),
                          }
                        : null
                  }
                  seguimiento={puedeSeguir ? { siguiendo: sigoA?.id ?? null, onAlternar: alternarSeguir } : null}
                  eleccion={
                    eleccion
                      ? { titulo: eleccion.titulo, excluidos: eleccion.excluidos, onElegir: elegidoEnPlaza, onCancelar: cancelarEleccion }
                      : null
                  }
                />
              </section>
              {/* Fuera de la mesa, para no tapar sus fichas: en pantallas anchas, abajo
                  del todo a la derecha (apartándose de la hoja del guion); en estrechas, debajo de la mesa */}
              <div className="flex flex-wrap items-end gap-3 self-start lg:fixed lg:bottom-4 lg:right-[calc(var(--sala-panel-guion-ancho,0px)+1rem)] lg:z-30">
                <RepartoPartida
                  distribucion={estado.distribucion}
                  bolsa={estado.acciones.includes('narrador:bolsa') ? estado.bolsa : null}
                  asientos={estado.asientos}
                  npcs={estado.npcs}
                  setupAceptado={estado.setupAceptado}
                  preparacion={estado.fase.momento === 'preparacion'}
                  pedir={pedirPropio}
                  onError={setAviso}
                />
              </div>
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
            muertos={new Set(estado.asientos.filter((a) => a.muerto && a.ocupante).map((a) => a.ocupante!))}
            onSalir={() => void salirDeConversacion()}
            onEntrar={yo?.rol === 'narrador' ? () => void entrar(miConversacion.id) : undefined}
            teclaSalir={atajos.salirConversacion.key}
            atajoSalir={atajos.salirConversacion}
          />
        )}

        {/* Despertares: los que el narrador tiene abiertos (su ventana) y el del jugador (la suya, modal) */}
        {estado && veoDespertares && activoNarrador && (
          <VentanaDespertar
            soloLectura={!narro}
            estado={estado}
            abiertos={abiertosNarrador}
            activo={activoNarrador}
            noLeidos={noLeidos}
            onActivar={activarDespertar}
            onCerrar={cerrarDespertar}
            // También los viajeros del catálogo (no solo los del guion): «Tú eres» a un viajero
            personajes={[...personajesGuion, ...viajerosCatalogo.filter((v) => !personajesGuion.some((p) => p.id === v.id))]}
            porId={personajesGuionPorId}
            pedir={pedirPropio}
            onError={setAviso}
            onEnviado={(t) => anunciar('despertar', t)}
            oculta={!!eleccion}
            revisiones={narro ? revisionesDe(estado) : undefined}
          />
        )}
        {estado && miDespertar && despiertoYo && (
          <DespertarJugador
            estado={estado}
            despertar={miDespertar}
            faroles={soyDemonio ? (miAsiento?.faroles ?? null) : null}
            onCerrar={() => setWakeCerradoJugador(true)}
            personajes={personajesGuion}
            porId={personajesGuionPorId}
            pedir={pedirPropio}
            onError={setAviso}
            onEnviado={(t) => anunciar('despertar', t)}
            anuncio={eleccion || senalandoYo ? '' : anuncio}
            anuncioUrgente={eleccion || senalandoYo ? '' : anuncioUrgente}
            error={aviso}
            oculto={!!eleccion || senalandoYo}
          />
        )}

        {estado && narro && estado.nuevoImp && nuevoImpAplazado !== estado.nuevoImp && (
          <DialogoNuevoImp
            estado={estado}
            muere={estado.nuevoImp}
            porId={personajesGuionPorId}
            pedir={pedirPropio}
            onElegido={(t) => anunciar('despertar', t)}
            onCerrar={() => setNuevoImpAplazado(estado.nuevoImp)}
          />
        )}

        {decidiendoFinal && (
          <DialogoFinal
            onNoche={() => pedirPropio('narrador:irANoche')}
            onRevelar={() => {
              setDecidiendoFinal(false);
              setRevelandoGrimorio(true);
            }}
            onCerrar={() => setDecidiendoFinal(false)}
          />
        )}

        {preferenciasAbiertas && (
          <DialogoPreferencias pestanas={pestanasPreferencias} onCerrar={() => setPreferenciasAbiertas(false)} />
        )}
      </div>
      </LlamadaBotcContexto.Provider>
      </FichasContexto.Provider>
      </MarcasContexto.Provider>
      </ElegirEnPlazaContexto.Provider>
    </AvisosContexto.Provider>
  );
};

export default SalaJuego;
