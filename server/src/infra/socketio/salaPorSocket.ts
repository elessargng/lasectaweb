import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { BolsaController } from '../../controllers/sala/BolsaController';
import type { DiaController } from '../../controllers/sala/DiaController';
import type { FaseController } from '../../controllers/sala/FaseController';
import type { FarolController } from '../../controllers/sala/FarolController';
import type { NarradorVirtualController } from '../../controllers/sala/NarradorVirtualController';
import type { NocheController } from '../../controllers/sala/NocheController';
import type { PreparacionController } from '../../controllers/sala/PreparacionController';
import type { RelojController } from '../../controllers/sala/RelojController';
import type { RevelacionController } from '../../controllers/sala/RevelacionController';
import type { SenalamientoController } from '../../controllers/sala/SenalamientoController';
import type { Credenciales, SalaController, Sesion } from '../../controllers/sala/SalaController';
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

/** Los controladores de la sala: el general y el de cada parte. */
export interface ControladoresSala {
  sala: SalaController;
  bolsa: BolsaController;
  faroles: FarolController;
  dia: DiaController;
  fase: FaseController;
  narradorVirtual: NarradorVirtualController;
  noche: NocheController;
  preparacion: PreparacionController;
  reloj: RelojController;
  revelacion: RevelacionController;
  senalamiento: SenalamientoController;
}

/** Los eventos de cada parte de la sala, y el método de su controlador que los atiende. */
const PETICIONES_PARTES = {
  bolsa: {
    'bolsa:meter': 'meter',
    'bolsa:cantidad': 'cantidad',
    'bolsa:vaciar': 'vaciar',
    'bolsa:llenarAlAzar': 'llenarAlAzar',
    'bolsa:aceptarReparto': 'aceptarReparto',
  },
  faroles: {
    'faroles:preparar': 'preparar',
    'faroles:poner': 'poner',
    'faroles:usar': 'usar',
    'faroles:copiar': 'copiar',
  },
  dia: {
    'dia:darPalabra': 'darPalabra',
    'dia:nominar': 'nominar',
    'dia:cerrarNominacion': 'cerrarNominacion',
    'dia:votosNecesarios': 'votosNecesarios',
    'dia:cuentaAtras': 'cuentaAtras',
    'dia:reiniciarVotacion': 'reiniciarVotacion',
    'dia:marcar': 'marcar',
    'dia:desmarcar': 'desmarcar',
    'dia:ejecutar': 'ejecutar',
  },
  fase: {
    'fase:noche': 'irANoche',
    'fase:amanecer': 'amanecer',
    'fase:volverAtras': 'volverAtras',
    'fase:limpiarGrimorio': 'limpiarGrimorio',
  },
  narradorVirtual: {
    'narradorVirtual:anadir': 'anadir',
    'narradorVirtual:quitar': 'quitar',
    'narradorVirtual:nominar': 'nominar',
    'narradorVirtual:defensa': 'defensa',
    'narradorVirtual:voto': 'voto',
    'narradorVirtual:listo': 'listo',
    'narradorVirtual:seguirNominando': 'seguirNominando',
  },
  noche: {
    'noche:despertar': 'despertar',
    'noche:enviar': 'enviar',
    'noche:despertarHabilidad': 'despertarHabilidad',
    'noche:resolverHabilidad': 'resolverHabilidad',
    'noche:nuevoImp': 'nuevoImp',
    'noche:recordatorio': 'recordatorio',
  },
  preparacion: {
    'preparacion:configurar': 'configurar',
    'preparacion:privados': 'privados',
    'preparacion:guion': 'guion',
    'preparacion:fondo': 'fondo',
    'preparacion:npc': 'npc',
    'preparacion:bootlegger': 'bootlegger',
    'preparacion:stormcatcher': 'stormcatcher',
    'preparacion:silencio': 'silencio',
    'preparacion:asignarPersonajes': 'asignarPersonajes',
    'preparacion:entregarFichas': 'entregarFichas',
  },
  reloj: {
    'reloj:sonarGong': 'sonarGong',
    'reloj:poner': 'poner',
    'reloj:terminar': 'terminar',
    'reloj:quitar': 'quitar',
  },
  revelacion: {
    'revelacion:empezar': 'empezar',
    'revelacion:revelarFicha': 'revelarFicha',
    'revelacion:terminar': 'terminar',
  },
  senalamiento: {
    'senalamiento:empezar': 'empezar',
    'senalamiento:lilmonsta': 'lilmonsta',
    'senalamiento:terminar': 'terminar',
    'senalamiento:senalar': 'senalar',
  },
} as const satisfies { [P in Exclude<keyof ControladoresSala, 'sala'>]: Record<string, keyof ControladoresSala[P]> };

/** Cómo atiende un controlador de una parte cada petición. */
type Atender = (sesion: Sesion, peticion: unknown, responder: (respuesta: unknown) => void) => void;

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
  controladores: ControladoresSala,
): void {
  const { sala: salaController } = controladores;
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
    for (const [parte, peticiones] of Object.entries(PETICIONES_PARTES)) {
      const controlador = controladores[parte as keyof typeof PETICIONES_PARTES];
      for (const [evento, metodo] of Object.entries(peticiones)) {
        const atender = controlador[metodo as keyof typeof controlador] as Atender;
        socket.on(evento, (peticion: unknown, ack?: unknown) => atender(sesion, peticion, contestar(ack)));
      }
    }
    // Las declaraciones del día con narrador virtual: una por personaje que la tiene
    for (const id of controladores.narradorVirtual.declaraciones()) {
      const atender = controladores.narradorVirtual.declarar(id) as Atender;
      socket.on(`declarar:${id}`, (peticion: unknown, ack?: unknown) => atender(sesion, peticion, contestar(ack)));
    }
    socket.on('chat:historial', () => salaController.historial(sesion));
    socket.on('disconnect', (reason) => salaController.salir(sesion, reason === 'client namespace disconnect'));
  });
}
