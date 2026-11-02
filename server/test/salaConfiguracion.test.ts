import { describe, expect, it } from 'vitest';
import type { PerfilSala, SalaConfiguracionRepository } from '../src/repositories/SalaConfiguracionRepository';
import { ConfiguracionError, SalaConfiguracionService } from '../src/services/SalaConfiguracionService';
import { MAX_PERFILES } from '../src/models/sala/configuracion';

/** Un repositorio en memoria para un usuario. */
function repositorioFalso() {
  let actual: string | null = null;
  const perfiles = new Map<string, string>();
  const repo = {
    getActual: async () => (actual ? JSON.parse(actual) : null),
    setActual: async (_u: string, datos: string) => void (actual = datos),
    listPerfiles: async (): Promise<PerfilSala[]> =>
      [...perfiles].map(([nombre, datos], i) => ({ id: i + 1, nombre, datos: JSON.parse(datos), actualizadoEn: '' })),
    contarPerfiles: async () => perfiles.size,
    existePerfil: async (_u: string, nombre: string) => perfiles.has(nombre),
    guardarPerfil: async (_u: string, nombre: string, datos: string) => void perfiles.set(nombre, datos),
    borrarPerfil: async (_u: string, id: number) => perfiles.delete([...perfiles.keys()][id - 1] ?? ''),
  };
  return repo as unknown as SalaConfiguracionRepository;
}

describe('configuración de la sala', () => {
  it('guarda la actual sin la cámara ni el micrófono', async () => {
    const servicio = new SalaConfiguracionService(repositorioFalso());
    await servicio.guardarActual('u', { idCamara: 'c', avatar: '/a.png', preferencias: { idMicrofono: 'm', tema: 'oscuro' } });
    expect((await servicio.obtener('u')).actual).toEqual({ avatar: '/a.png', preferencias: { tema: 'oscuro' } });
  });

  it('rechaza lo que no es un objeto o es demasiado grande', async () => {
    const servicio = new SalaConfiguracionService(repositorioFalso());
    await expect(servicio.guardarActual('u', [1, 2])).rejects.toThrow(ConfiguracionError);
    await expect(servicio.guardarActual('u', { x: 'a'.repeat(20_000) })).rejects.toThrow('demasiado grande');
  });

  it('un perfil: sin avatar, con el nombre limpio, y como mucho los permitidos', async () => {
    const servicio = new SalaConfiguracionService(repositorioFalso());
    const perfiles = await servicio.guardarPerfil('u', '  Mi   perfil ', { avatar: '/a.png', tema: 'claro' });
    expect(perfiles).toEqual([{ id: 1, nombre: 'Mi perfil', datos: { tema: 'claro' }, actualizadoEn: '' }]);
    await expect(servicio.guardarPerfil('u', '   ', {})).rejects.toThrow('El nombre del perfil');
    for (let i = 1; i < MAX_PERFILES; i++) await servicio.guardarPerfil('u', `p${i}`, {});
    await expect(servicio.guardarPerfil('u', 'uno más', {})).rejects.toThrow(`como mucho ${MAX_PERFILES}`);
    // Sustituir uno que ya existe sí se puede
    expect(await servicio.guardarPerfil('u', 'p1', { tema: 'oscuro' })).toHaveLength(MAX_PERFILES);
  });

  it('borrar un perfil que no existe devuelve null', async () => {
    const servicio = new SalaConfiguracionService(repositorioFalso());
    await servicio.guardarPerfil('u', 'uno', {});
    expect(await servicio.borrarPerfil('u', 99)).toBeNull();
    expect(await servicio.borrarPerfil('u', Number('x'))).toBeNull();
    expect(await servicio.borrarPerfil('u', 1)).toEqual([]);
  });
});
