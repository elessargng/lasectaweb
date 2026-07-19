import Button from '../components/Button';
import Cita from '../components/Cita';
import PageHeader from '../components/PageHeader';

const Redes = () => {
  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Redes"
        imageSrc="/join_banner_wide.jpg"
        imageAlt="Redes Sociales"
        maxWidthClass="max-w-4xl"
      />

      <div className="max-w-4xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost p-4 md:p-10 rounded-none md:rounded shadow-none md:shadow-2xl relative">

          <Cita texto="Aquí todos *mienten*. Algunos también dicen la *verdad*" />

          <div className="space-y-6">
            {/* Telegram - Destacado como la comunidad principal */}
            <div
              className="group relative flex flex-col md:flex-row items-center gap-6 bg-theme-container/10 hover:bg-theme-container/20 border border-theme-main/30 hover:border-theme-main/60 p-6 md:p-8 rounded transition-all duration-300 shadow-[0_0_15px_rgba(177,156,217,0.02)] hover:shadow-[0_0_25px_rgba(177,156,217,0.1)]"
            >
              <div className="w-16 h-16 bg-theme-container text-theme-main rounded-full flex items-center justify-center border border-theme-main/30 shrink-0 group-hover:scale-105 transition-transform duration-300">
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.36-.49.99-.75 3.87-1.68 6.45-2.78 7.74-3.32 3.69-1.54 4.45-1.81 4.95-1.82.11 0 .36.03.52.16.14.11.18.27.19.38.01.08.02.25.01.32z" />
                </svg>
              </div>
              <div className="text-center md:text-left flex-1">
                <span className="inline-block text-[11px] font-display text-theme-main uppercase tracking-wider bg-theme-container/40 border border-theme-main/20 px-3 py-0.5 rounded mb-2">Comunidad Principal</span>
                <h4 className="text-2xl font-display text-white group-hover:text-theme-main transition-colors">Telegram</h4>
                <p className="text-on-surface-muted font-body mt-1 text-sm leading-relaxed">
                  El epicentro de La Secta. En nuestro grupo organizamos las mesas de juego presenciales y online, votamos fechas de convocatorias y compartimos la pasión por el engaño y la deducción.
                </p>
              </div>
              <div className="shrink-0 w-full md:w-auto flex justify-center">
                <Button
                  href="https://t.me/+bHZ62RndFQI1MmJk"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  className="px-6 py-2.5 text-sm"
                >
                  Unirse a Telegram
                </Button>
              </div>
            </div>

            {/* Redes Secundarias */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* YouTube */}
              <a
                href="https://www.youtube.com/@Lasecta_botc"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 bg-surface-low hover:bg-surface-highest border border-outline-ghost hover:border-theme-main/30 p-5 rounded transition-all duration-300 md:col-span-2"
              >
                <div className="w-12 h-12 bg-[#ff0000] text-white rounded flex items-center justify-center border border-outline-ghost shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.053 0 12 0 12s0 3.947.502 5.837a3.003 3.003 0 0 0 2.11 2.107c1.883.511 9.388.511 9.388.511s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107C24 15.947 24 12 24 12s0-3.947-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-on-surface group-hover:text-theme-main transition-colors text-lg truncate">YouTube</h4>
                  <p className="text-xs text-on-surface-muted font-body mt-1 leading-relaxed">
                    Partidas completas narradas, guías detalladas de personajes, análisis de roles y tutoriales para aprender a jugar y dirigir Blood on the Clocktower.
                  </p>
                </div>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/lasecta.botc/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 bg-surface-low hover:bg-surface-highest border border-outline-ghost hover:border-theme-main/30 p-5 rounded transition-all duration-300"
              >
                <div className="w-12 h-12 bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 text-white rounded flex items-center justify-center border border-outline-ghost shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-on-surface group-hover:text-theme-main transition-colors text-lg truncate">Instagram</h4>
                  <p className="text-xs text-on-surface-muted font-body mt-1 leading-relaxed">
                    Crónicas visuales, fotos de las sesiones de juego de La Secta y resúmenes de eventos especiales.
                  </p>
                </div>
              </a>

              {/* TikTok */}
              <a
                href="https://www.tiktok.com/@lasecta.botc"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 bg-surface-low hover:bg-surface-highest border border-outline-ghost hover:border-theme-main/30 p-5 rounded transition-all duration-300"
              >
                <div className="w-12 h-12 bg-black text-white rounded flex items-center justify-center border border-outline-ghost shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.5-4.09-1.32-.7-.49-1.28-1.15-1.72-1.92-.04 3.12 0 6.24-.04 9.36-.05 1.51-.43 3.07-1.28 4.31-1.34 2-3.71 3.18-6.14 3.05-2.28-.09-4.54-1.34-5.63-3.37-1.22-2.18-1.14-5.06.26-7.14 1.25-1.91 3.51-3.05 5.8-2.92.01 1.34-.02 2.68-.01 4.02-1.35-.11-2.82.49-3.48 1.7-.63 1.09-.37 2.62.59 3.49.92.86 2.37.95 3.37.22.78-.54 1.18-1.47 1.19-2.42V.02h.02z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-on-surface group-hover:text-theme-main transition-colors text-lg truncate">TikTok</h4>
                  <p className="text-xs text-on-surface-muted font-body mt-1 leading-relaxed">
                    Momentos divertidos, clips destacados de las partidas de Blood on the Clocktower y locuras de roles.
                  </p>
                </div>
              </a>

              {/* Twitter / X */}
              <a
                href="https://x.com/lasectabotc"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 bg-surface-low hover:bg-surface-highest border border-outline-ghost hover:border-theme-main/30 p-5 rounded transition-all duration-300"
              >
                <div className="w-12 h-12 bg-black text-white rounded flex items-center justify-center border border-outline-ghost shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-on-surface group-hover:text-theme-main transition-colors text-lg truncate">Twitter / X</h4>
                  <p className="text-xs text-on-surface-muted font-body mt-1 leading-relaxed">
                    Debates de roles, estrategias, hilos explicativos y anuncios rápidos sobre la comunidad.
                  </p>
                </div>
              </a>

              {/* Facebook */}
              <a
                href="https://www.facebook.com/profile.php?id=61591615492395"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 bg-surface-low hover:bg-surface-highest border border-outline-ghost hover:border-theme-main/30 p-5 rounded transition-all duration-300"
              >
                <div className="w-12 h-12 bg-[#1877f2] text-white rounded flex items-center justify-center border border-outline-ghost shrink-0 group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-on-surface group-hover:text-theme-main transition-colors text-lg truncate">Facebook</h4>
                  <p className="text-xs text-on-surface-muted font-body mt-1 leading-relaxed">
                    Nuestra página comunitaria con crónicas escritas de partidas, resúmenes e información institucional.
                  </p>
                </div>
              </a>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Redes;
