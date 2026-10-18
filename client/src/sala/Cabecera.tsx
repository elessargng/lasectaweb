import { useEffect, useRef, type ReactNode } from 'react';

interface CabeceraProps {
  /** En el centro (el guion de la sala). */
  centro?: ReactNode;
  /** A la derecha (menús del narrador, la mano, participantes, usuario). */
  derecha?: ReactNode;
  /** Junto al logo, ocupando lo que quede hasta el centro (la ciudad, SkylineCabecera). */
  ciudad?: ReactNode;
}

/** Cabecera mínima de la sala: La Secta a la izquierda y, si se pasan, algo en el centro y a la derecha. */
const Cabecera = ({ centro, derecha, ciudad }: CabeceraProps) => {
  // Su alto, en --sala-cabecera-alto: lo fijo de debajo (la hoja del guion) empieza
  // donde acaba, aunque en pantallas estrechas ocupe dos filas
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const cabecera = ref.current!;
    const medir = () => document.documentElement.style.setProperty('--sala-cabecera-alto', `${cabecera.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(cabecera);
    return () => observador.disconnect();
  }, []);

  return (
    // Capa propia por encima de la sala: sus menús desplegables no quedan tapados por la mesa
    // Cristal de tinta con un filo de latón abajo (sala-cabecera, en sala.css)
    // En pantallas anchas, tres columnas (las de los lados, iguales): el centro queda en el
    // centro de la ventana. En estrechas, lo que no cabe pasa a otra fila (sin cambiar el
    // orden, que es el del foco)
    <header ref={ref} className="sala-cabecera relative z-40 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 lg:flex-nowrap xl:grid xl:grid-cols-[1fr_auto_1fr]">
      {/* El logo y, si la hay, la ciudad, que llena el hueco hasta el centro (de la altura de la cabecera) */}
      <div className={`flex min-w-0 items-center gap-3 self-stretch ${ciudad ? 'flex-1' : 'shrink-0'}`}>
        <div className="flex shrink-0 items-center gap-2">
          <img src="/logo-2.png" alt="" className="h-9 w-9 object-contain drop-shadow-[0_0_14px_rgba(212,175,106,0.35)]" />
          <p className="font-teutonic1 text-xl font-normal leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            La Secta
          </p>
        </div>
        {ciudad && <div className="relative -my-2 hidden min-w-0 flex-1 self-stretch sm:block">{ciudad}</div>}
      </div>
      <div className="flex min-w-0 flex-1 justify-center">{centro}</div>
      {derecha && <div className="flex basis-full justify-end lg:basis-auto lg:shrink-0 xl:justify-self-end">{derecha}</div>}
    </header>
  );
};

export default Cabecera;
