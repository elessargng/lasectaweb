import { PublicRoleSchema } from '../../types/villacuervos';
import { PersonajeDeFuente, TIPOS_PERSONAJE, TipoPersonaje } from '../../types/guiones';
import { normalizarIdPersonaje } from './idPersonaje';

/**
 * Otra versión de un icono de Villacuervos: el mismo archivo dentro de una
 * carpeta (…/townsfolk/washerwoman.png → …/townsfolk/alt/washerwoman.png).
 */
export function urlVarianteIcono(url: string, carpeta: 'alt' | 'third'): string {
  const u = new URL(url);
  const partes = u.pathname.split('/');
  partes.splice(partes.length - 1, 0, carpeta);
  u.pathname = partes.join('/');
  return u.toString();
}

/**
 * Qué icono de Villacuervos es el bueno y cuál el malvado, según el tipo:
 * - Aldeanos y forasteros: el normal es el bueno; «alt», el malvado.
 * - Esbirros y demonios: el normal es el malvado; «alt», el bueno.
 * - Viajeros: el normal es neutral; «alt», el bueno, y «third», el malvado.
 * - Legendarios y lóricos: solo el normal.
 */
export function iconosPorAlineamiento(
  tipo: TipoPersonaje,
  imagen: string | null,
): { bueno: string | null; malvado: string | null } {
  if (!imagen) return { bueno: null, malvado: null };
  switch (tipo) {
    case 'townsfolk':
    case 'outsider':
      return { bueno: imagen, malvado: urlVarianteIcono(imagen, 'alt') };
    case 'minion':
    case 'demon':
      return { bueno: urlVarianteIcono(imagen, 'alt'), malvado: imagen };
    case 'traveller':
      return { bueno: urlVarianteIcono(imagen, 'alt'), malvado: urlVarianteIcono(imagen, 'third') };
    default:
      return { bueno: null, malvado: null };
  }
}

/**
 * Traduce un rol de la API de Villacuervos a nuestro modelo. Es el único sitio
 * que conoce los dos formatos; null si el rol no sirve (sin id, nombre o tipo conocido).
 */
export function personajeDesdeVillacuervos(rol: PublicRoleSchema): PersonajeDeFuente | null {
  if (!rol?.key || !rol.name || !TIPOS_PERSONAJE.includes(rol.type as TipoPersonaje)) return null;
  const tipo = rol.type as TipoPersonaje;
  const { bueno, malvado } = iconosPorAlineamiento(tipo, rol.image);
  return {
    id: normalizarIdPersonaje(rol.key),
    nombre: rol.name,
    tipo,
    edicion: rol.edition,
    habilidad: rol.ability ?? '',
    recordatorios: rol.reminders,
    recordatoriosGlobales: rol.global_reminders,
    primeraNoche: { orden: rol.first_night_order, recordatorio: rol.first_night },
    otrasNoches: { orden: rol.other_nights_order, recordatorio: rol.other_nights },
    preparacion: !!rol.setup,
    especial: rol.special,
    iconoOrigen: rol.image,
    iconoBuenoOrigen: bueno,
    iconoMalvadoOrigen: malvado,
  };
}
