import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { notifySessionExpired } from '../utils/session';
import type { SalaDto, ResultadoAccion } from '@contrato/sala';
import type { MensajeChatDto, SusurroDto } from '@contrato/chat';
import type { GuionResuelto } from './guiones';

// El contrato con el servidor (lo que manda, los Dto): server/src/contrato/, por temas.
// Se reexporta aquí para que la sala lo siga importando de useSala.
export type {
  MensajeDespertar,
  AvisoHabilidad,
  EleccionDespertar,
  EnvioDespertar,
  HabilidadNocheDto,
  OpcionDespertar,
  Registro,
  DespertarDto,
} from '@contrato/despertar';
export type { FichaEnviadaDto, GrimorioEnviadoDto, Recordatorio } from '@contrato/grimorio';
export type { Alineamiento, JugadorDto } from '@contrato/jugador';
export type { Persona, FormaMano, ParticipanteDto, Rol } from '@contrato/participante';
export type {
  ConfiguracionDto,
  DistribucionDto,
  FaseDto,
  NominacionDto,
  RegistroVotacionDto,
  RelojDto,
  RevelacionDto,
  SenalamientoDto,
  VotacionDto,
} from '@contrato/partida';
export type { ConversacionDto, SalaDto, InvitacionDto, ResultadoAccion } from '@contrato/sala';
export { usuarioDe } from '@contrato/participante';
export { SALA_SENALAMIENTO as SENALAMIENTO } from '@contrato/partida';

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
   * Pide una acción a la sala (ver `salaAcciones` en el servidor) y devuelve su
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
  };
}
