import type { ReactNode } from 'react';

/** Cabecera mínima de la sala: La Secta a la izquierda y, si se pasa, algo a la derecha. */
const Cabecera = ({ derecha }: { derecha?: ReactNode }) => (
  <header className="flex items-center gap-2 px-4 py-2 border-b border-outline-ghost bg-theme-container">
    <img src="/logo-2.png" alt="" className="w-8 h-8 object-contain drop-shadow-[0_0_6px_var(--color-theme-main)]" />
    <p className="font-teutonic1 tracking-tight text-white text-lg leading-none">La Secta</p>
    {derecha && <div className="ml-auto">{derecha}</div>}
  </header>
);

export default Cabecera;
