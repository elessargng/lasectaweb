import { randomUUID } from 'crypto';
import { ChatRepository } from '../../repositories/ChatRepository';
import {
  CANAL_GENERAL,
  CANAL_VISITANTES,
  canalPrivado,
  participantesDePrivado,
  SalaMensaje,
  SalaSusurro,
} from '../../types/chat';
import { SalaParticipante } from '../../types/sala';
import { SalaService } from '../SalaService';

/** Un mensaje que no se puede mandar (el mensaje de error es para quien escribe). */
export class ChatError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ChatError';
  }
}

export const LARGO_MAXIMO_MENSAJE = 500;

/** Lo que pasa al mandar un mensaje: el mensaje, a quién le llega y, si es un susurro, las ondas. */
export interface EnvioMensaje {
  mensaje: SalaMensaje;
  /** ids de los participantes que pueden leerlo (incluido quien lo escribe). */
  lectores: string[];
  susurro: SalaSusurro | null;
}

/**
 * Las reglas de los mensajes de la sala: quién lee cada canal y a quién puede
 * escribir cada uno.
 *
 * - General: jugadores y narradores. Visitantes: visitantes y narradores.
 * - Privados: con un narrador, siempre (en los dos sentidos). Entre jugadores,
 *   según la sala: ninguno, solo con sus vecinos (el más cercano sentado a cada
 *   lado) o con todos. Los visitantes no escriben en privado a los jugadores.
 *
 * Lee la sala (papeles, asientos, ajustes) de SalaService y guarda en el repositorio.
 */
export class ChatService {
  constructor(
    private readonly repositorio: ChatRepository,
    private readonly sala: SalaService,
    private readonly ahora: () => number = () => Date.now(),
  ) {}

  /** Si alguien puede leer (y escribir en) un canal. */
  puedeLeer(yo: SalaParticipante, canal: string): boolean {
    if (canal === CANAL_GENERAL) return yo.rol === 'jugador' || yo.rol === 'narrador';
    if (canal === CANAL_VISITANTES) return yo.rol === 'visitante' || yo.rol === 'narrador';
    return !!participantesDePrivado(canal)?.includes(yo.id);
  }

  /** Si `yo` puede escribir en privado a `otro`. */
  puedeEscribirA(yo: SalaParticipante, otro: SalaParticipante): boolean {
    if (yo.id === otro.id) return false;
    if (yo.rol === 'narrador' || otro.rol === 'narrador') return true;
    if (yo.rol !== 'jugador' || otro.rol !== 'jugador') return false;
    const modo = this.sala.configuracion().mensajes;
    if (modo === 'todos') return true;
    if (modo === 'vecinos') return this.vecinos(yo.id).includes(otro.id);
    return false;
  }

  /** Los mensajes que alguien puede leer, del más antiguo al más reciente. */
  historial(yo: SalaParticipante): SalaMensaje[] {
    return this.repositorio.deCanales((canal) => this.puedeLeer(yo, canal));
  }

  /**
   * Manda un mensaje. `para`: «general», «visitantes» o el id de un participante
   * (en privado). Lanza ChatError si no se puede.
   */
  enviar(yoId: string, para: string, texto: string): EnvioMensaje {
    const yo = this.sala.buscar(yoId);
    if (!yo) throw new ChatError('Ya no estás en la sala.');
    const limpio = texto.trim();
    if (!limpio) throw new ChatError('El mensaje está vacío.');
    if (limpio.length > LARGO_MAXIMO_MENSAJE) throw new ChatError(`El mensaje es demasiado largo (máximo ${LARGO_MAXIMO_MENSAJE}).`);

    let canal: string;
    let otro: SalaParticipante | undefined;
    if (para === CANAL_GENERAL || para === CANAL_VISITANTES) {
      if (!this.puedeLeer(yo, para)) throw new ChatError('No puedes escribir en ese chat.');
      canal = para;
    } else {
      otro = this.sala.buscar(para);
      if (!otro) throw new ChatError('Esa persona ya no está en la sala.');
      if (!this.puedeEscribirA(yo, otro)) throw new ChatError(this.porQueNo(yo, otro));
      canal = canalPrivado(yo.id, otro.id);
    }

    const mensaje: SalaMensaje = { id: randomUUID(), canal, autor: yo.id, autorNombre: yo.nombre, texto: limpio, hora: this.ahora() };
    this.repositorio.guardar(mensaje);
    const lectores = otro ? [yo.id, otro.id] : this.sala.participantes().filter((p) => this.puedeLeer(p, canal)).map((p) => p.id);
    return { mensaje, lectores, susurro: otro ? this.susurro(yo, otro, limpio) : null };
  }

  /** Por qué no puede escribirle (para el mensaje de error). */
  private porQueNo(yo: SalaParticipante, otro: SalaParticipante): string {
    if (yo.id === otro.id) return 'No puedes escribirte a ti mismo.';
    if (yo.rol !== 'jugador' || otro.rol !== 'jugador') return 'Solo puedes escribir en privado a los narradores.';
    return this.sala.configuracion().mensajes === 'vecinos'
      ? 'En esta sala solo se escribe en privado con los vecinos.'
      : 'En esta sala no se escriben mensajes privados.';
  }

  /** Los vecinos de un jugador: el más cercano sentado a cada lado de la mesa. */
  vecinos(participanteId: string): string[] {
    const mesa = this.sala.asientos();
    const i = mesa.findIndex((a) => a.ocupante === participanteId);
    if (i < 0) return [];
    const n = mesa.length;
    const cercano = (paso: 1 | -1) => {
      for (let k = 1; k < n; k++) {
        const ocupante = mesa[(i + paso * k + n) % n].ocupante;
        if (ocupante) return ocupante;
      }
      return null;
    };
    return [...new Set([cercano(1), cercano(-1)].filter((id): id is string => !!id && id !== participanteId))];
  }

  /** Entre dos jugadores sentados, las ondas del susurro (más intensas cuanto más largo). */
  private susurro(yo: SalaParticipante, otro: SalaParticipante, texto: string): SalaSusurro | null {
    if (yo.rol !== 'jugador' || otro.rol !== 'jugador') return null;
    const mesa = this.sala.asientos();
    const desde = mesa.find((a) => a.ocupante === yo.id)?.id;
    const hasta = mesa.find((a) => a.ocupante === otro.id)?.id;
    if (!desde || !hasta) return null;
    return { desde, hasta, intensidad: texto.length < 40 ? 1 : texto.length < 140 ? 2 : 3 };
  }
}
