import type { Server } from 'socket.io';
import type { MensajeChat, Susurro } from '../../models/chat';
import type { GuionResuelto } from '../../models/guiones';
import type { SalaService } from '../../services/sala/SalaService';
import type { DifusorSala, MotivoExpulsion } from '../../services/sala/puertos';
import { VistaPartida } from '../../views/VistaPartida';
import { mensajeChatDto, susurroDto } from '../../views/VistaChat';

/** Lo que pasa en la sala, por socket.io: a cada conexión, lo suyo (ver VistaPartida). */
export class DifusorSocketIo implements DifusorSala {
  constructor(
    private readonly io: Server,
    private readonly salaService: SalaService,
  ) {}

  estado(): void {
    const { participantes } = this.salaService.juego.sala;
    const vista = new VistaPartida(this.salaService.juego, this.salaService.contextoVista());
    for (const { socketId, clave } of participantes.conexiones()) {
      this.io.to(socketId).emit('sala:estado', vista.para(participantes.participanteDe(clave)!));
    }
  }

  guion(guion: GuionResuelto | null): void {
    this.io.emit('sala:guion', guion);
  }

  voz(texto: string): void {
    this.io.emit('sala:voz', { texto });
  }

  mensaje(mensaje: MensajeChat, conexiones: string[]): void {
    const dto = mensajeChatDto(mensaje);
    for (const conexion of conexiones) this.io.to(conexion).emit('chat:mensaje', dto);
  }

  susurro(susurro: Susurro): void {
    this.io.emit('sala:susurro', susurroDto(susurro));
  }

  /** El aviso llega antes que el cierre, y el cliente no intenta reconectar. */
  expulsar(conexion: string, motivo: MotivoExpulsion): void {
    this.io.to(conexion).emit('sala:expulsado', { motivo });
    this.io.sockets.sockets.get(conexion)?.disconnect(true);
  }

  sigueAbierta(conexion: string): boolean {
    return this.io.sockets.sockets.has(conexion);
  }
}
