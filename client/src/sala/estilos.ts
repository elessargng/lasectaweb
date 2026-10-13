/** Clases compartidas por las pantallas de la sala (no usa los botones rúnicos de la web). */
const foco = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main';

export const botonPrincipal = `rounded bg-theme-container border border-theme-main px-4 py-2 font-semibold text-white hover:bg-theme-main hover:text-background disabled:opacity-60 aria-disabled:opacity-60 ${foco} focus-visible:ring-offset-2 focus-visible:ring-offset-background`;

export const botonSecundario = `rounded border border-outline-ghost px-3 py-1 text-sm text-on-surface hover:border-theme-main ${foco}`;

/** Botón redondo de solo icono de la cabecera (participantes, narrador…). */
export const botonIcono = `relative flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-theme-main/20 aria-expanded:bg-theme-main/20 ${foco}`;
