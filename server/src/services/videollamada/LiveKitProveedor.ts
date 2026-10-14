import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { ConfigVideollamada } from '../../config/videollamada';
import { PermisosVideo, ProveedorVideo } from './ProveedorVideo';

/** Los pases duran lo justo para entrar; dentro, la conexión se mantiene sola. */
const VIDA_TOKEN = '10m';

/** LiveKit (código abierto, en nuestro servidor) como servidor de vídeo. */
export class LiveKitProveedor implements ProveedorVideo {
  readonly urlPublica: string;
  private readonly api: RoomServiceClient;

  constructor(private readonly config: ConfigVideollamada) {
    this.urlPublica = config.urlPublica;
    this.api = new RoomServiceClient(config.urlApi, config.apiKey, config.apiSecret);
  }

  async token(sala: string, identidad: string, nombre: string, permisos: PermisosVideo): Promise<string> {
    const pase = new AccessToken(this.config.apiKey, this.config.apiSecret, { identity: identidad, name: nombre, ttl: VIDA_TOKEN });
    pase.addGrant({ room: sala, roomJoin: true, canSubscribe: true, canPublishData: false, ...this.permisos(permisos) });
    return pase.toJwt();
  }

  async cambiarPermisos(sala: string, identidad: string, permisos: PermisosVideo): Promise<void> {
    await this.ignorarSiNoEsta(() =>
      this.api.updateParticipant(sala, identidad, { permission: { canSubscribe: true, canPublishData: false, ...this.permisos(permisos) } }),
    );
  }

  async expulsar(sala: string, identidad: string): Promise<void> {
    await this.ignorarSiNoEsta(() => this.api.removeParticipant(sala, identidad));
  }

  async cerrarSala(sala: string): Promise<void> {
    await this.ignorarSiNoEsta(() => this.api.deleteRoom(sala));
  }

  /** Emitir: el micrófono y, si se puede, la cámara (nada de compartir pantalla). */
  private permisos({ publicar, camara }: PermisosVideo) {
    return {
      canPublish: publicar,
      canPublishSources: publicar ? (camara ? [TrackSource.MICROPHONE, TrackSource.CAMERA] : [TrackSource.MICROPHONE]) : [],
    };
  }

  /** Si la persona (o la sala) no está en LiveKit, no hay nada que cambiar: no es un error. */
  private async ignorarSiNoEsta(llamada: () => Promise<unknown>): Promise<void> {
    try {
      await llamada();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (!/not.?found|does not exist|404/i.test(mensaje)) {
        console.error('[Videollamada] Error en el servidor de vídeo:', mensaje);
      }
    }
  }
}
