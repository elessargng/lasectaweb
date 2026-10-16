/**
 * Clases compartidas por las pantallas de la sala. Los botones son los de latón
 * de la web (btn-runic, de piezas.css); el resto de piezas, de sala.css.
 */
const deshabilitado = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/** La acción principal: latón dorado. */
export const botonPrincipal = `btn-runic btn-runic-primary gap-2 px-4 py-2 text-sm ${deshabilitado}`;

/** Una acción secundaria (Cancelar, Cerrar…): tinta con filo de latón. */
export const botonSecundario = `btn-runic btn-runic-secondary gap-2 px-3 py-1.5 text-xs ${deshabilitado}`;

/** Una acción que no se puede deshacer (expulsar, limpiar el grimorio…): lacre. */
export const botonPeligro = `btn-runic btn-runic-danger gap-2 px-4 py-2 text-sm ${deshabilitado}`;

/** Botón redondo de solo icono (cabecera, ventanas): un medallón de latón. */
export const botonIcono = 'sala-boton-icono';

/** Campo de texto o desplegable. */
export const campo = 'campo aria-[invalid=true]:border-blood-bright!';
