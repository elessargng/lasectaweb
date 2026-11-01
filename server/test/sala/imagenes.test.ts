import { describe, expect, it } from 'vitest';
import { MemoriaImagenRepository } from '../../src/repositories/ImagenRepository';
import { ImagenesSala } from '../../src/services/sala/ImagenesSala';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const GIF = Buffer.from('GIF89a......', 'latin1');
const dataUrl = (tipo: string, datos: Buffer) => `data:image/${tipo};base64,${datos.toString('base64')}`;
const conTamano = (cabecera: Buffer, bytes: number) => Buffer.concat([cabecera, Buffer.alloc(bytes - cabecera.length)]);

describe('imágenes de la sala', () => {
  const imagenes = () => new ImagenesSala(new MemoriaImagenRepository());

  it('guarda un avatar JPEG o GIF y luego se puede elegir', () => {
    const sala = imagenes();
    for (const [tipo, datos] of [['jpeg', JPG], ['gif', GIF]] as const) {
      const guardado = sala.guardarAvatar(dataUrl(tipo, datos));
      expect(guardado).toEqual({ ruta: expect.stringMatching(/^\/uploads\/sala\/[0-9a-f-]{36}\.(jpg|gif)$/) });
      expect(sala.avatarValido((guardado as { ruta: string }).ruta)).toBe((guardado as { ruta: string }).ruta);
    }
  });

  it('rechaza un avatar que no es JPEG ni GIF, aunque diga serlo, o que pesa demasiado', () => {
    const sala = imagenes();
    expect(sala.guardarAvatar(dataUrl('png', PNG))).toEqual({ error: 'La imagen no es válida.' });
    expect(sala.guardarAvatar(dataUrl('jpeg', PNG))).toEqual({ error: 'La imagen no es válida.' });
    expect(sala.guardarAvatar('no es una imagen')).toEqual({ error: 'La imagen no es válida.' });
    expect(sala.guardarAvatar(dataUrl('jpeg', conTamano(JPG, 200 * 1024 + 1)))).toEqual({ error: 'La imagen es demasiado grande.' });
    expect(sala.guardarAvatar(dataUrl('gif', conTamano(GIF, 200 * 1024 + 1)))).toHaveProperty('ruta');
  });

  it('solo vale como avatar uno predefinido o uno subido a la sala, no un fondo ni una ruta inventada', () => {
    const sala = imagenes();
    const fondo = sala.guardarFondo(PNG) as { ruta: string };
    expect(fondo.ruta).toMatch(/^\/uploads\/sala\/fondos\/[0-9a-f-]{36}\.png$/);
    expect(sala.avatarValido(fondo.ruta)).toBeNull();
    expect(sala.avatarValido('/uploads/sala/00000000-0000-0000-0000-000000000000.jpg')).toBeNull();
    expect(sala.avatarValido('/uploads/sala/../../secreto.jpg')).toBeNull();
    expect(sala.avatarValido(42)).toBeNull();
  });

  it('un fondo es JPEG, PNG o WebP de hasta 6 MB', () => {
    const sala = imagenes();
    expect(sala.guardarFondo(GIF)).toEqual({ error: 'La imagen no es válida (JPEG, PNG o WebP).' });
    expect(sala.guardarFondo(conTamano(JPG, 6 * 1024 * 1024 + 1))).toEqual({ error: 'La imagen es demasiado grande (máximo 6 MB).' });
    expect(sala.guardarFondo(JPG)).toHaveProperty('ruta');
  });
});
