import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { notifySessionExpired } from '../utils/session';
import type { SalaDto, ResultadoAccion, ResultadoBolsaAlAzar } from '@views/sala';
import type { MensajeChatDto, SusurroDto } from '@views/chat';
import type { Alineamiento } from '@models/jugador';
import type { GuionResuelto } from './guiones';
import type { Envio } from './despertar';

// Lo que comparte con el servidor: los Dto que manda (@views) y los valores del dominio (@models).
// Se reexporta aquí para que la sala lo siga importando de useSala.
export type {
  MensajeDespertar,
  AvisoHabilidad,
  EleccionDespertar,
  EnvioDespertar,
  OpcionDespertar,
  Registro,
} from '@models/despertar';
export type { HabilidadNocheDto, DespertarDto } from '@views/despertar';
export type { Recordatorio } from '@models/grimorio';
export type { FichaEnviadaDto, GrimorioEnviadoDto } from '@views/grimorio';
export type { Alineamiento } from '@models/jugador';
export type { JugadorDto } from '@views/jugador';
export type { Persona, FormaMano, Rol } from '@models/participante';
export type { ParticipanteDto } from '@views/participante';
export type { Distribucion, Fase, RegistroVotacion } from '@models/partida';
export type {
  ConfiguracionDto,
  NominacionDto,
  RelojDto,
  RevelacionDto,
  SenalamientoDto,
  VotacionDto,
} from '@views/partida';
export type { ConversacionDto, SalaDto, InvitacionDto, RepartoDto, ResultadoAccion, ResultadoBolsaAlAzar } from '@views/sala';
export { usuarioDe } from '@models/participante';
export { SALA_SENALAMIENTO as SENALAMIENTO } from '@models/partida';

/** El pase para conectarse al servidor de vídeo. */
export type PaseVideo = { ok: true; url: string; token: string } | { ok: false; error: string };

/**
 * `expulsada`: la misma cuenta entró en la sala desde otra ventana.
 * `expulsadaPorNarrador`: un narrador la ha sacado de la sala.
 * En los dos casos no se reintenta la conexión.
 */
export type SalaConexion = 'conectando' | 'conectada' | 'reconectando' | 'expulsada' | 'expulsadaPorNarrador' | 'error';

const API_URL: string = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
const CLIENTE_KEY = 'sala:cliente';

