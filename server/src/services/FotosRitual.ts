import { randomUUID } from 'crypto';
import { comprobarImagen, leerDataUrl, type FormatoImagen } from '../models/imagenes';
import {
  FOTO_RITUAL,
  MAX_PHOTOS_PER_PERSON,
  MAX_PHOTOS_PER_UPLOAD,
  MAX_RITUAL_PHOTO_ALT,
  puedeVerFoto,
  type Ritual,
  type RitualPhoto
} from '../models/rituals';
import type { ImagenRepository } from '../repositories/ImagenRepository';
import type { RitualPhotoRepository } from '../repositories/RitualPhotoRepository';
import type { RitualRepository } from '../repositories/RitualRepository';
import type { UserRepository } from '../repositories/UserRepository';

/** Una foto que llega, ya comprobada y por guardar. */
interface FotoNueva {
  alt: string;
  public: boolean;
  formato: FormatoImagen;
  datos: Buffer;
}

/** Cada evento guarda sus fotos en su colección. */
const coleccion = (ritualId: string) => `rituales/${ritualId}`;

/**
 * Las fotos de los eventos: las sube cualquier persona registrada (antes, durante o
 * después del evento), cada una pública o privada (solo la ve quien la subió).
 */
export class FotosRitual {
  constructor(
    private readonly imagenes: ImagenRepository,
    private readonly fotos: RitualPhotoRepository,
    private readonly rituales: RitualRepository,
    private readonly usuarios: UserRepository
  ) {}

  /** A los eventos, las fotos que puede ver quien los pide (los demás rituales no llevan). */
  async adjuntar(rituals: Ritual[], viewerId?: string): Promise<Ritual[]> {
    const eventos = rituals.filter((r) => r.type === 'jornada' && r.source === 'secta');
    const porEvento = await this.fotos.listForRituals(eventos.map((r) => r.id));
    for (const r of eventos) {
      const visibles = (porEvento.get(r.id) ?? []).filter((f) => puedeVerFoto(f, viewerId));
      r.photos = visibles.length > 0 ? visibles : undefined;
    }
    return rituals;
  }

  /** Los eventos con fotos que puede ver quien la pide, del más reciente al más antiguo. */
  async lineaDeTiempo(viewerId?: string): Promise<Ritual[]> {
    return (await this.adjuntar(await this.rituales.listWithPhotos(), viewerId)).filter((r) => r.photos);
  }

  /** Sube fotos a un evento: se comprueban todas antes de guardar nada. */
  async subir(userId: string, ritualId: string, raw: unknown): Promise<void> {
    const ritual = await this.rituales.findById(ritualId);
    if (!ritual) throw new Error('El ritual no existe.');
    if (ritual.type !== 'jornada') throw new Error('Solo los eventos llevan fotos.');
    const nuevas = comprobarFotos(raw);
    const yaSubidas = await this.fotos.countByUser(ritualId, userId);
    if (yaSubidas + nuevas.length > MAX_PHOTOS_PER_PERSON) {
      throw new Error(`Cada persona puede subir ${MAX_PHOTOS_PER_PERSON} fotos a un evento como mucho (llevas ${yaSubidas}).`);
    }

    const ahora = new Date().toISOString();
    const guardadas: RitualPhoto[] = [];
    try {
      for (const f of nuevas) {
        guardadas.push({
          id: randomUUID(),
          src: this.imagenes.guardar(coleccion(ritualId), f.formato, f.datos),
          alt: f.alt,
          public: f.public,
          uploadedBy: userId,
          uploadedAt: ahora
        });
      }
      await this.fotos.add(ritualId, guardadas);
    } catch (error) {
      // Que no queden en el disco las que no llegaron a la base de datos
      for (const f of guardadas) this.borrarArchivo(ritualId, f.src);
      console.error('[RITUALES] No se han podido guardar las fotos:', error);
      throw new Error('No se han podido guardar las fotos.');
    }
  }

  /** Quien subió una foto la hace pública o privada. */
  async cambiarVisibilidad(userId: string, ritualId: string, photoId: string, isPublic: unknown): Promise<void> {
    if (typeof isPublic !== 'boolean') throw new Error('Indica si la foto es pública o no.');
    const foto = await this.foto(ritualId, photoId, userId);
    if (foto.uploadedBy !== userId) throw new Error('Acceso denegado. Solo quien subió la foto puede cambiarla.');
    await this.fotos.setPublic(photoId, isPublic);
  }

  /** Borra una foto: quien la subió, o un narrador o administrador. */
  async borrar(userId: string, ritualId: string, photoId: string): Promise<void> {
    const foto = await this.foto(ritualId, photoId, userId);
    if (foto.uploadedBy !== userId && !(await this.organiza(userId))) {
      throw new Error('Acceso denegado. Solo quien subió la foto (o un narrador) puede borrarla.');
    }
    await this.fotos.delete(photoId);
    this.borrarArchivo(ritualId, foto.src);
  }

  /** Al borrar un evento: sus fotos, del disco (de la base de datos se van con él). */
  async borrarDelRitual(ritualId: string): Promise<void> {
    for (const foto of (await this.fotos.listForRituals([ritualId])).get(ritualId) ?? []) {
      this.borrarArchivo(ritualId, foto.src);
    }
  }

  /** La foto de ese evento, si quien la pide puede verla (si no, como si no existiera). */
  private async foto(ritualId: string, photoId: string, userId: string): Promise<RitualPhoto> {
    const foto = await this.fotos.findById(photoId);
    if (!foto || foto.ritualId !== ritualId || !puedeVerFoto(foto, userId)) throw new Error('La foto no existe.');
    return foto;
  }

  private async organiza(userId: string): Promise<boolean> {
    const user = await this.usuarios.findById(userId);
    return !!user && (user.roles.includes('narrador') || user.roles.includes('admin'));
  }

  private borrarArchivo(ritualId: string, src: string): void {
    try {
      this.imagenes.borrar(coleccion(ritualId), src);
    } catch (error) {
      console.warn('[RITUALES] No se ha podido borrar una foto:', (error as Error).message);
    }
  }
}

/** Las fotos que llegan (en data URL), comprobadas: cada una con lo que se ve en ella y si es pública. */
export function comprobarFotos(raw: unknown): FotoNueva[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Elige alguna foto.');
  if (raw.length > MAX_PHOTOS_PER_UPLOAD) throw new Error(`Se pueden subir ${MAX_PHOTOS_PER_UPLOAD} fotos de una vez como mucho.`);
  return raw.map((foto): FotoNueva => {
    const alt = typeof foto?.alt === 'string' ? foto.alt.trim() : '';
    if (!alt) throw new Error('Describe cada foto: lo que se ve en ella, para quien no puede verla.');
    if (alt.length > MAX_RITUAL_PHOTO_ALT) {
      throw new Error(`La descripción de una foto no puede pasar de ${MAX_RITUAL_PHOTO_ALT} caracteres.`);
    }
    const imagen = leerDataUrl(foto.src);
    if (!imagen) throw new Error(FOTO_RITUAL.noValida);
    const comprobada = comprobarImagen(imagen.datos, FOTO_RITUAL);
    if ('error' in comprobada) throw new Error(comprobada.error);
    return { alt, public: foto.public === true, formato: comprobada.formato, datos: imagen.datos };
  });
}
