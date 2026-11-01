import type { ImagenesSala } from '../../services/sala/puertos';
import { guardarAvatarSala, limpiarAvatarSala } from './salaAvatarStorage';
import { guardarFondoSala } from './salaFondoStorage';

/** Las imágenes de la sala, como archivos en UPLOAD_DIR/sala (servidas por /uploads). */
export const imagenesSalaEnDisco: ImagenesSala = {
  guardarAvatar: guardarAvatarSala,
  avatarValido: limpiarAvatarSala,
  guardarFondo: guardarFondoSala,
};