/** Id de esta pestaña para recuperar el sitio en la sala si se recarga o se corta. */
function clienteId(): string | null {
  try {
    let id = sessionStorage.getItem(CLIENTE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(CLIENTE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Conexión con la sala en tiempo real. Con `token` se entra con la cuenta de la
 * web; si no, con `nombre` como invitado. Al desmontarse se sale de la sala.
 */
export function useSala(
  token: string | null,
  nombre: string | null,
  /** Nombre y avatar preferidos para la sala; se mandan al conectar, no reconectan al cambiar. */
  perfil: { alias: string; avatar: string },
  avisos: {
    /** Cada estado nuevo junto al anterior, para avisar de cambios. */
    alCambiar?: (anterior: SalaDto | null, nuevo: SalaDto) => void;
    /** El servidor no deja entrar como invitado con ese nombre: ya lo usa otro. */
    alNombreOcupado?: () => void;
    /** Ha cambiado el guion de la sala (no al entrar, cuando llega el que ya había). */
    alCambiarGuion?: (guion: GuionResuelto | null) => void;
    /** Ha llegado un mensaje de texto (también los propios). */
    alMensaje?: (mensaje: MensajeChatDto) => void;
    /** Dos jugadores se han escrito en privado: las ondas de un asiento al otro. */
    alSusurro?: (susurro: SusurroDto) => void;
    /** El narrador virtual dice algo (para oírlo con la voz del navegador). */
    alVoz?: (texto: string) => void;
  } = {},
) {
  const [estado, setEstado] = useState<SalaDto | null>(null);
  const [conexion, setConexion] = useState<SalaConexion>('conectando');
  // El guion de la sala: llega aparte del estado (solo al entrar y cuando cambia).
  const [guion, setGuion] = useState<GuionResuelto | null>(null);
  // Diferencia entre el reloj del servidor y el de aquí (ms), para las cuentas atrás.
  const [desfaseReloj, setDesfaseReloj] = useState(0);
  // Los mensajes de texto que se pueden leer (el historial llega al entrar y se le añaden los nuevos).
  const [mensajes, setMensajes] = useState<MensajeChatDto[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const avisosRef = useRef(avisos);
  const perfilRef = useRef(perfil);
  useEffect(() => {
    avisosRef.current = avisos;
    perfilRef.current = perfil;
  });

  useEffect(() => {
    const url = new URL(API_URL, window.location.href);
    const socket = io(url.origin, {
      path: `${url.pathname.replace(/\/$/, '')}/socket.io`,
      // Se evalúa en cada (re)conexión: así lleva el perfil vigente.
      auth: (cb) =>
        cb({
          ...(token ? { token } : { nombre }),
          alias: perfilRef.current.alias,
          avatar: perfilRef.current.avatar,
          clienteId: clienteId(),
        }),
    });
    socketRef.current = socket;

    let anterior: SalaDto | null = null;
    let expulsada = false;
    let guionRecibido = false;
    socket.on('sala:guion', (nuevo: GuionResuelto | null) => {
      if (guionRecibido) avisosRef.current.alCambiarGuion?.(nuevo);
      guionRecibido = true;
      setGuion(nuevo);
    });
    socket.on('sala:estado', (nuevo: SalaDto) => {
      avisosRef.current.alCambiar?.(anterior, nuevo);
      anterior = nuevo;
      setEstado(nuevo);
      setDesfaseReloj(nuevo.ahora - Date.now());
    });
    socket.on('chat:historial', (lista: MensajeChatDto[]) => setMensajes(lista));
    socket.on('chat:mensaje', (mensaje: MensajeChatDto) => {
      setMensajes((previos) => (previos.some((m) => m.id === mensaje.id) ? previos : [...previos, mensaje]));
      avisosRef.current.alMensaje?.(mensaje);
    });
    socket.on('sala:susurro', (susurro: SusurroDto) => avisosRef.current.alSusurro?.(susurro));
    socket.on('sala:voz', ({ texto }: { texto: string }) => avisosRef.current.alVoz?.(texto));
    socket.on('connect', () => {
      expulsada = false;
      setConexion('conectada');
    });
    socket.on('sala:expulsado', (aviso?: { motivo?: string }) => {
      expulsada = true;
      anterior = null;
      setEstado(null);
      setConexion(aviso?.motivo === 'narrador' ? 'expulsadaPorNarrador' : 'expulsada');
    });
    socket.on('disconnect', () => {
      if (expulsada) return;
      setConexion('reconectando');
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'SESION_CADUCADA') {
        notifySessionExpired();
        return;
      }
      if (err.message === 'NOMBRE_OCUPADO') {
        avisosRef.current.alNombreOcupado?.();
        return;
      }
      // Si el servidor rechazó la entrada no se reintenta; si es la red, sí.
      setConexion(socket.active ? 'reconectando' : 'error');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, nombre]);

  /**
   * Pide una acción a la sala (ver `services/sala/acciones` en el servidor) y devuelve su
   * resultado; nunca falla. El servidor comprueba si se puede.
   */
  const pedir = useCallback(
    (accion: string, datos?: unknown) =>
      new Promise<ResultadoAccion>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ ok: false, error: 'No hay conexión con la sala.' });
          return;
        }
        socket
          .timeout(5000)
          .emit('sala:accion', { accion, datos }, (err: Error | null, r: ResultadoAccion) =>
            resolve(err ? { ok: false, error: 'La sala no ha respondido. Inténtalo de nuevo.' } : r),
          );
      }),
    [],
  );

  /**
   * Manda un mensaje de texto: `para` es «general», «visitantes» o el id de un
   * participante (en privado). El servidor dice si se puede.
   */
  const enviarMensaje = useCallback(
    (para: string, texto: string) =>
      new Promise<ResultadoAccion>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ ok: false, error: 'No hay conexión con la sala.' });
          return;
        }
        socket
          .timeout(5000)
          .emit('chat:enviar', { para, texto }, (err: Error | null, r: ResultadoAccion) =>
            resolve(err ? { ok: false, error: 'La sala no ha respondido. Inténtalo de nuevo.' } : r),
          );
      }),
    [],
  );

  /** Pide al servidor algo con respuesta (ack), con un tiempo máximo; nunca falla. */
  const pedirAlSocket = useCallback(
    <T extends ResultadoAccion>(evento: string, datos?: unknown) =>
      new Promise<T>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ ok: false, error: 'No hay conexión con la sala.' } as T);
          return;
        }
        const responder = (err: Error | null, r: T) =>
          resolve(err ? ({ ok: false, error: 'La sala no ha respondido. Inténtalo de nuevo.' } as T) : r);
        if (datos === undefined) socket.timeout(8000).emit(evento, responder);
        else socket.timeout(8000).emit(evento, datos, responder);
      }),
    [],
  );

  /** El pase para el vídeo de la plaza («principal») o de una conversación (su id). */
  const pedirPaseVideo = useCallback(
    (sala: string) => pedirAlSocket<ResultadoAccion & Partial<{ url: string; token: string }>>('video:pase', { sala }) as Promise<PaseVideo>,
    [pedirAlSocket],
  );
  /**
   * Conversaciones privadas: invitar a alguien, pedir unirse a la suya, responder,
   * retirar la invitación o la petición, escuchar (visitantes y narradores), entrar
   * sin invitación (narradores) y salir.
   */
  const invitarAConversar = useCallback((con: string) => pedirAlSocket<ResultadoAccion>('conversacion:invitar', { con }), [pedirAlSocket]);
  const pedirUnirse = useCallback((con: string) => pedirAlSocket<ResultadoAccion>('conversacion:pedirUnirse', { con }), [pedirAlSocket]);
  const responderInvitacion = useCallback(
    (invitacion: string, aceptar: boolean) => pedirAlSocket<ResultadoAccion>('conversacion:responder', { invitacion, aceptar }),
    [pedirAlSocket],
  );
  const cancelarInvitacion = useCallback(
    (invitacion: string) => pedirAlSocket<ResultadoAccion>('conversacion:cancelar', { invitacion }),
    [pedirAlSocket],
  );
  const escucharConversacion = useCallback(
    (conversacion: string) => pedirAlSocket<ResultadoAccion>('conversacion:escuchar', { conversacion }),
    [pedirAlSocket],
  );
  const entrarConversacion = useCallback(
    (conversacion: string) => pedirAlSocket<ResultadoAccion>('conversacion:entrar', { conversacion }),
    [pedirAlSocket],
  );
  const salirConversacion = useCallback(() => pedirAlSocket<ResultadoAccion>('conversacion:salir', {}), [pedirAlSocket]);

  /** La bolsa (el narrador), por sus eventos: el servidor comprueba y la sala llega con el cambio. */
  const bolsa: AccionesBolsa = useMemo(
    () => ({
      meter: (personajeId) => pedirAlSocket<ResultadoAccion>('bolsa:meter', { personajeId }),
      cantidad: (personajeId, cantidad) => pedirAlSocket<ResultadoAccion>('bolsa:cantidad', { personajeId, cantidad }),
      vaciar: () => pedirAlSocket<ResultadoAccion>('bolsa:vaciar', {}),
      llenarAlAzar: () => pedirAlSocket<ResultadoBolsaAlAzar>('bolsa:llenarAlAzar', {}),
      aceptarReparto: (firma) => pedirAlSocket<ResultadoAccion>('bolsa:aceptarReparto', { firma }),
    }),
    [pedirAlSocket],
  );

  /** El gong y el reloj (el narrador), por sus eventos. */
  const reloj: AccionesReloj = useMemo(
    () => ({
      sonarGong: () => pedirAlSocket<ResultadoAccion>('reloj:sonarGong', {}),
      poner: (segundos, mensaje) => pedirAlSocket<ResultadoAccion>('reloj:poner', { segundos, mensaje }),
      terminar: () => pedirAlSocket<ResultadoAccion>('reloj:terminar', {}),
      quitar: () => pedirAlSocket<ResultadoAccion>('reloj:quitar', {}),
    }),
    [pedirAlSocket],
  );

  /** La revelación del grimorio al acabar (el narrador), por sus eventos. */
  const revelacion: AccionesRevelacion = useMemo(
    () => ({
      empezar: (ganador, causas, esbirros) => pedirAlSocket<ResultadoAccion>('revelacion:empezar', { ganador, causas, esbirros }),
      revelarFicha: (jugadorId) => pedirAlSocket<ResultadoAccion>('revelacion:revelarFicha', { jugadorId }),
      terminar: () => pedirAlSocket<ResultadoAccion>('revelacion:terminar', {}),
    }),
    [pedirAlSocket],
  );

  /** Los señalamientos (el narrador los pide; quien le toca, señala), por sus eventos. */
  const senalamiento: AccionesSenalamiento = useMemo(
    () => ({
      empezar: (peticion) => pedirAlSocket<ResultadoAccion>('senalamiento:empezar', peticion),
      lilmonsta: () => pedirAlSocket<ResultadoAccion>('senalamiento:lilmonsta', {}),
      terminar: () => pedirAlSocket<ResultadoAccion>('senalamiento:terminar', {}),
      senalar: (jugadorId) => pedirAlSocket<ResultadoAccion>('senalamiento:senalar', { jugadorId }),
    }),
    [pedirAlSocket],
  );

  /** Los faroles (los del demonio, que prepara el narrador, y los de cada jugador), por sus eventos. */
  const faroles: AccionesFaroles = useMemo(
    () => ({
      preparar: (posicion, personajeId) => pedirAlSocket<ResultadoAccion>('faroles:preparar', { posicion, personajeId }),
      poner: (posicion, personajeId) => pedirAlSocket<ResultadoAccion>('faroles:poner', { posicion, personajeId }),
      usar: (personajeId) => pedirAlSocket<ResultadoAccion>('faroles:usar', { personajeId }),
      copiar: (personajes) => pedirAlSocket<ResultadoAccion>('faroles:copiar', { personajes }),
    }),
    [pedirAlSocket],
  );

  /** El paso de las fases (el narrador), por sus eventos. */
  const fase: AccionesFase = useMemo(
    () => ({
      irANoche: () => pedirAlSocket<ResultadoAccion>('fase:noche', {}),
      amanecer: () => pedirAlSocket<ResultadoAccion>('fase:amanecer', {}),
      volverAtras: () => pedirAlSocket<ResultadoAccion>('fase:volverAtras', {}),
      limpiarGrimorio: () => pedirAlSocket<ResultadoAccion>('fase:limpiarGrimorio', {}),
    }),
    [pedirAlSocket],
  );

  /** La noche: los despertares, el nuevo Imp y la estrella de cada fila, por sus eventos. */
  const noche: AccionesNoche = useMemo(
    () => ({
      despertar: (jugadorId) => pedirAlSocket<ResultadoAccion>('noche:despertar', { jugadorId }),
      enviar: (jugadorIds, envio) => pedirAlSocket<ResultadoAccion>('noche:enviar', { ...envio, jugadorIds }),
      despertarHabilidad: (personajeId) => pedirAlSocket<ResultadoAccion>('noche:despertarHabilidad', { personajeId }),
      resolverHabilidad: (personajeId, envio) => pedirAlSocket<ResultadoAccion>('noche:resolverHabilidad', { ...envio, personajeId }),
      nuevoImp: (jugadorId) => pedirAlSocket<ResultadoAccion>('noche:nuevoImp', { jugadorId }),
      recordatorio: (id, activo) => pedirAlSocket<ResultadoAccion>('noche:recordatorio', { id, activo }),
    }),
    [pedirAlSocket],
  );

  /** El día: las nominaciones, la votación, la calavera y la ejecución, por sus eventos. */
  const dia: AccionesDia = useMemo(
    () => ({
      nominar: (desde, hasta, comoAldeano) =>
        pedirAlSocket<ResultadoAccion>('dia:nominar', comoAldeano === undefined ? { desde, hasta } : { desde, hasta, comoAldeano }),
      cerrarNominacion: () => pedirAlSocket<ResultadoAccion>('dia:cerrarNominacion', {}),
      votosNecesarios: (votos) => pedirAlSocket<ResultadoAccion>('dia:votosNecesarios', { votos }),
      cuentaAtras: () => pedirAlSocket<ResultadoAccion>('dia:cuentaAtras', {}),
      reiniciarVotacion: () => pedirAlSocket<ResultadoAccion>('dia:reiniciarVotacion', {}),
      marcar: (jugadorId, marcado, cerrarNominacion) => pedirAlSocket<ResultadoAccion>('dia:marcar', { jugadorId, marcado, cerrarNominacion }),
      desmarcar: () => pedirAlSocket<ResultadoAccion>('dia:desmarcar', {}),
      ejecutar: (jugadorId) => pedirAlSocket<ResultadoAccion>('dia:ejecutar', { jugadorId }),
    }),
    [pedirAlSocket],
  );

  /** El narrador virtual: añadirlo, quitarlo y lo que le piden los jugadores de día, por sus eventos. */
  const narradorVirtual: AccionesNarradorVirtual = useMemo(
    () => ({
      anadir: (opciones) => pedirAlSocket<ResultadoAccion>('narradorVirtual:anadir', opciones),
      quitar: () => pedirAlSocket<ResultadoAccion>('narradorVirtual:quitar', {}),
      turno: (turno, jugadorId) => pedirAlSocket<ResultadoAccion>(`narradorVirtual:${turno}`, jugadorId === undefined ? {} : { jugadorId }),
      declarar: (id, datos) => pedirAlSocket<ResultadoAccion>(`declarar:${id}`, datos),
    }),
    [pedirAlSocket],
  );

  /** Vuelve a pedir los mensajes que se pueden leer (al cambiar de papel cambian). */
  const pedirHistorial = useCallback(() => {
    socketRef.current?.emit('chat:historial');
  }, []);

  /** Volver a entrar tras ser expulsada (expulsa a su vez a la otra ventana). */
  const reconectar = useCallback(() => {
    setConexion('conectando');
    socketRef.current?.connect();
  }, []);

  return {
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
    bolsa,
    reloj,
    revelacion,
    senalamiento,
    faroles,
    fase,
    noche,
    dia,
    narradorVirtual,
  };
}

