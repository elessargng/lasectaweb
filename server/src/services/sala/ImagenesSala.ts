import { comprobarImagen, leerDataUrl, type ReglaImagen } from '../../models/imagenes';
import { SALA_AVATARES } from '../../models/sala/Participantes';
import { AVATAR_SALA, FONDO_SALA } from '../../models/sala/imagenes';
import type { ImagenRepository } from '../../repositories/ImagenRepository';

/** Las colecciones en las que se guardan (las rutas ya guardadas siguen valiendo). */
const AVATARES = 'sala';
const FONDOS = 'sala/fondos';

/** Lo que se guarda o el porqué de que no. */
export type Guardado = { ruta: string } | { error: string };

/** Las imágenes que se suben a la sala: se comprueban (ver models/sala/imagenes) y se guardan. */
export class ImagenesSala {
  constructor(private readonly repositorio: ImagenRepository) {}

  /** Un avatar propio para la sala: un JPEG o un GIF (animado o no) en data URL. */
  guardarAvatar(dataUrl: unknown): Guardado {
    const imagen = leerDataUrl(dataUrl);
    return imagen ? this.guardar(AVATARES, imagen.datos, AVATAR_SALA) : { error: AVATAR_SALA.noValida };
  }

  /** El avatar si es uno de los permitidos (predefinido o subido a la sala); si no, null (el por defecto). */
  avatarValido(valor: unknown): string | null {
    if (typeof valor !== 'string') return null;
    return SALA_AVATARES.includes(valor) || this.repositorio.existe(AVATARES, valor) ? valor : null;
  }

  /** Un fondo para la sala: JPEG, PNG o WebP. */
  guardarFondo(datos: Buffer): Guardado {
    return this.guardar(FONDOS, datos, FONDO_SALA);
  }

  private guardar(coleccion: string, datos: Buffer, regla: ReglaImagen): Guardado {
    const comprobada = comprobarImagen(datos, regla);
    if ('error' in comprobada) return comprobada;
    return { ruta: this.repositorio.guardar(coleccion, comprobada.formato, datos) };
  }
}
