import { describe, expect, it } from 'vitest';
import type { User } from '../src/models/User';
import { MemoriaImagenRepository } from '../src/repositories/ImagenRepository';
import type { RoleRequestRepository } from '../src/repositories/RoleRequestRepository';
import type { UserRepository } from '../src/repositories/UserRepository';
import { UserService } from '../src/services/UserService';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const dataUrl = (tipo: string, datos: Buffer) => `data:image/${tipo};base64,${datos.toString('base64')}`;

/** Un usuario en memoria y el servicio que lo edita. */
function montar() {
  let usuario = { id: 'u1', username: 'ana', profilePicture: '/avatar.png', roles: [] } as unknown as User;
  const usuarios = {
    findById: async () => usuario,
    update: async (u: User) => (usuario = u),
  } as unknown as UserRepository;
  const servicio = new UserService(usuarios, {} as RoleRequestRepository, new MemoriaImagenRepository());
  return { servicio, foto: () => usuario.profilePicture };
}

describe('foto de perfil', () => {
  it('una imagen subida se guarda y queda su ruta', async () => {
    const { servicio, foto } = montar();
    await servicio.updateProfile('u1', { profilePicture: dataUrl('jpeg', JPG) });
    expect(foto()).toMatch(/^\/uploads\/avatars\/\d{4}\/\d{2}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
  });

  it('uno de los avatares de la web se deja como viene', async () => {
    const { servicio, foto } = montar();
    await servicio.updateProfile('u1', { profilePicture: '/avatars/cuervo.png' });
    expect(foto()).toBe('/avatars/cuervo.png');
  });

  it('un SVG no se acepta, ni aunque diga ser otra cosa, y la foto no cambia', async () => {
    const { servicio, foto } = montar();
    for (const tipo of ['svg+xml', 'png']) {
      await expect(servicio.updateProfile('u1', { profilePicture: dataUrl(tipo, SVG) })).rejects.toThrow(
        'La foto de perfil no es válida (JPEG, PNG, WebP o GIF).',
      );
    }
    expect(foto()).toBe('/avatar.png');
  });

  it('una imagen de más de 1 MB no se acepta', async () => {
    const { servicio } = montar();
    const grande = Buffer.concat([JPG, Buffer.alloc(1024 * 1024)]);
    await expect(servicio.updateProfile('u1', { profilePicture: dataUrl('jpeg', grande) })).rejects.toThrow('demasiado grande');
  });
});
