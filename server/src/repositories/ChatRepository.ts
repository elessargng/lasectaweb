import { SalaMensaje } from '../types/chat';

/**
 * Dónde se guardan los mensajes de la sala. El servicio solo conoce esta
 * interfaz: se pueden guardar en memoria (como el resto de la sala) o en otro sitio.
 */
export interface ChatRepository {
  guardar(mensaje: SalaMensaje): void;
  /** Los mensajes de los canales que cumplan `incluir`, del más antiguo al más reciente. */
  deCanales(incluir: (canal: string) => boolean): SalaMensaje[];
}

/**
 * Mensajes en memoria, como la sala: se pierden al reiniciar el servidor. Cada
 * canal guarda solo los últimos `maximoPorCanal`.
 */
export class MemoriaChatRepository implements ChatRepository {
  private readonly canales = new Map<string, SalaMensaje[]>();

  constructor(private readonly maximoPorCanal = 200) {}

  guardar(mensaje: SalaMensaje): void {
    const lista = this.canales.get(mensaje.canal) ?? [];
    lista.push(mensaje);
    if (lista.length > this.maximoPorCanal) lista.splice(0, lista.length - this.maximoPorCanal);
    this.canales.set(mensaje.canal, lista);
  }

  deCanales(incluir: (canal: string) => boolean): SalaMensaje[] {
    return [...this.canales.entries()]
      .filter(([canal]) => incluir(canal))
      .flatMap(([, lista]) => lista)
      .sort((a, b) => a.hora - b.hora);
  }
}
