import type { ReglaImagen } from '../imagenes';

const MB = 1024 * 1024;

/**
 * Los avatares que sube cada participante solo para la sala (su perfil de la web
 * no cambia). El cliente reduce antes las fotos (256 px, JPEG); los GIF animados
 * van tal cual (reducirlos los dejaría quietos), así que pueden pesar más.
 */
export const AVATAR_SALA: ReglaImagen = {
  maximos: { jpg: 200 * 1024, gif: 1.5 * MB },
  noValida: 'La imagen no es válida.',
  demasiadoGrande: 'La imagen es demasiado grande.',
};

/** Los fondos de la sala: los sube el narrador o los elige de la Biblioteca. */
export const FONDO_SALA: ReglaImagen = {
  maximos: { jpg: 6 * MB, png: 6 * MB, webp: 6 * MB },
  noValida: 'La imagen no es válida (JPEG, PNG o WebP).',
  demasiadoGrande: 'La imagen es demasiado grande (máximo 6 MB).',
};
