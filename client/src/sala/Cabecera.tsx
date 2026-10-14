import type { ReactNode } from 'react';

interface CabeceraProps {
  /** En el centro (el guion de la sala). */
  centro?: ReactNode;
  /** A la derecha (menús del narrador, la mano, participantes, usuario). */
  derecha?: ReactNode;
}

/** Cabecera mínima de la sala: La Secta a la izquierda y, si se pasan, algo en el centro y a la derecha. */
const Cabecera = ({ centro, derecha }: CabeceraProps) => (
  // Capa propia por encima de la sala: sus menús desplegables no quedan tapados por la mesa
  <header className="relative z-40 flex items-center gap-2 px-4 py-2 border-b border-outline-ghost bg-theme-container">
    <div className="flex shrink-0 items-center gap-2">
      <img src="/logo-2.png" alt="" className="w-8 h-8 object-contain drop-shadow-[0_0_6px_var(--color-theme-main)]" />
      <p className="font-teutonic1 tracking-tight text-white text-lg leading-none">La Secta</p>
    </div>
    <div className="flex min-w-0 flex-1 justify-center">{centro}</div>
    {derecha && <div className="shrink-0">{derecha}</div>}
  </header>
);

export default Cabecera;
