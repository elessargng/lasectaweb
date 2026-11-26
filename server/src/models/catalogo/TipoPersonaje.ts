/** Tipos de personaje, en el orden en que salen en un guion. */
export const TIPOS_PERSONAJE = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric'] as const;
export type TipoPersonaje = (typeof TIPOS_PERSONAJE)[number];

/** Los tipos que van como NPCs de la partida (no se sientan en la plaza). */
export const TIPOS_NPC: readonly TipoPersonaje[] = ['fabled', 'loric'];
