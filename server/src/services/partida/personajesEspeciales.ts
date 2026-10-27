/**
 * Los personajes con reglas propias en la sala (sus ids del catálogo). Lo que
 * hace cada uno está repartido por la sala; aquí solo se les pone nombre.
 */

/** El NPC con el que el narrador puede pedir silencio a todos: el Bibliotecario del Infierno. */
export const NPC_SILENCIO = 'hellslibrarian';
/** Tor: los jugadores no saben su personaje (lo ven al morir). */
export const NPC_TOR = 'tor';
/** Gardener: el narrador entrega los personajes cuando quiere. */
export const NPC_GARDENER = 'gardener';
/** Bootlegger: el guion tiene reglas propias. */
export const NPC_BOOTLEGGER = 'bootlegger';
/** Pope: puede haber personajes buenos repetidos (en la bolsa). */
export const NPC_POPE = 'pope';
/** Storm Catcher: el narrador nombra un personaje bueno. */
export const NPC_STORMCATCHER = 'stormcatcher';
/** El Barquero: el último día, los muertos recuperan su voto (el narrador lo hace con un botón). */
export const NPC_FERRYMAN = 'ferryman';
/** Revolutionary: los dos asientos con su recordatorio reciben, al repartir la bolsa, personajes del mismo alineamiento. */
export const NPC_REVOLUTIONARY = 'revolutionary';
/** El Carnicero (viajero): vivo, tras la primera ejecución se puede nominar otra vez (no anochece). */
export const VIAJERO_BUTCHER = 'butcher';
/** Lil' Monsta: cada noche los esbirros eligen (señalando) quién lo cuida; ese lleva su «Is The Demon». */
export const DEMONIO_LILMONSTA = 'lilmonsta';
/** Organ Grinder: vivo y sin su «Drunk», las votaciones son secretas (ver SalaNominacion.privada). */
export const ESBIRRO_ORGAN_GRINDER = 'organgrinder';