/** Lo que un jugador pide al narrador virtual en su turno del día (nominar, con el nominado). */
export type TurnoVirtual = 'nominar' | 'defensa' | 'voto' | 'listo' | 'seguirNominando';

/** Lo que se hace con el narrador virtual (ver useSala). */
export interface AccionesNarradorVirtual {
  anadir(opciones: { narrador: string; guion: string; jugadores: number }): Promise<ResultadoAccion>;
  quitar(): Promise<ResultadoAccion>;
  turno(turno: TurnoVirtual, jugadorId?: string): Promise<ResultadoAccion>;
  /** Una declaración del día (el Artista, el Patoso…): lo que lleve, según cuál. */
  declarar(id: string, datos: unknown): Promise<ResultadoAccion>;
}

/** Lo que hace el narrador de día (ver useSala). */
export interface AccionesDia {
  /** Nomina; contesta (valor) «comoAldeano» si hay que preguntarlo, «ejecutado» o «final» con la Virgen. */
  nominar(desde: string, hasta: string, comoAldeano?: boolean): Promise<ResultadoAccion>;
  cerrarNominacion(): Promise<ResultadoAccion>;
  /** Los votos que hacen falta (null: los de por defecto). */
  votosNecesarios(votos: number | null): Promise<ResultadoAccion>;
  cuentaAtras(): Promise<ResultadoAccion>;
  reiniciarVotacion(): Promise<ResultadoAccion>;
  /** Pone o quita la calavera; desde la ficha no cierra la nominación (cerrarNominacion: false). */
  marcar(jugadorId: string, marcado: boolean, cerrarNominacion?: boolean): Promise<ResultadoAccion>;
  desmarcar(): Promise<ResultadoAccion>;
  /** Ejecuta a quien lleva la calavera; con dos vivos contesta «final». */
  ejecutar(jugadorId: string): Promise<ResultadoAccion>;
}

