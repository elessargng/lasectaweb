/**
 * Lo que la sala de juego necesita de fuera, como interfaces: se le inyecta al
 * montarla (index.ts) y en los tests se le dan unas falsas. Así la sala no sabe
 * de sockets, de disco ni de bases de datos.
 */
import type { ChatRepository } from '../../repositories/ChatRepository';
import type { GuionResuelto } from '../../models/guiones';
import type { MensajeChat, Susurro } from '../../models/chat';
import type { RegistroPartida } from '../../models/estadisticas/SeguimientoPartida';
import type { Azar, ClienteJev, DatosJev, Temporizador } from '../../models/narradorVirtual/puertos';
import type { ServicioNarradorVirtual } from '../narradorVirtual/NarradorVirtualService';
import type { ProveedorVideo } from '../videollamada/ProveedorVideo';

/**
 * Los guiones de la sala (lo implementa GuionService). Si el guion no vale,
 * rechaza con un GuionInvalidoError.
 */
export interface ServicioGuiones {
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

/** Lo que se guarda o el porqué de que no. */
export type Guardado = { ruta: string } | { error: string };

/** Dónde se guardan las imágenes que se suben a la sala (los avatares y los fondos). */
export interface ImagenesSala {
  /** Guarda un avatar subido (data URL de un JPEG o un GIF): su ruta pública. */
  guardarAvatar(dataUrl: unknown): Guardado;
  /** El avatar si es uno de los permitidos (predefinido o subido a la sala); si no, null. */
  avatarValido(valor: unknown): string | null;
  /** Guarda una imagen como fondo (JPEG, PNG o WebP): su ruta pública. */
  guardarFondo(datos: Buffer): Guardado;
}

/** Por qué se saca a alguien de la sala: entra con su cuenta desde otro sitio, o lo expulsa un narrador. */
export type MotivoExpulsion = 'otraConexion' | 'narrador';

/**
 * Cómo le llega a cada uno lo que pasa en la sala. Hoy, por socket.io (ver
 * controllers/sala/DifusorSocketIo); con otra tecnología, basta con otra implementación.
 * Las conexiones son las de Participantes (un id opaco para la sala).
 */
export interface DifusorSala {
  /** La sala ha cambiado: a cada conexión, lo que le toca ver. */
  estado(): void;
  /** El guion ha cambiado: va aparte del estado, porque es grande. */
  guion(guion: GuionResuelto | null): void;
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

/** Lo que usan las acciones de la sala (ver acciones/). */
export interface DependenciasAcciones {
  guiones: ServicioGuiones;
  /** Las imágenes de la Biblioteca (para elegir un fondo de la sala). */
  imagenesBiblioteca: ImagenesBiblioteca;
  imagenes: ImagenesSala;
  /** El narrador virtual de la sala (lo pone SalaService); sin esto, no se puede añadir. */
  narradorVirtual?: ServicioNarradorVirtual;
}

/** Lo que necesita la sala de juego (SalaService). */
export interface DependenciasSala extends Omit<DependenciasAcciones, 'narradorVirtual'> {
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
  /** El reloj y el azar del narrador virtual (en los tests, unos que no esperan y con semilla); si no, los de verdad. */
  relojNarradorVirtual?: Temporizador;
  azarNarradorVirtual?: Azar;
  /**
   * Para Jarvis: el modelo que ha puesto cada usuario (comprobado alguna vez), o
   * null si no lo tiene; y cómo hablar con él (en los tests, uno falso). Sin esto, no hay Jarvis.
   */
  modeloJarvisDe?: (userId: string) => Promise<DatosJev | null>;
  clienteJev?: (datos: DatosJev) => ClienteJev & { comprobar(): Promise<string | null> };
  /** Las bolsas del narrador virtual en las últimas partidas de cada usuario; sin esto, no se tienen en cuenta. */
  bolsasRecientes?: { de(userId: string): Promise<string[][]>; apuntar(userId: string, personajes: string[]): Promise<void> };
}
