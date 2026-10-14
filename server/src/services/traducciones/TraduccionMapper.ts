import { PublicPackSchema, PublicTranslationSchema } from '../../types/villacuervos';
import { IDIOMA_ORIGINAL, Idioma, TraduccionPersonaje } from '../../types/guiones';
import { normalizarIdPersonaje } from '../personajes/idPersonaje';

/**
 * Villacuervos da los idiomas en ISO 639-3 («spa»); el navegador y los lectores
 * de pantalla prefieren el código más corto de BCP 47 («es»).
 */
const CODIGOS_BCP47: Record<string, string> = {
  spa: 'es',
  cat: 'ca',
  eus: 'eu',
  glg: 'gl',
  ast: 'ast',
  prt: 'pt',
  por: 'pt',
  eng: 'en',
  fra: 'fr',
  ita: 'it',
  deu: 'de',
};

export function codigoIdioma(codigo: string | null): string {
  if (!codigo) return 'und';
  const c = codigo.trim().toLowerCase();
  return CODIGOS_BCP47[c] ?? c;
}

/** Un paquete de traducción de Villacuervos en nuestro modelo; null si no se puede usar. */
export function idiomaDesdeVillacuervos(p: PublicPackSchema): Idioma | null {
  if (!p.slug || p.slug === IDIOMA_ORIGINAL.id) return null;
  return {
    id: p.slug,
    nombre: p.name?.trim() || p.slug,
    codigo: codigoIdioma(p.language),
    tieneGeneros: !!p.has_genres,
  };
}

/** Villacuervos pone cadenas vacías en lo que no traduce: eso es «sin traducir». */
const texto = (t: string | null | undefined) => (t && t.trim() ? t.trim() : null);

/** Una traducción de Villacuervos en nuestro modelo; null si no traduce nada. */
export function traduccionDesdeVillacuervos(t: PublicTranslationSchema): TraduccionPersonaje | null {
  const personajeId = normalizarIdPersonaje(t.role || '');
  if (!personajeId) return null;
  const traduccion: TraduccionPersonaje = {
    personajeId,
    nombre: texto(t.name),
    habilidad: texto(t.ability),
    recordatorios: texto(t.reminders),
    recordatoriosGlobales: texto(t.global_reminders),
    recordatorioPrimeraNoche: texto(t.first_night),
    recordatorioOtrasNoches: texto(t.other_nights),
  };
  const { personajeId: _, ...textos } = traduccion;
  return Object.values(textos).some((v) => v !== null) ? traduccion : null;
}