/** Lo que se hace de noche (ver useSala). */
export interface AccionesNoche {
  /** El narrador abre el despertar de un asiento. */
  despertar(jugadorId: string): Promise<ResultadoAccion>;
  /** Un mensaje en un despertar: el narrador, a esos asientos; el jugador, en el suyo (sin asientos). */
  enviar(jugadorIds: string[], envio: Envio): Promise<ResultadoAccion>;
  /** El despertar guiado de una fila del orden de noche. */
  despertarHabilidad(personajeId: string): Promise<ResultadoAccion>;
  /** El despertar guiado, revisado: lo que se manda al de esa fila. */
  resolverHabilidad(personajeId: string, envio: Envio): Promise<ResultadoAccion>;
  /** El Imp se ha elegido a sí mismo: el nuevo. */
  nuevoImp(jugadorId: string): Promise<ResultadoAccion>;
  /** Pone o quita la estrella de una fila del orden de noche. */
  recordatorio(id: string, activo: boolean): Promise<ResultadoAccion>;
}

/** Lo que hace el narrador con las fases (ver useSala). */
export interface AccionesFase {
  irANoche(): Promise<ResultadoAccion>;
  amanecer(): Promise<ResultadoAccion>;
  /** La máquina del tiempo: a la fase anterior. */
  volverAtras(): Promise<ResultadoAccion>;
  /** Vuelve a la preparación, con las fichas como al principio. */
  limpiarGrimorio(): Promise<ResultadoAccion>;
}

