import { describe, expect, it } from 'vitest';
import type { Ritual } from '../src/models/rituals';
import type { User } from '../src/models/User';
import type { RitualRepository } from '../src/repositories/RitualRepository';
import type { RitualSignupRepository, RitualSignupRow } from '../src/repositories/RitualSignupRepository';
import type { UserRepository } from '../src/repositories/UserRepository';
import type { FotosRitual } from '../src/services/FotosRitual';
import type { VillacuervosService } from '../src/services/VillacuervosService';
import { RitualService } from '../src/services/RitualService';

/**
 * Un evento gestionado que convoca «orga», con la inscripción en memoria. «admin» es
 * administradora; «narra», narradora que no lo convocó; el resto, gente sin rol.
 */
function montar(overrides: Partial<Ritual> = {}) {
  const evento: Ritual = {
    id: 'ev',
    type: 'jornada',
    title: 'Jornadas Sectarias',
    startsAt: '2099-02-26T15:00:00Z',
    endsAt: '2099-02-28T13:00:00Z',
    managedSignups: true,
    status: 'programado',
    createdBy: 'orga',
    createdAt: '',
    source: 'secta',
    ...overrides
  };
  const roles: Record<string, User['roles']> = { orga: ['narrador'], admin: ['admin'], narra: ['narrador'] };
  const usuarios = ['orga', 'admin', 'narra', 'ana', 'bea', 'carla', 'dani'].map(
    (id) => ({ id, username: id, roles: roles[id] ?? [], isConfirmed: id !== 'dani', profilePicture: '' }) as unknown as User
  );

  let seq = 0;
  let siguiente = 0;
  const filas: Array<RitualSignupRow & { ritualId: string; id: number }> = [];
  const buscar = (ritualId: string, occurrence: string, userId: string) =>
    filas.find((f) => f.ritualId === ritualId && f.occurrence === occurrence && f.userId === userId);
  const inscripciones = {
    listForRituals: async (ids: string[]) => {
      const m = new Map<string, RitualSignupRow[]>();
      for (const f of [...filas].sort((a, b) => a.id - b.id).filter((f) => ids.includes(f.ritualId))) {
        const { ritualId, id: _id, ...fila } = f;
        m.set(ritualId, [...(m.get(ritualId) ?? []), { ...fila }]);
      }
      return m;
    },
    find: async (r: string, o: string, u: string) => buscar(r, o, u),
    add: async (r: string, o: string, u: string) => {
      if (buscar(r, o, u)) return false;
      filas.push({ id: ++siguiente, ritualId: r, occurrence: o, userId: u, username: u, signedUpAt: '' });
      return true;
    },
    accept: async (r: string, o: string, u: string) => {
      if (!buscar(r, o, u)) filas.push({ id: ++siguiente, ritualId: r, occurrence: o, userId: u, username: u, signedUpAt: '' });
      const fila = buscar(r, o, u)!;
      if (fila.acceptedAt) return false;
      fila.acceptedAt = new Date().toISOString();
      fila.acceptedSeq = ++seq;
      return true;
    },
    remove: async (r: string, o: string, u: string) => {
      const i = filas.findIndex((f) => f.ritualId === r && f.occurrence === o && f.userId === u);
      if (i < 0) return false;
      filas.splice(i, 1);
      return true;
    }
  } as unknown as RitualSignupRepository;
  const rituales = { findById: async (id: string) => (id === evento.id ? { ...evento } : undefined) } as unknown as RitualRepository;
  const usuariosRepo = {
    findById: async (id: string) => usuarios.find((u) => u.id === id),
    listAll: async () => usuarios
  } as unknown as UserRepository;
  const fotos = { adjuntar: async (r: Ritual[]) => r } as unknown as FotosRitual;
  const servicio = new RitualService(rituales, usuariosRepo, {} as VillacuervosService, inscripciones, fotos);
  const verComo = async (userId?: string) => (await servicio.getById('ev', userId))!;
  const nombres = (lista?: Array<{ userId: string }>) => (lista ?? []).map((a) => a.userId);
  return { servicio, verComo, nombres };
}

