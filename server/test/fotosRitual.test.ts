import { describe, expect, it } from 'vitest';
import { puedeVerFoto, type Ritual, type RitualPhoto } from '../src/models/rituals';
import type { User } from '../src/models/User';
import { MemoriaImagenRepository } from '../src/repositories/ImagenRepository';
import type { RitualPhotoEn, RitualPhotoRepository } from '../src/repositories/RitualPhotoRepository';
import type { RitualRepository } from '../src/repositories/RitualRepository';
import type { UserRepository } from '../src/repositories/UserRepository';
import { FotosRitual } from '../src/services/FotosRitual';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const dataUrl = (tipo: string, datos: Buffer) => `data:image/${tipo};base64,${datos.toString('base64')}`;
const nueva = (alt: string, isPublic = false) => ({ src: dataUrl('jpeg', JPG), alt, public: isPublic });

/** Un evento (y una partida) con sus fotos en memoria, y el servicio que las lleva. */
function montar() {
  const rituales: Ritual[] = [
    { id: 'ev', type: 'jornada', title: 'Jornadas', startsAt: '2099-01-01T10:00:00Z', status: 'programado', createdBy: 'n', createdAt: '', source: 'secta' },
    { id: 'pa', type: 'partida_presencial', title: 'Partida', startsAt: '2099-01-01T10:00:00Z', status: 'programado', createdBy: 'n', createdAt: '', source: 'secta' }
  ];
  const guardadas: RitualPhotoEn[] = [];
  const fotos = {
    listForRituals: async (ids: string[]) => {
      const m = new Map<string, RitualPhoto[]>();
      for (const f of guardadas.filter((g) => ids.includes(g.ritualId))) m.set(f.ritualId, [...(m.get(f.ritualId) ?? []), f]);
      return m;
    },
    findById: async (id: string) => guardadas.find((f) => f.id === id),
    countByUser: async (ritualId: string, userId: string) => guardadas.filter((f) => f.ritualId === ritualId && f.uploadedBy === userId).length,
    add: async (ritualId: string, nuevas: RitualPhoto[]) => void guardadas.push(...nuevas.map((f) => ({ ...f, ritualId }))),
    setPublic: async (id: string, p: boolean) => void (guardadas.find((f) => f.id === id)!.public = p),
    delete: async (id: string) => void guardadas.splice(guardadas.findIndex((f) => f.id === id), 1)
  } as unknown as RitualPhotoRepository;
  const ritualRepo = {
    findById: async (id: string) => rituales.find((r) => r.id === id),
    listWithPhotos: async () => rituales.filter((r) => guardadas.some((f) => f.ritualId === r.id)).map((r) => ({ ...r }))
  } as unknown as RitualRepository;
  const usuarios = {
    findById: async (id: string) => ({ id, roles: id === 'narradora' ? ['narrador'] : [] }) as unknown as User
  } as unknown as UserRepository;
  const imagenes = new MemoriaImagenRepository();
  const servicio = new FotosRitual(imagenes, fotos, ritualRepo, usuarios);
  const verComo = async (userId?: string) => (await servicio.adjuntar([{ ...rituales[0] }], userId))[0].photos ?? [];
  return { servicio, guardadas, imagenes, verComo };
}

describe('fotos de un evento', () => {
  it('cualquier persona registrada sube fotos, aunque el evento no haya pasado', async () => {
    const { servicio, guardadas } = montar();
    await servicio.subir('ana', 'ev', [nueva(' La mesa del grimorio ', true)]);
    expect(guardadas).toEqual([
      expect.objectContaining({
        src: expect.stringMatching(/^\/uploads\/rituales\/ev\/[0-9a-f-]{36}\.jpg$/),
        alt: 'La mesa del grimorio',
        public: true,
        uploadedBy: 'ana'
      })
    ]);
  });

  it('las públicas las ve todo el mundo; las privadas, solo quien las subió', async () => {
    const { servicio, verComo } = montar();
    await servicio.subir('ana', 'ev', [nueva('Pública', true), nueva('Privada')]);
    expect((await verComo()).map((f) => f.alt)).toEqual(['Pública']);
    expect((await verComo('bea')).map((f) => f.alt)).toEqual(['Pública']);
    expect((await verComo('ana')).map((f) => f.alt)).toEqual(['Pública', 'Privada']);
    expect(puedeVerFoto({ public: false, uploadedBy: 'ana' } as RitualPhoto)).toBe(false);
  });

  it('la línea de tiempo trae los eventos con fotos que se pueden ver', async () => {
    const { servicio } = montar();
    await servicio.subir('ana', 'ev', [nueva('Privada')]);
    expect(await servicio.lineaDeTiempo('bea')).toEqual([]);
    expect((await servicio.lineaDeTiempo('ana')).map((r) => r.id)).toEqual(['ev']);
  });

  it('solo quien la subió la hace pública o privada', async () => {
    const { servicio, guardadas, verComo } = montar();
    await servicio.subir('ana', 'ev', [nueva('Una', true)]);
    await expect(servicio.cambiarVisibilidad('bea', 'ev', guardadas[0].id, false)).rejects.toThrow('Solo quien subió la foto');
    await servicio.cambiarVisibilidad('ana', 'ev', guardadas[0].id, false);
    expect(await verComo('bea')).toEqual([]);
  });

  it('la borra quien la subió o un narrador, y se va del disco', async () => {
    const { servicio, guardadas, imagenes } = montar();
    await servicio.subir('ana', 'ev', [nueva('Una', true), nueva('Otra', true)]);
    const [una, otra] = [...guardadas];
    await expect(servicio.borrar('bea', 'ev', una.id)).rejects.toThrow('Acceso denegado');
    await servicio.borrar('ana', 'ev', una.id);
    await servicio.borrar('narradora', 'ev', otra.id);
    expect(guardadas).toEqual([]);
    expect(imagenes.existe('rituales/ev', una.src)).toBe(false);
  });

  it('una privada de otro es como si no existiera', async () => {
    const { servicio, guardadas } = montar();
    await servicio.subir('ana', 'ev', [nueva('Privada')]);
    await expect(servicio.borrar('narradora', 'ev', guardadas[0].id)).rejects.toThrow('La foto no existe.');
  });

  it('solo los eventos llevan fotos', async () => {
    const { servicio } = montar();
    await expect(servicio.subir('ana', 'pa', [nueva('Una')])).rejects.toThrow('Solo los eventos llevan fotos.');
  });

  it('un SVG no se acepta, ni aunque diga ser otra cosa', async () => {
    const { servicio } = montar();
    for (const tipo of ['svg+xml', 'png']) {
      await expect(servicio.subir('ana', 'ev', [{ src: dataUrl(tipo, SVG), alt: 'Un dibujo' }])).rejects.toThrow('no es válida');
    }
  });

  it('cada foto necesita su descripción, y no se guarda ninguna si una no vale', async () => {
    const { servicio, guardadas } = montar();
    await expect(servicio.subir('ana', 'ev', [nueva('Buena'), nueva('  ')])).rejects.toThrow('Describe cada foto');
    expect(guardadas).toEqual([]);
  });

  it('no más de 8 de una vez', async () => {
    const { servicio } = montar();
    const nueve = Array.from({ length: 9 }, () => nueva('Foto'));
    await expect(servicio.subir('ana', 'ev', nueve)).rejects.toThrow('8 fotos de una vez');
  });
});
