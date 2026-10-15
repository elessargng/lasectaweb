import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import ChangelogModal from './ChangelogModal';
import Footer from './Footer';
import Button from './Button';
import HeaderLink from './HeaderLink';
import { Key, LogOut, X } from 'lucide-react';
import { getAvatarUrl } from '../utils/api';

// Secciones de la web, en el orden en que aparecen en la cabecera y en el menú móvil.
const SECCIONES = [
  { to: '/cronicas', label: 'Crónicas' },
  { to: '/grimorio', label: 'Grimorio' },
  { to: '/escrituras', label: 'Códice' },
  { to: '/biblioteca', label: 'Biblioteca' },
  { to: '/plaza', label: 'Plaza' },
  { to: '/rituales', label: 'Rituales' },
  { to: '/redes', label: 'Redes' },
];

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, isAuthenticated, logout, sessionExpired, dismissSessionExpired } = useAuth();

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menú móvil abierto: el foco entra en él y Escape lo cierra devolviendo el foco al botón.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('a[href], button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsMobileMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  // Al bajar por la página la cabecera se compacta y se vuelve opaca; arriba del todo se funde con la imagen.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Transición común de la cabecera al compactarse (desactivada con prefers-reduced-motion).
  const shrink = 'transition-all duration-300 ease-out motion-reduce:transition-none';

  const rolUsuario = user?.roles && user.roles.length > 0
    ? user.roles.map(r => r === 'admin' ? 'Administrador' : r.charAt(0).toUpperCase() + r.slice(1)).join(' / ')
    : 'Adepto';

  return (
    <div className="min-h-screen flex flex-col selection:bg-theme-main selection:text-background overflow-x-clip">
      <header className="fixed top-0 w-full z-40">
        <div className="cabecera-cristal" data-plana={isScrolled}>
          <div className={`max-w-7xl mx-auto flex justify-between items-center gap-6 px-4 sm:px-6 md:px-10 ${shrink} ${isScrolled ? 'py-1.5' : 'py-3'}`}>
            <Link to="/" className="flex items-center gap-2 md:gap-3 shrink-0 group" onClick={closeMenu}>
              {/* El texto «La Secta» ya nombra el enlace: el logo es decorativo */}
              <img
                src="/logo-2.png"
                alt=""
                className={`object-contain ${shrink} ${isScrolled ? 'w-10 h-10 md:w-11 md:h-11' : 'w-12 h-12 md:w-16 md:h-16'} drop-shadow-[0_0_14px_rgba(212,175,106,0.35)] group-hover:drop-shadow-[0_0_18px_rgba(212,175,106,0.6)]`}
              />
              <h1
                className={`${shrink} ${isScrolled ? 'text-xl md:text-2xl' : 'text-2xl md:text-[2.1rem]'} font-normal tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] whitespace-nowrap`}
                style={{ fontFamily: "'Teutonic No1', 'Cinzel', serif", transform: 'scaleX(0.9)', transformOrigin: 'left', display: 'inline-block' }}
              >
                La Secta
              </h1>
            </Link>

            <nav aria-label="Principal" className="hidden xl:flex gap-6 2xl:gap-8 items-center">
              {SECCIONES.map(s => (
                <HeaderLink key={s.to} to={s.to}>{s.label}</HeaderLink>
              ))}
            </nav>

            <div className="flex items-center gap-3 md:gap-4 shrink-0">
              {isAuthenticated && user ? (
                <>
                  {/* Perfil completo (escritorio) */}
                  <Link
                    to="/profile"
                    className="hidden xl:flex items-center gap-3 pl-1 pr-5 py-1 rounded-full border border-theme-main/25 bg-background/40 hover:border-theme-main/70 hover:bg-theme-main/5 transition-all group"
                  >
                    <span className={`${isScrolled ? 'w-8 h-8' : 'w-10 h-10'} rounded-full ring-1 ring-theme-main/60 group-hover:ring-theme-main ring-offset-2 ring-offset-background overflow-hidden ${shrink}`}>
                      <img src={getAvatarUrl(user.profilePicture)} alt="" className="w-full h-full object-cover" />
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-base font-ui font-semibold tracking-wide text-on-surface group-hover:text-gold-bright transition-colors">{user.username}</span>
                      <span className="text-xs font-body text-on-surface-muted italic">{rolUsuario}</span>
                    </span>
                  </Link>
                  {/* Solo avatar (móvil y tableta) */}
                  <Link
                    to="/profile"
                    className="xl:hidden flex items-center justify-center w-10 h-10 rounded-full ring-1 ring-theme-main/60 hover:ring-theme-main ring-offset-2 ring-offset-background overflow-hidden shrink-0"
                    aria-label={`Perfil de ${user.username}`}
                  >
                    <img src={getAvatarUrl(user.profilePicture)} alt="" className="w-full h-full object-cover" />
                  </Link>
                </>
              ) : (
                <>
                  <div className="hidden xl:block">
                    <Button onClick={() => setIsAuthModalOpen(true)} variant="primary" className="px-6 py-2 text-sm">
                      Identificarse
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="xl:hidden flex items-center justify-center w-10 h-10 rounded-full border border-theme-main/40 hover:border-theme-main text-theme-main bg-background/40 hover:bg-theme-main/10 transition-all shrink-0 cursor-pointer"
                    aria-label="Identificarse"
                  >
                    <Key className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Botón del menú móvil */}
              <button
                ref={menuButtonRef}
                type="button"
                onClick={toggleMenu}
                className="xl:hidden relative flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded z-[60] cursor-pointer"
                aria-label="Menú"
                aria-expanded={isMobileMenuOpen}
                aria-controls="menu-movil"
              >
                <span aria-hidden="true" className={`block w-6 h-px bg-theme-main transition-transform duration-300 motion-reduce:transition-none ${isMobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`}></span>
                <span aria-hidden="true" className={`block w-4 h-px bg-theme-main transition-opacity duration-300 motion-reduce:transition-none ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
                <span aria-hidden="true" className={`block w-6 h-px bg-theme-main transition-transform duration-300 motion-reduce:transition-none ${isMobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`}></span>
              </button>
            </div>
          </div>
          {/* Filo dorado bajo la cabecera, solo cuando está compactada */}
          <div aria-hidden="true" className={`hairline-gold ${shrink} ${isScrolled ? 'opacity-100' : 'opacity-0'}`} />
        </div>

        {/* Aviso de sesión caducada: la región existe siempre para que el lector lo anuncie al aparecer. */}
        <div role="status">
          {sessionExpired && !isAuthenticated && (
            <div className="border-y border-blood/60 bg-blood-deep/95 backdrop-blur">
              <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-2 md:px-10">
                <p className="text-sm font-body text-on-surface">Tu sesión ha caducado. Vuelve a entrar para seguir.</p>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setIsAuthModalOpen(true)} variant="primary" className="px-4 py-1.5 text-xs">
                    Volver a entrar
                  </Button>
                  <Button onClick={dismissSessionExpired} variant="text" aria-label="Cerrar aviso" className="text-on-surface-muted hover:text-theme-main transition-colors p-1 cursor-pointer">
                    <X size={18} />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Velo del menú móvil */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-background/80 backdrop-blur-md z-[50] transition-opacity duration-300 motion-reduce:transition-none xl:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeMenu}
      ></div>

      {/* Menú lateral móvil: cerrado queda fuera de pantalla, y también fuera del tabulador y del lector */}
      <div
        id="menu-movil"
        ref={menuRef}
        inert={!isMobileMenuOpen}
        className={`fixed top-0 right-0 h-full w-[82%] max-w-sm bg-surface border-l border-theme-main/25 shadow-[-30px_0_60px_rgba(0,0,0,0.7)] z-[55] transform transition-transform duration-300 ease-out motion-reduce:transition-none xl:hidden flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Luz de luna en lo alto del panel */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(18,26,51,0.9),transparent_70%)] pointer-events-none" />
        <div className="relative p-6 pt-24 flex flex-col h-full overflow-y-auto">
          {isAuthenticated && user ? (
            <div className="mb-8">
              <Link to="/profile" onClick={closeMenu} className="flex items-center gap-4 p-3 rounded border border-theme-main/20 bg-background/40 hover:border-theme-main/60 transition-all group">
                <span className="w-14 h-14 rounded-full ring-1 ring-theme-main/60 group-hover:ring-theme-main ring-offset-2 ring-offset-surface overflow-hidden shrink-0">
                  <img src={getAvatarUrl(user.profilePicture)} alt="" className="w-full h-full object-cover" />
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-lg font-ui font-semibold text-on-surface group-hover:text-gold-bright transition-colors">{user.username}</span>
                  <span className="text-sm font-body text-on-surface-muted italic">{rolUsuario}</span>
                </span>
              </Link>
            </div>
          ) : (
            <div className="mb-8">
              <Button
                onClick={() => { setIsAuthModalOpen(true); closeMenu(); }}
                variant="primary"
                className="w-full py-3 text-sm"
              >
                Identificarse
              </Button>
            </div>
          )}

          <div aria-hidden="true" className="ornament-divider mb-6"><span className="ornament-diamond" /></div>

          <nav aria-label="Principal" className="flex flex-col">
            {SECCIONES.map(s => (
              <NavLink
                key={s.to}
                to={s.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `group flex items-center gap-4 py-3 border-b border-outline-ghost/60 font-ui text-base font-semibold uppercase tracking-[0.18em] transition-colors ${
                    isActive ? 'text-theme-main' : 'text-on-surface/85 hover:text-gold-bright'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={`w-1.5 h-1.5 rotate-45 shrink-0 transition-colors ${isActive ? 'bg-theme-main shadow-[0_0_8px_rgba(212,175,106,0.8)]' : 'border border-theme-main/50 group-hover:bg-theme-main/60'}`}></span>
                    {s.label}
                  </>
                )}
              </NavLink>
            ))}

            {isAuthenticated && (
              <Button onClick={() => { logout(); closeMenu(); }} variant="text" className="mt-6 flex items-center gap-3 font-ui text-sm font-semibold uppercase tracking-[0.18em] text-blood-bright hover:text-red-300 transition-colors cursor-pointer text-left">
                <LogOut size={16} /> Cerrar sesión
              </Button>
            )}
          </nav>

          <div aria-hidden="true" className="mt-auto pt-10 flex justify-center opacity-40">
            <img src="/logo-2.png" alt="" className="w-14 h-14 object-contain sepia" />
          </div>
        </div>
      </div>

      {/* Deja sitio a la barra fija; PageHeader lo recupera con un margen negativo para que su imagen suba por detrás */}
      <main className="flex-1 w-full pt-[72px] md:pt-[88px] pb-20 relative">
        <Outlet />
      </main>

      <Footer onOpenChangelog={() => setIsChangelogModalOpen(true)} />

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <ChangelogModal isOpen={isChangelogModalOpen} onClose={() => setIsChangelogModalOpen(false)} />
    </div>
  );
};

export default Layout;
