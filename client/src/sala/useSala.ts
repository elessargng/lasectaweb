import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { notifySessionExpired } from '../utils/session';
import type { SalaMensaje, SalaMensajesPrivados, SalaSusurro } from './chat';
import type { GuionResuelto } from './guiones';

export type SalaRol = 'narrador' | 'jugador' | 'visitante';

/** Forma de la mano que levanta un jugador (como en piedra, papel o tijera). */
export type FormaMano = 'palma' | 'puno' | 'tijera';

export interface SalaParticipante {
  id: string;
  nombre: string;
  conCuenta: boolean;
  /** Ruta del avatar de su cuenta; null para los invitados. */
  avatar: string | null;
  rol: SalaRol;
  /** false mientras se espera a que vuelva tras perder la conexión. */
  conectado: boolean;
  /** Jugador con la mano levantada. */
  manoLevantada: boolean;
  /** La forma de su mano al levantarla. */
  formaMano: FormaMano;
  /** Visitantes: si ha pedido ver el grimorio del narrador, o si lo ve. */
  accesoGrimorio: 'ninguno' | 'solicitado' | 'concedido';
}

/** Un asiento de la mesa, con su ficha (haya alguien sentado o no). */
export interface SalaAsiento {
  id: string;
  /** id del participante sentado, o null si está libre. */
  ocupante: string | null;
  /** Su ficha está muerta (lleva sudario). */
  muerto: boolean;
  /** Su ficha lleva la calavera (solo una de la mesa). */
  marcado: boolean;
  /** Con cuántos votos se le puso la calavera (desde una nominación ya votada), o null. */
  votosMarca: number | null;
  /** El personaje de su ficha (id), o null; solo llega al narrador y a quien se sienta ahí. */
  personaje: string | null;
  /** Su alineamiento si se ha cambiado; null: el de su tipo. */
  alineamiento: SalaAlineamiento | null;
}

export type SalaAlineamiento = 'bueno' | 'malvado';

/** Una conversación privada (voz y vídeo) entre dos o más jugadores o narradores. */
export interface SalaConversacion {
  id: string;
  /** Los que hablan (jugadores y narradores). */
  miembros: string[];
  /** Los visitantes que la escuchan (a los jugadores no les llega: va vacío). */
  oyentes: string[];
}

/** Una invitación a conversar pendiente, hecha o recibida. */
export interface SalaInvitacion {
  id: string;
  de: string;
  para: string;
}

/** El pase para conectarse al servidor de vídeo. */
export type PaseVideo = { ok: true; url: string; token: string } | { ok: false; error: string };

/** Revelando el grimorio (final de la partida): el bando ganador y las fichas ya reveladas. */
export interface SalaRevelacion {
  ganador: SalaAlineamiento;
  reveladas: string[];
  terminada: boolean;
}

/** Cuántos personajes de cada tipo tiene la partida (asientos sin viajero; null con menos de 5). */
export interface SalaDistribucion {
  jugadores: number;
  viajeros: number;
  aldeanos: number | null;
  forasteros: number | null;
  esbirros: number | null;
  demonios: number | null;
}

/** Ajustes de la partida que fija el narrador y valen para todos. */
export interface SalaConfiguracion {
  /** Cada jugador puede cambiar las fichas en su propio grimorio (si no, solo las ve). */
  grimorioJugadores: boolean;
  /** Lo que tarda la aguja en pasar de una ficha a la siguiente al votar, en segundos. */
  segundosPorFicha: number;
  /** Mensajes privados entre jugadores: ninguno, solo con los vecinos o con todos. */
  mensajes: SalaMensajesPrivados;
}

/** La votación de una nominación (ver el servidor). */
export interface SalaVotacion {
  /** Los asientos en el orden en que vota cada uno (el último, el nominado). */
  orden: string[];
  /** Cuántas fichas ha recorrido ya la aguja. */
  paso: number;
  /** Por asiento ya recorrido: los votos acumulados si votó, o null si no. */
  resultados: Record<string, number | null>;
  votos: number;
  terminada: boolean;
}

