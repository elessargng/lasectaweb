import { describe, expect, it } from 'vitest';
import { canalPrivado } from '../../src/models/compartido/chat';
import type { ParticipanteDto } from '../../src/views/dto/participante';
import type { ChatRepository } from '../../src/repositories/ChatRepository';
import { ChatService } from '../../src/services/chat/ChatService';
import type { SalaDeJuego } from '../../src/services/SalaDeJuego';

/** Solo lo que mira `puedeLeer`: el papel y el acceso al grimorio. */
const persona = (id: string, rol: ParticipanteDto['rol'], accesoGrimorio: ParticipanteDto['accesoGrimorio'] = 'ninguno') =>
  ({ id, rol, accesoGrimorio }) as ParticipanteDto;

const ana = persona('ana', 'jugador');
const bea = persona('bea', 'jugador');
const nora = persona('nora', 'narrador');
const conGrimorio = persona('vera', 'visitante', 'concedido');
const sinGrimorio = persona('vito', 'visitante');
const todos = [ana, bea, nora, conGrimorio, sinGrimorio];
const juego = {
  sala: { participantes: { buscar: (id: string) => todos.find((p) => p.id === id) } },
  partida: { acceso: { de: (id: string) => todos.find((p) => p.id === id)?.accesoGrimorio ?? 'ninguno' } },
} as unknown as SalaDeJuego;
const chat = new ChatService({} as ChatRepository, juego);

describe('quién lee los privados', () => {
  it('los privados entre jugadores: los dos, los narradores y los visitantes con el grimorio', () => {
    const canal = canalPrivado(ana.id, bea.id);
    expect(chat.puedeLeer(ana, canal)).toBe(true);
    expect(chat.puedeLeer(nora, canal)).toBe(true);
    expect(chat.puedeLeer(conGrimorio, canal)).toBe(true);
    expect(chat.puedeLeer(sinGrimorio, canal)).toBe(false);
  });

  it('los de un narrador con alguien, solo ellos dos', () => {
    const canal = canalPrivado(nora.id, ana.id);
    expect(chat.puedeLeer(conGrimorio, canal)).toBe(false);
    expect(chat.puedeLeer(bea, canal)).toBe(false);
  });

  it('con el grimorio no se escribe en privado a los jugadores', () => {
    expect(chat.puedeEscribirA(conGrimorio, ana)).toBe(false);
  });
});
