/** ids de elementos de la sala a los que se lleva el foco. */
export const ID_SIN_NARRADOR = 'sala-sin-narrador';

export const idNombreNarrador = (participanteId: string) => `sala-narrador-${participanteId}`;

/** El menú del narrador; su botón (MenuDesplegable) lleva `-boton` detrás. */
export const ID_MENU_NARRADOR = 'sala-menu-narrador';
export const ID_BOTON_MENU_NARRADOR = `${ID_MENU_NARRADOR}-boton`;

/** El nombre de un asiento (bajo su cuadro): a él va el foco al sentarse o levantarse. */
export const idNombreAsiento = (asientoId: string) => `sala-asiento-${asientoId}`;

/** El asa para mover al jugador de un asiento (editando asientos). */
export const idAsaMover = (asientoId: string) => `sala-mover-${asientoId}`;

/** Instrucciones del asa de mover, que cada asa lleva como descripción. */
export const ID_AYUDA_MOVER = 'sala-mover-ayuda';

/** El botón «Cuenta atrás» de una nominación: a él va el foco al abrirla. */
export const ID_CUENTA_ATRAS = 'sala-nominacion-cuenta-atras';

/** El botón de la ficha de un jugador cuando se elige a quién nomina (o para cancelarlo). */
export const idFichaNominar = (participanteId: string) => `sala-ficha-nominar-${participanteId}`;
