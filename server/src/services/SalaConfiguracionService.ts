import { MAX_PERFILES, nombreDePerfil, prepararConfiguracion } from '../models/sala/configuracion';
import type { PerfilSala, SalaConfiguracionRepository } from '../repositories/SalaConfiguracionRepository';

/** Lo que se pide no vale (el mensaje es para el usuario). */
export class ConfiguracionError extends Error {}

/**
 * La configuración de la sala de cada usuario: la que tiene puesta y sus perfiles
 * con nombre (ver models/sala/configuracion: qué se guarda y cuánto).
 */
export class SalaConfiguracionService {
  constructor(private readonly repositorio: SalaConfiguracionRepository) {}

  /** La configuración actual (null si nunca ha guardado) y sus perfiles. */
  async obtener(userId: string): Promise<{ actual: unknown; perfiles: PerfilSala[] }> {
    const [actual, perfiles] = await Promise.all([this.repositorio.getActual(userId), this.repositorio.listPerfiles(userId)]);
    return { actual, perfiles };
  }

  async guardarActual(userId: string, datos: unknown): Promise<void> {
    const preparada = prepararConfiguracion(datos);
    if ('error' in preparada) throw new ConfiguracionError(preparada.error);
    await this.repositorio.setActual(userId, preparada.json);
  }

  /** Guarda un perfil (si ya tiene uno con ese nombre, lo sustituye): sus perfiles. */
  async guardarPerfil(userId: string, nombre: unknown, datos: unknown): Promise<PerfilSala[]> {
    const limpio = nombreDePerfil(nombre);
    if ('error' in limpio) throw new ConfiguracionError(limpio.error);
    const preparada = prepararConfiguracion(datos, { perfil: true });
    if ('error' in preparada) throw new ConfiguracionError(preparada.error);
    const nuevo = !(await this.repositorio.existePerfil(userId, limpio.nombre));
    if (nuevo && (await this.repositorio.contarPerfiles(userId)) >= MAX_PERFILES) {
      throw new ConfiguracionError(`Puedes tener como mucho ${MAX_PERFILES} perfiles. Borra alguno antes.`);
    }
    await this.repositorio.guardarPerfil(userId, limpio.nombre, preparada.json);
    return this.repositorio.listPerfiles(userId);
  }

  /** Borra uno de sus perfiles: sus perfiles, o null si no existe (o no es suyo). */
  async borrarPerfil(userId: string, id: number): Promise<PerfilSala[] | null> {
    if (!Number.isInteger(id) || !(await this.repositorio.borrarPerfil(userId, id))) return null;
    return this.repositorio.listPerfiles(userId);
  }
}
