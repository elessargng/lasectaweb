import type { ReactNode } from 'react';

/**
 * Lo que hace el botón al pulsarlo, en un rótulo bajo él al pasar el ratón (o al
 * llegar con el teclado). Solo a la vista: el lector ya oye su nombre, su estado y,
 * si no se puede usar, por qué. Con el botón desplegado (un menú abierto) no sale:
 * taparía lo desplegado.
 */
const ConAyuda = ({ texto, alinear = 'derecha', children }: { texto: string; alinear?: 'izquierda' | 'derecha'; children: ReactNode }) => (
  <span className="group relative inline-flex">
    {children}
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute ${alinear === 'derecha' ? 'right-0' : 'left-0'} top-full z-50 mt-1.5 w-max max-w-56 rounded-md border border-theme-main/40 bg-surface-highest px-2 py-1 font-ui text-xs text-on-surface opacity-0 shadow-lg transition-opacity delay-300 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-has-[[aria-expanded=true]]:hidden motion-reduce:transition-none`}
    >
      {texto}
    </span>
  </span>
);

export default ConAyuda;
