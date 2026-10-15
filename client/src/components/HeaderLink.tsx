import React from 'react';
import { NavLink } from 'react-router-dom';

interface HeaderLinkProps {
  to: string;
  children: React.ReactNode;
  isSpecial?: boolean;
}

// Enlace de la cabecera. NavLink marca la página actual con aria-current="page", y el estilo
// (.nav-link en index.css) cuelga de ese atributo: lo que ve el usuario y lo que oye el lector coinciden.
const HeaderLink: React.FC<HeaderLinkProps> = ({ to, children, isSpecial = false }) => (
  <NavLink to={to} className={`nav-link whitespace-nowrap ${isSpecial ? 'text-theme-main' : ''}`}>
    {children}
  </NavLink>
);

export default HeaderLink;
