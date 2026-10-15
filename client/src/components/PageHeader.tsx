import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string | ReactNode;
  imageSrc: string;
  /** La imagen de cabecera es ambiental y se oculta al lector; se conserva por compatibilidad. */
  imageAlt?: string;
  imageOpacity?: string;
  bgClass?: string;
  /** Sin uso desde el rediseño: el degradado funde siempre con el fondo de la web. */
  gradientClass?: string;
  maxWidthClass?: string;
}

/**
 * Cabecera de cada página: la imagen sube por detrás de la barra fija (de ahí el margen negativo,
 * que coincide con el relleno superior de <main> en Layout) y se funde con la noche hacia abajo.
 * El relleno inferior deja sitio a los paneles que muchas páginas montan encima con -mt-20.
 */
export const PageHeader = ({
  title,
  subtitle,
  imageSrc,
  imageOpacity = 'opacity-75',
  bgClass = 'bg-background',
  maxWidthClass = 'max-w-5xl'
}: PageHeaderProps) => {
  return (
    <div className={`relative w-full -mt-[72px] md:-mt-[88px] overflow-hidden ${bgClass}`}>
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src={imageSrc}
          alt=""
          className={`acercar w-full h-full object-cover object-center saturate-[0.65] contrast-[1.05] ${imageOpacity}`}
        />
        {/* Tinte de medianoche, oscuro arriba para la barra y fundido con el fondo abajo */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,13,0.9)_0%,rgba(7,8,13,0.2)_30%,rgba(7,8,13,0.45)_65%,var(--theme-background)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_10%,rgba(18,26,51,0.55),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(7,8,13,0.75)_100%)]" />
      </div>

      <div className={`relative ${maxWidthClass} mx-auto px-6 md:px-8 pt-[136px] md:pt-[176px] pb-24 md:pb-28 min-h-[40vh] md:min-h-[46vh] flex flex-col justify-end`}>
        <div aria-hidden="true" className="revelar flex items-center gap-3 mb-4 text-theme-main">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-theme-main" />
          <span className="ornament-diamond" />
          <span className="h-px w-6 bg-gradient-to-r from-theme-main to-transparent" />
        </div>
        <h2 className="revelar font-display text-4xl md:text-6xl leading-[1.05] tracking-wide text-gilded break-words">
          {title}
        </h2>
        {subtitle && (
          <div className="revelar-tarde mt-3 max-w-2xl font-['Cormorant_Garamond',serif] italic text-lg md:text-xl text-on-surface/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
