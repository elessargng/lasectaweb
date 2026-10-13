/** ids de elementos de la sala a los que se lleva el foco. */
export const ID_SIN_NARRADOR = 'sala-sin-narrador';

export const idNombreNarrador = (participanteId: string) => `sala-narrador-${participanteId}`;

/** El menú del narrador; su botón (MenuDesplegable) lleva `-boton` detrás. */
export const ID_MENU_NARRADOR = 'sala-menu-narrador';
export const ID_BOTON_MENU_NARRADOR = `${ID_MENU_NARRADOR}-boton`;

/** El nombre de un asiento (bajo su cuadro): a él va el foco al sentarse o levantarse. */
export const idNombreAsiento = (asientoId: string) => `sala-asiento-${asientoId}`;