/** Lo que se hace con los faroles (ver useSala). */
export interface AccionesFaroles {
  /** El narrador pone un personaje en una casilla de los faroles del demonio (null: la vacía). */
  preparar(posicion: number, personajeId: string | null): Promise<ResultadoAccion>;
  /** Un jugador se pone un farol en una de sus casillas (null: la vacía). */
  poner(posicion: number, personajeId: string | null): Promise<ResultadoAccion>;
  /** Un jugador dice qué farol usa (null: ninguno). */
  usar(personajeId: string | null): Promise<ResultadoAccion>;
  /** El jugador despierto copia los que le ha enseñado el narrador. */
  copiar(personajes: string[]): Promise<ResultadoAccion>;
}

/** Lo que se hace con los señalamientos (ver useSala). */
export interface AccionesSenalamiento {
  /** El narrador pide que se señale: quiénes señalan, a quiénes (listas vacías: todos), el mensaje y la cuenta atrás (null: sin ella). */
  empezar(peticion: { mensaje: string; segundos: number | null; senaladores: string[]; objetivos: string[] }): Promise<ResultadoAccion>;
  /** Lil' Monsta: los esbirros eligen quién lo cuida. */
  lilmonsta(): Promise<ResultadoAccion>;
  /** El narrador lo quita. */
  terminar(): Promise<ResultadoAccion>;
  /** Quien le toca señala a un asiento (null: deja de señalar). */
  senalar(jugadorId: string | null): Promise<ResultadoAccion>;
}

