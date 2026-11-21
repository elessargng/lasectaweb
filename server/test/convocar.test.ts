import { describe, expect, it } from 'vitest';
import type { Ritual, RitualInput } from '../src/models/rituals';
import type { User } from '../src/models/User';
import type { RitualRepository } from '../src/repositories/RitualRepository';
import type { RitualSignupRepository } from '../src/repositories/RitualSignupRepository';
import type { UserRepository } from '../src/repositories/UserRepository';
import type { FotosRitual } from '../src/services/FotosRitual';
import type { VillacuervosService } from '../src/services/VillacuervosService';
import { RitualService } from '../src/services/RitualService';

/** Rituales en memoria. «ana» y «bea», sin rol; «narra», narradora; «admin», administradora. */
function montar() {
  const roles: Record<string, User['roles']> = { narra: ['narrador'], admin: ['admin'] };
  const usuarios = ['ana', 'bea', 'narra', 'admin'].map(
    (id) => ({ id, username: id, roles: roles[id] ?? [], isConfirmed: true }) as unknown as User
  );
  const guardados = new Map<string, Ritual>();
  const rituales = {
    findById: async (id: string) => (guardados.has(id) ? { ...guardados.get(id)! } : undefined),
    create: async (id: string, createdBy: string, input: RitualInput) =>
      void guardados.set(id, { ...input, id, createdBy, createdAt: '', status: 'programado', source: 'secta' } as Ritual),
    update: async (id: string, input: RitualInput) => void guardados.set(id, { ...guardados.get(id)!, ...input } as Ritual),
    delete: async (id: string) => void guardados.delete(id)
  } as unknown as RitualRepository;
  const usuariosRepo = {
    findById: async (id: string) => usuarios.find((u) => u.id === id),
    listAll: async () => usuarios
  } as unknown as UserRepository;
  const inscripciones = { listForRituals: async () => new Map() } as unknown as RitualSignupRepository;
  const fotos = { adjuntar: async (r: Ritual[]) => r, borrarDelRitual: async () => {} } as unknown as FotosRitual;
  const servicio = new RitualService(rituales, usuariosRepo, {} as VillacuervosService, inscripciones, fotos);
  const evento = { type: 'jornada', title: 'Jornadas Sectarias', startsAt: '2099-02-26T15:00:00Z' };
  return { servicio, guardados, evento };
}

describe('convocar rituales', () => {
  it('cualquier persona registrada convoca partidas y eventos', async () => {
    const { servicio, evento } = montar();
    const creado = await servicio.create('ana', evento);
    expect(creado).toMatchObject({ title: 'Jornadas Sectarias', createdBy: 'ana' });
    await servicio.create('ana', { type: 'partida_presencial', title: 'Partida', startsAt: '2099-03-01T18:00:00Z' });
    expect((await servicio.listStorytellers('ana')).map((s) => s.id)).toEqual(['narra']);
  });

  it('una cuenta que no existe no convoca', async () => {
    const { servicio, evento } = montar();
    await expect(servicio.create('nadie', evento)).rejects.toThrow('Usuario no encontrado.');
  });

  it('lo cambia y lo cancela quien lo convocó, o un narrador o administrador; nadie más', async () => {
    const { servicio, guardados, evento } = montar();
    const { id } = await servicio.create('ana', evento);
    await expect(servicio.update('bea', id, { ...evento, title: 'Otro' })).rejects.toThrow('Acceso denegado');
    await expect(servicio.delete('bea', id)).rejects.toThrow('Acceso denegado');

    await servicio.update('ana', id, { ...evento, title: 'Jornadas de febrero' });
    await servicio.update('narra', id, { ...evento, title: 'Jornadas de La Secta' });
    expect(guardados.get(id)?.title).toBe('Jornadas de La Secta');

    await servicio.delete('admin', id);
    expect(guardados.has(id)).toBe(false);
    await expect(servicio.delete('ana', id)).rejects.toThrow('El ritual no existe.');
  });
});