/** Una votación ya terminada, del registro del narrador. */
export interface SalaRegistroVotacion {
  /** Cuándo se nominó (ms). */
  hora: number;
  /** El día de la partida en que se nominó. */
  dia: number;
  /** «asiento 1 (Ana)» o «asiento 1, libre». */
  nomina: string;
  nominado: string;
  /** Quienes votaron, en orden; null si no se llegó a votar. */
  votantes: string[] | null;
  votos: number | null;
}

/** En qué momento está la partida: preparación, y después noche 1, día 1, noche 2… */
export interface SalaFase {
  momento: 'preparacion' | 'noche' | 'dia';
  /** Número de la noche o del día (0 en la preparación). */
  numero: number;
  /** Veces que se ha limpiado el grimorio. */
  reinicios: number;
}


/** Una nominación en curso: de qué asiento a qué asiento (ids de asiento). */
export interface SalaNominacion {
  desde: string;
  hasta: string;
  /** Cuándo acaba la cuenta atrás (ms, reloj del servidor), o null si no ha empezado. */
  cuentaAtrasFin: number | null;
  /** La votación, desde que acaba la cuenta atrás. */
  votacion: SalaVotacion | null;
  /** Votos que hacen falta para el nominado (los del narrador, o los de por defecto). */
  votosNecesarios: number;
  /** Los de por defecto: la mitad de los vivos y, si hay calavera con votos, uno más que esos. */
  votosNecesariosPorDefecto: number;
}

export interface SalaEstado {
  participantes: SalaParticipante[];
  /** En orden: el primero a las 12 y siguiendo como las agujas del reloj. */
  asientos: SalaAsiento[];
  configuracion: SalaConfiguracion;
  nominacion: SalaNominacion | null;
  /** En qué momento está la partida (preparación, noche N, día N). */
  fase: SalaFase;
  /** El reparto de personajes de la partida. */
  distribucion: SalaDistribucion;
  /** Los personajes metidos en la bolsa (ids); vacía salvo para narradores. */
  bolsa: string[];
  /** Revelando el grimorio (final de la partida), o null. */
  revelacion: SalaRevelacion | null;
  /** Hay videollamada (cámaras y micrófonos) en esta sala. */
  video: boolean;
  /** Las conversaciones privadas en curso (quién habla con quién, no qué). */
  conversaciones: SalaConversacion[];
  /** Las invitaciones a conversar que he hecho o recibido. */
  invitaciones: SalaInvitacion[];
  /** Hora del servidor (ms) al mandar el estado. */
  ahora: number;
  /** Registro de votaciones (la más reciente primero); vacío salvo para narradores. */
  votaciones: SalaRegistroVotacion[];
  /** Mi id en la sala. */
  yo: string;
  /** Acciones que puedo usar ahora; el servidor decide cuáles. */
  acciones: string[];
}

/**
 * `expulsada`: la misma cuenta entró en la sala desde otra ventana.
 * `expulsadaPorNarrador`: un narrador la ha sacado de la sala.
 * En los dos casos no se reintenta la conexión.
 */
export type SalaConexion = 'conectando' | 'conectada' | 'reconectando' | 'expulsada' | 'expulsadaPorNarrador' | 'error';

