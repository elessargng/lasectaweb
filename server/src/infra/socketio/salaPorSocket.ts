import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { BolsaController } from '../../controllers/sala/BolsaController';
import type { RelojController } from '../../controllers/sala/RelojController';
import type { RevelacionController } from '../../controllers/sala/RevelacionController';
import type { Credenciales, SalaController } from '../../controllers/sala/SalaController';
import type { SalaService } from '../../services/sala/SalaService';
import { DifusorSocketIo } from './DifusorSocketIo';

/** Bajo /api para que pase por el mismo proxy que el resto de la API. */
export const SALA_SOCKET_PATH = '/api/socket.io';

/** Los eventos que se contestan por ack, y el método de SalaController que los atiende. */
const PETICIONES = {
  'sala:accion': 'accion',
  'chat:enviar': 'enviarMensaje',
  'video:pase': 'pase',
  'conversacion:invitar': 'invitar',
  'conversacion:pedirUnirse': 'pedirUnirse',
  'conversacion:responder': 'responderInvitacion',
  'conversacion:cancelar': 'cancelarInvitacion',
  'conversacion:entrar': 'entrarEnConversacion',
  'conversacion:escuchar': 'escucharConversacion',
  'conversacion:salir': 'salirDeConversacion',
} as const satisfies Record<string, keyof SalaController>;

/** Los de la bolsa, y el método de BolsaController que los atiende. */
const PETICIONES_BOLSA = {
  'bolsa:meter': 'meter',
  'bolsa:cantidad': 'cantidad',
  'bolsa:vaciar': 'vaciar',
  'bolsa:llenarAlAzar': 'llenarAlAzar',
  'bolsa:aceptarReparto': 'aceptarReparto',
} as const satisfies Record<string, keyof BolsaController>;

/** Los del gong y el reloj, y el método de RelojController que los atiende. */
const PETICIONES_RELOJ = {
  'reloj:sonarGong': 'sonarGong',
  'reloj:poner': 'poner',
  'reloj:terminar': 'terminar',
  'reloj:quitar': 'quitar',
} as const satisfies Record<string, keyof RelojController>;

/** Los de la revelación del grimorio, y el método de RevelacionController que los atiende. */
const PETICIONES_REVELACION = {
  'revelacion:empezar': 'empezar',
  'revelacion:revelarFicha': 'revelarFicha',
  'revelacion:terminar': 'terminar',
} as const satisfies Record<string, keyof RevelacionController>;

/** Los controladores de la sala: el general y el de cada parte. */
export interface ControladoresSala {
  sala: SalaController;
  bolsa: BolsaController;
  reloj: RelojController;
  revelacion: RevelacionController;
}

/** Contesta por el ack del evento, si el cliente lo ha pedido. */
const contestar = (ack: unknown) => (respuesta: unknown) => {
  if (typeof ack === 'function') ack(respuesta);
};

/**
 * La sala de juego por WebSocket (socket.io) sobre ese servidor HTTP: lleva cada
 * evento a su controlador, como las rutas de la API, y lo que pasa en la sala se
 * manda por DifusorSocketIo.
 */
export function abrirSalaPorSocket(
  httpServer: HttpServer,
  salaService: SalaService,
  { sala: salaController, bolsa: bolsaController, reloj: relojController, revelacion: revelacionController }: ControladoresSala,
): void {
  const io = new Server(httpServer, {
    path: SALA_SOCKET_PATH,
    cors: { origin: '*' },
    // Un fondo de la sala subido desde el ordenador (data URL) puede pasar de 1 MB
    maxHttpBufferSize: 8 * 1024 * 1024,
  });
  salaService.difundirCon(new DifusorSocketIo(io, salaService));

  // Aquí solo se identifica: se entra en la sala al completarse la conexión. Si se
  // entrase ya y la conexión se cortara ahora (StrictMode, recarga rápida), nunca
  // llegaría su 'disconnect' y quedaría un participante fantasma.
  io.use(async (socket, next) => {
    const credenciales = await salaController.identificar(socket.handshake.auth);
    if ('error' in credenciales) return next(new Error(credenciales.error));
    socket.data.credenciales = credenciales;
    next();
  });

  io.on('connection', (socket) => {
    const sesion = salaController.entrar(socket.id, socket.data.credenciales as Credenciales);
    for (const [evento, metodo] of Object.entries(PETICIONES)) {
      socket.on(evento, (peticion: unknown, ack?: unknown) => void salaController[metodo](sesion, peticion, contestar(ack)));
    }
    for (const [evento, metodo] of Object.entries(PETICIONES_BOLSA)) {
      socket.on(evento, (peticion: unknown, ack?: unknown) => bolsaController[metodo](sesion, peticion, contestar(ack)));
    }
    for (const [evento, metodo] of Object.entries(PETICIONES_RELOJ)) {
      socket.on(evento, (peticion: unknown, ack?: unknown) => relojController[metodo](sesion, peticion, contestar(ack)));
    }
    for (const [evento, metodo] of Object.entries(PETICIONES_REVELACION)) {
      socket.on(evento, (peticion: unknown, ack?: unknown) => revelacionController[metodo](sesion, peticion, contestar(ack)));
    }
    socket.on('chat:historial', () => salaController.historial(sesion));
    socket.on('disconnect', (reason) => salaController.salir(sesion, reason === 'client namespace disconnect'));
  });
}