describe('evento gestionado', () => {
  it('quien se apunta queda pendiente: no sale entre los inscritos, pero ve que su solicitud está pendiente', async () => {
    const { servicio, verComo, nombres } = montar();
    await servicio.signUp('ana', 'ev', undefined);

    const ana = await verComo('ana');
    expect(ana.attendanceMode).toBe('inscripcion');
    expect(nombres(ana.attendees)).toEqual([]);
    expect(nombres(ana.pendingAttendees)).toEqual(['ana']);
    expect(ana.canManageSignups).toBe(false);

    const bea = await verComo('bea');
    expect(nombres(bea.attendees)).toEqual([]);
    expect(nombres(bea.pendingAttendees)).toEqual([]);

    expect(nombres((await verComo()).pendingAttendees)).toEqual([]);
  });

  it('quien organiza (y la administración) ve las solicitudes pendientes, en el orden en que se pidieron', async () => {
    const { servicio, verComo, nombres } = montar();
    await servicio.signUp('bea', 'ev', undefined);
    await servicio.signUp('ana', 'ev', undefined);

    for (const quien of ['orga', 'admin']) {
      const vista = await verComo(quien);
      expect(vista.canManageSignups).toBe(true);
      expect(nombres(vista.pendingAttendees)).toEqual(['bea', 'ana']);
    }
    expect((await verComo('narra')).canManageSignups).toBe(false);
  });

  it('los inscritos salen en el orden en que se aceptaron, no en el que se apuntaron', async () => {
    const { servicio, verComo, nombres } = montar();
    await servicio.signUp('ana', 'ev', undefined);
    await servicio.signUp('bea', 'ev', undefined);
    await servicio.signUp('carla', 'ev', undefined);

    await servicio.acceptSignup('orga', 'ev', 'carla');
    await servicio.acceptSignup('orga', 'ev', 'ana');

    const bea = await verComo('bea');
    expect(nombres(bea.attendees)).toEqual(['carla', 'ana']);
    expect(nombres(bea.pendingAttendees)).toEqual(['bea']);
    expect(bea.attendees?.[0].acceptedAt).toBeTruthy();
    expect(nombres((await verComo('orga')).pendingAttendees)).toEqual(['bea']);
  });

  it('quien organiza inscribe a alguien que no lo pidió desde la web, detrás de los ya aceptados', async () => {
    const { servicio, verComo, nombres } = montar();
    await servicio.signUp('ana', 'ev', undefined);
    await servicio.acceptSignup('orga', 'ev', 'ana');
    await servicio.acceptSignup('orga', 'ev', 'bea');

    expect(nombres((await verComo()).attendees)).toEqual(['ana', 'bea']);
    await expect(servicio.acceptSignup('orga', 'ev', 'bea')).rejects.toThrow('ya estaba inscrita');
    await expect(servicio.acceptSignup('orga', 'ev', 'nadie')).rejects.toThrow('no existe');
  });

  it('solo quien organiza (o la administración) acepta, rechaza e inscribe', async () => {
    const { servicio } = montar();
    await servicio.signUp('ana', 'ev', undefined);

    await expect(servicio.acceptSignup('narra', 'ev', 'ana')).rejects.toThrow('Acceso denegado');
    await expect(servicio.acceptSignup('ana', 'ev', 'ana')).rejects.toThrow('Acceso denegado');
    await expect(servicio.removeSignup('bea', 'ev', 'ana')).rejects.toThrow('Acceso denegado');
    await expect(servicio.listSignupCandidates('narra', 'ev')).rejects.toThrow('Acceso denegado');
    await expect(servicio.acceptSignup('admin', 'ev', 'ana')).resolves.toBeTruthy();
  });

  it('se retira una solicitud pendiente, pero no una inscripción aceptada; esa la quita la organización', async () => {
    const { servicio, verComo, nombres } = montar();
    await servicio.signUp('ana', 'ev', undefined);
    await servicio.signUp('bea', 'ev', undefined);
    await servicio.acceptSignup('orga', 'ev', 'ana');

    await servicio.leave('bea', 'ev', undefined);
    expect(nombres((await verComo('orga')).pendingAttendees)).toEqual([]);

    await expect(servicio.leave('ana', 'ev', undefined)).rejects.toThrow('habla con quien organiza');
    await servicio.removeSignup('orga', 'ev', 'ana');
    expect(nombres((await verComo()).attendees)).toEqual([]);
  });

  it('para inscribir se ofrecen las cuentas confirmadas que aún no están inscritas', async () => {
    const { servicio } = montar();
    await servicio.signUp('ana', 'ev', undefined);
    await servicio.acceptSignup('orga', 'ev', 'bea');

    const candidatas = (await servicio.listSignupCandidates('orga', 'ev')).map((c) => c.id);
    expect(candidatas).toContain('ana'); // pendiente: se puede inscribir desde aquí también
    expect(candidatas).not.toContain('bea');
    expect(candidatas).not.toContain('dani'); // sin confirmar
  });

  it('sin gestionar, un evento sigue siendo solo intención de asistir y todos se ven', async () => {
    const { servicio, verComo, nombres } = montar({ managedSignups: undefined });
    await servicio.signUp('ana', 'ev', undefined);

    const vista = await verComo('bea');
    expect(vista.attendanceMode).toBe('intencion');
    expect(nombres(vista.attendees)).toEqual(['ana']);
    expect(vista.pendingAttendees).toBeUndefined();
    await expect(servicio.acceptSignup('orga', 'ev', 'ana')).rejects.toThrow('no tiene la inscripción gestionada');
  });
});