/** Lo que el narrador hace al revelar el grimorio (ver useSala). */
export interface AccionesRevelacion {
  /** Revela el grimorio: quién gana, lo que ha pasado (causas) y, de las de esbirro, qué asiento fue. */
  empezar(ganador: Alineamiento, causas: string[], esbirros: Record<string, string>): Promise<ResultadoAccion>;
  /** Revela la ficha de un asiento, para todos. */
  revelarFicha(jugadorId: string): Promise<ResultadoAccion>;
  /** Revela de una vez las que quedan. */
  terminar(): Promise<ResultadoAccion>;
}

/** Lo que el narrador hace con el gong y el reloj (ver useSala). */
export interface AccionesReloj {
  sonarGong(): Promise<ResultadoAccion>;
  /** Pone el reloj: una cuenta atrás para todos con su mensaje; al acabar suena el gong. */
  poner(segundos: number, mensaje: string): Promise<ResultadoAccion>;
  /** Lo acaba ya: suena el gong. */
  terminar(): Promise<ResultadoAccion>;
  /** Lo quita sin que suene. */
  quitar(): Promise<ResultadoAccion>;
}

/** Lo que el narrador hace con la bolsa (ver useSala). */
export interface AccionesBolsa {
  /** Mete un personaje en la bolsa, o lo saca si ya estaba. */
  meter(personajeId: string): Promise<ResultadoAccion>;
  /** Cuántas fichas de un personaje (0 lo saca). */
  cantidad(personajeId: string, cantidad: number): Promise<ResultadoAccion>;
  vaciar(): Promise<ResultadoAccion>;
  llenarAlAzar(): Promise<ResultadoBolsaAlAzar>;
  /** Da por bueno el reparto (su firma) aunque no cuadre, o deja de darlo (null). */
  aceptarReparto(firma: string | null): Promise<ResultadoAccion>;
}
