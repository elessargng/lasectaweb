import { describe, expect, it } from 'vitest';
import { canalPrivado } from '../../src/contrato/chat';
import type { SalaParticipante } from '../../src/contrato/sala';
import type { ChatRepository } from '../../src/repositories/ChatRepository';
import { ChatService } from '../../src/services/chat/ChatService';
import type { SalaService } from '../../src/services/SalaService';

/** Solo lo que mira `puedeLeer`: el papel y el acceso al grimorio. */
const persona = (id: string, rol: SalaParticipante['rol'], accesoGrimorio: SalaParticipante['accesoGrimorio'] = 'ninguno') =>
  ({ id, rol, accesoGrimorio }) as SalaParticipante;

const ana = persona('ana', 'jugador');
const bea = persona('bea', 'jugador');
const nora = persona('nora', 'narrador');
const conGrimorio = persona('vera', 'visitante', 'concedido');
const sinGrimorio = persona('vito', 'visitante');
const todos = [ana, bea, nora, conGrimorio, sinGrimorio];
const sala = { buscar: (id: string) => todos.find((p) => p.id === id) } as unknown as SalaService;
const chat = new ChatService({} as ChatRepository, sala);

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
