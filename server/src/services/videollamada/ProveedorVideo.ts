/** Lo que puede emitir alguien en una sala de vídeo. */
export interface PermisosVideo {
  /** Puede emitir (micrófono y, si `camara`, cámara). Si no, solo ve y oye. */
  publicar: boolean;
  camara: boolean;
  /** Puede emitir el micrófono (por defecto, sí): no, si el narrador ha pedido silencio. */
  microfono?: boolean;
}

/**
 * El servidor de vídeo (el que reparte las cámaras y los micrófonos). Los
 * servicios solo conocen esta interfaz: hoy es LiveKit, mañana podría ser otro.
 * Una «sala» de vídeo es un espacio donde todos se ven y se oyen: la principal
 * (la mesa) y una por conversación privada.
 */
export interface ProveedorVideo {
  /** Dirección a la que se conectan los navegadores. */
  readonly urlPublica: string;
  /** Un pase para entrar en una sala con esos permisos (lo usa el navegador). */
  token(sala: string, identidad: string, nombre: string, permisos: PermisosVideo): Promise<string>;
  /** Cambia los permisos de alguien que ya está dentro (si no está, no hace nada). */
  cambiarPermisos(sala: string, identidad: string, permisos: PermisosVideo): Promise<void>;
  /** Saca a alguien de una sala (si no está, no hace nada). */
  expulsar(sala: string, identidad: string): Promise<void>;
  /** Cierra una sala y saca a todos (si no existe, no hace nada). */
  cerrarSala(sala: string): Promise<void>;
}
