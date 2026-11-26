/**
 * Avatares que se pueden elegir para la sala, además del de la cuenta. Son los
 * predefinidos de la web; el servidor tiene la misma lista y solo acepta estos.
 */
export const AVATARES_SALA = [
  { url: '/logo-2.png', etiqueta: 'La Secta' },
  { url: '/avatar.png', etiqueta: 'Adepto' },
  { url: '/avatars/wizard.png', etiqueta: 'Hechicero' },
  { url: '/avatars/sorceress.png', etiqueta: 'Hechicera' },
  { url: '/avatars/rogue.png', etiqueta: 'Asesino' },
  { url: '/avatars/noble.png', etiqueta: 'Noble' },
];

/** El que llevan los invitados si no eligen otro: el logo de La Secta (igual en el servidor). */
export const AVATAR_INVITADO = '/logo-2.png';
