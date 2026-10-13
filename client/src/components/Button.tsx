import React from 'react';
import { Link } from 'react-router-dom';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'text';
  to?: string;
  href?: string;
  target?: string;
  rel?: string;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  to,
  href,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const isTextVariant = variant === 'text';
  const isLink = !!to;
  const isExternalLink = !!href;

  // Clases base combinadas con la variante y clases personalizadas del desarrollador
  const buttonClasses = isTextVariant
    ? className
    : `btn-runic btn-runic-${variant} ${className}`;

  // Contenido interno con las runas en las esquinas si no es variante puramente texto
  const content = (
    <>
      {!isTextVariant && (
        <span aria-hidden="true">
          <span className="btn-rune btn-rune-tl">ᚠ</span>
          <span className="btn-rune btn-rune-tr">ᚦ</span>
          <span className="btn-rune btn-rune-bl">ᚨ</span>
          <span className="btn-rune btn-rune-br">ᛟ</span>
        </span>
      )}
      {children}
    </>
  );

  if (isLink && to) {
    return (
      <Link
        to={to}
        className={buttonClasses}
        onClick={rest.onClick as any}
        {...(rest as any)}
      >
        {content}
      </Link>
    );
  }

  if (isExternalLink && href) {
    return (
      <a
        href={href}
        className={buttonClasses}
        target={rest.target}
        rel={rest.rel}
        onClick={rest.onClick as any}
        {...(rest as any)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={buttonClasses}
      {...rest}
    >
      {content}
    </button>
  );
};

export default Button;
