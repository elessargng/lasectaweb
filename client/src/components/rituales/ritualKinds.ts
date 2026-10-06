import { Globe, Feather, Flame, Castle, type LucideIcon } from 'lucide-react';
import type { Ritual, RitualManager, RitualType } from '../../utils/ritualsApi';

/**
 * Cómo se ve cada clase de ritual en la agenda. La partida online se divide en
 * dos según quién la gestione, porque es lo primero que interesa distinguir
 * de un vistazo.
 */
export type RitualKind = 'online_secta' | 'online_villacuervos' | 'presencial' | 'jornada';

export interface RitualKindStyle {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Color base, en hexadecimal para poder componer transparencias. */
  color: string;
}

export const RITUAL_KINDS: Record<RitualKind, RitualKindStyle> = {
  online_secta: { label: 'Partida online · La Secta', shortLabel: 'Online Secta', icon: Globe, color: '#b19cd9' },
  online_villacuervos: { label: 'Partida online · Villacuervos', shortLabel: 'Villacuervos', icon: Feather, color: '#8fb8e8' },
  presencial: { label: 'Partida presencial', shortLabel: 'Presencial', icon: Flame, color: '#d8705f' },
  jornada: { label: 'Evento / Jornadas', shortLabel: 'Jornadas', icon: Castle, color: '#d4af6a' }
};

export const RITUAL_KIND_ORDER: RitualKind[] = ['online_secta', 'online_villacuervos', 'presencial', 'jornada'];

export function kindOf(ritual: Pick<Ritual, 'type' | 'managedBy'>): RitualKind {
  return kindFromParts(ritual.type, ritual.managedBy);
}

export function kindFromParts(type: RitualType, managedBy?: RitualManager | null): RitualKind {
  if (type === 'partida_online') return managedBy === 'villacuervos' ? 'online_villacuervos' : 'online_secta';
  if (type === 'partida_presencial') return 'presencial';
  return 'jornada';
}

/** Añade transparencia a un color hexadecimal de 6 dígitos. */
export function alpha(hex: string, opacity: number): string {
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}