/** `valor`: lo que devuelve la acción a quien la pidió (p. ej. la ruta del avatar subido). */
export type SalaResultado = { ok: true; valor?: string } | { ok: false; error: string };

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
    alCambiar?: (anterior: SalaEstado | null, nuevo: SalaEstado) => void;
    /** El servidor no deja entrar como invitado con ese nombre: ya lo usa otro. */
    alNombreOcupado?: () => void;
    /** Ha cambiado el guion de la sala (no al entrar, cuando llega el que ya había). */
    alCambiarGuion?: (guion: GuionResuelto | null) => void;
    /** Ha llegado un mensaje de texto (también los propios). */
    alMensaje?: (mensaje: SalaMensaje) => void;
    /** Dos jugadores se han escrito en privado: las ondas de un asiento al otro. */
    alSusurro?: (susurro: SalaSusurro) => void;
  } = {},
) {
  const [estado, setEstado] = useState<SalaEstado | null>(null);
  const [conexion, setConexion] = useState<SalaConexion>('conectando');
  // El guion de la sala: llega aparte del estado (solo al entrar y cuando cambia).
  const [guion, setGuion] = useState<GuionResuelto | null>(null);
  // Diferencia entre el reloj del servidor y el de aquí (ms), para las cuentas atrás.
  const [desfaseReloj, setDesfaseReloj] = useState(0);
  // Los mensajes de texto que se pueden leer (el historial llega al entrar y se le añaden los nuevos).
  const [mensajes, setMensajes] = useState<SalaMensaje[]>([]);
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

    let anterior: SalaEstado | null = null;
    let expulsada = false;
    let guionRecibido = false;
    socket.on('sala:guion', (nuevo: GuionResuelto | null) => {
      if (guionRecibido) avisosRef.current.alCambiarGuion?.(nuevo);
      guionRecibido = true;
      setGuion(nuevo);
    });
    socket.on('sala:estado', (nuevo: SalaEstado) => {
      avisosRef.current.alCambiar?.(anterior, nuevo);
      anterior = nuevo;
      setEstado(nuevo);
      setDesfaseReloj(nuevo.ahora - Date.now());
    });
    socket.on('chat:historial', (lista: SalaMensaje[]) => setMensajes(lista));
    socket.on('chat:mensaje', (mensaje: SalaMensaje) => {
      setMensajes((previos) => (previos.some((m) => m.id === mensaje.id) ? previos : [...previos, mensaje]));
      avisosRef.current.alMensaje?.(mensaje);
    });
    socket.on('sala:susurro', (susurro: SalaSusurro) => avisosRef.current.alSusurro?.(susurro));
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
      new Promise<SalaResultado>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ ok: false, error: 'No hay conexión con la sala.' });
          return;
        }
        socket
          .timeout(5000)
          .emit('sala:accion', { accion, datos }, (err: Error | null, r: SalaResultado) =>
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
      new Promise<SalaResultado>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          resolve({ ok: false, error: 'No hay conexión con la sala.' });
          return;
        }
        socket
          .timeout(5000)
          .emit('chat:enviar', { para, texto }, (err: Error | null, r: SalaResultado) =>
            resolve(err ? { ok: false, error: 'La sala no ha respondido. Inténtalo de nuevo.' } : r),
          );
      }),
    [],
  );

  /** Pide al servidor algo con respuesta (ack), con un tiempo máximo; nunca falla. */
  const pedirAlSocket = useCallback(
    <T extends SalaResultado>(evento: string, datos?: unknown) =>
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

  /** El pase para el vídeo de la mesa («principal») o de una conversación (su id). */
  const pedirPaseVideo = useCallback(
    (sala: string) => pedirAlSocket<SalaResultado & Partial<{ url: string; token: string }>>('video:pase', { sala }) as Promise<PaseVideo>,
    [pedirAlSocket],
  );
  /** Conversaciones privadas: invitar a alguien, responder, retirar la invitación, escuchar (visitantes) y salir. */
  const invitarAConversar = useCallback((con: string) => pedirAlSocket<SalaResultado>('conversacion:invitar', { con }), [pedirAlSocket]);
  const responderInvitacion = useCallback(
    (invitacion: string, aceptar: boolean) => pedirAlSocket<SalaResultado>('conversacion:responder', { invitacion, aceptar }),
    [pedirAlSocket],
  );
  const cancelarInvitacion = useCallback(
    (invitacion: string) => pedirAlSocket<SalaResultado>('conversacion:cancelar', { invitacion }),
    [pedirAlSocket],
  );
  const escucharConversacion = useCallback(
    (conversacion: string) => pedirAlSocket<SalaResultado>('conversacion:escuchar', { conversacion }),
    [pedirAlSocket],
  );
  const salirConversacion = useCallback(() => pedirAlSocket<SalaResultado>('conversacion:salir', {}), [pedirAlSocket]);

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
    responderInvitacion,
    cancelarInvitacion,
    escucharConversacion,
    salirConversacion,
  };
}
