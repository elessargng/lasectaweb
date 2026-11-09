/**
 * Lo que la sala de juego necesita de fuera, como interfaces: se le inyecta al
 * montarla (index.ts) y en los tests se le dan unas falsas. Así la sala no sabe
 * de sockets, de disco ni de bases de datos.
 */
import type { ChatRepository } from '../../repositories/ChatRepository';
import type { ImagenRepository } from '../../repositories/ImagenRepository';
import type { GuionPredeterminado, GuionResuelto } from '../../models/guiones';
import type { MensajeChat, Susurro } from '../../models/chat';
import type { RegistroPartida } from '../../models/estadisticas/SeguimientoPartida';
import type { Azar } from '../../models/partida/azar';
import type { Temporizador } from '../../models/narradorVirtual/puertos';
import type { NarradorIARepository } from '../../repositories/NarradorIARepository';
import type { ProveedorVideo } from '../videollamada/ProveedorVideo';

/**
 * Los guiones de la sala (lo implementa GuionService). Si el guion no vale,
 * rechaza con un GuionInvalidoError.
 */
export interface ServicioGuiones {
  /** Los que se pueden elegir sin cargar un archivo. */
  predeterminados(): GuionPredeterminado[];
  guionPredeterminado(id: string): Promise<GuionResuelto>;
  importar(contenido: unknown, nombreArchivo?: string): Promise<GuionResuelto>;
}

/**
 * Lee una imagen pública de la Biblioteca (como la vería alguien sin cuenta).
 * Rechaza si no existe, no es pública o no es una imagen.
 */
export interface ImagenesBiblioteca {
  leerPublica(versionId: string): Promise<Buffer>;
}

/** Por qué se saca a alguien de la sala: entra con su cuenta desde otro sitio, o lo expulsa un narrador. */
export type MotivoExpulsion = 'otraConexion' | 'narrador';

/**
 * Cómo le llega a cada uno lo que pasa en la sala. Hoy, por socket.io (ver
 * infra/socketio/DifusorSocketIo); con otra tecnología, basta con otra implementación.
 * Las conexiones son las de Participantes (un id opaco para la sala).
 */
export interface DifusorSala {
  /** La sala ha cambiado: a cada conexión, lo que le toca ver. */
  estado(): void;
  /** El guion, aparte del estado porque es grande: a todos cuando cambia, o a una conexión al entrar. */
  guion(guion: GuionResuelto | null, conexion?: string): void;
  /** Los mensajes que puede leer quien está en esa conexión. */
  historial(conexion: string, mensajes: MensajeChat[]): void;
  /** Lo que dice el narrador virtual, para que lo oigan todos. */
  voz(texto: string): void;
  /** Un mensaje de texto, a las conexiones de quienes pueden leerlo. */
  mensaje(mensaje: MensajeChat, conexiones: string[]): void;
  /** Las ondas de un susurro entre jugadores, a todos. */
  susurro(susurro: Susurro): void;
  /** Avisa a una conexión de que se la saca de la sala y la cierra. */
  expulsar(conexion: string, motivo: MotivoExpulsion): void;
  /** Si una conexión sigue abierta. */
  sigueAbierta(conexion: string): boolean;
}

/** Lo que necesita la sala de juego (SalaService). */
export interface DependenciasSala {
  /** Los guiones (los de por defecto y los que se importan). */
  guiones: ServicioGuiones;
  /** Las imágenes de la Biblioteca (para elegir un fondo de la sala). */
  imagenesBiblioteca: ImagenesBiblioteca;
  /** Dónde se guardan los avatares y los fondos que se suben a la sala. */
  imagenes: ImagenRepository;
  /** Dónde se guardan los mensajes de texto de la sala. */
  mensajes: ChatRepository;
  /** El servidor de vídeo (cámaras y micrófonos), o null si no está configurado. */
  video: ProveedorVideo | null;
  /** El avatar de la web de un usuario; sin esto, o si no tiene, ninguno. */
  avatarDe?: (userId: string) => Promise<string | null>;
  /** Dónde se guarda cada partida al terminar (las estadísticas); sin esto, no se guarda. */
  guardarPartida?: (registro: RegistroPartida) => Promise<void>;
  /** Cuántas partidas ha jugado alguien (para el pulpito de novato); sin esto, nadie lo es. */
  contarPartidas?: (userId: string) => Promise<number>;
  /** El azar de la sala (infra/azar; en los tests, con semilla): el reparto, la bolsa, el narrador virtual… */
  azar: Azar;
  /** El reloj del narrador virtual (en los tests, uno que no espera); si no, el de verdad. */
  relojNarradorVirtual?: Temporizador;
  /**
   * Para Jarvis: el modelo de IA con el que decide para cada usuario (en los tests,
   * uno falso), o null si no tiene. Sin esto, no hay Jarvis.
   */
  modelosIA?: (userId: string) => Promise<NarradorIARepository | null>;
  /** Las bolsas del narrador virtual en las últimas partidas de cada usuario; sin esto, no se tienen en cuenta. */
  bolsasRecientes?: { de(userId: string): Promise<string[][]>; apuntar(userId: string, personajes: string[]): Promise<void> };
}
