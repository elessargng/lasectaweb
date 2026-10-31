/** Una conversación privada (voz y vídeo) entre dos o más jugadores o narradores. */
export interface Conversacion {
  id: string;
  /** ids de los participantes que hablan en ella (jugadores y narradores). */
  miembros: string[];
  /** ids de los que solo la escuchan (visitantes y narradores): ni hablan ni se les ve. */
  oyentes: string[];
}

/**
 * Una invitación a conversar, pendiente de que `para` la acepte o la rechace. Con
 * `conversacion`, es una petición para unirse a la de `para`: la ven y la pueden
 * aceptar todos sus miembros.
 */
export interface Invitacion {
  id: string;
  de: string;
  para: string;
  conversacion?: string;
}
