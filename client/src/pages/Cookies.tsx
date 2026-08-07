import React, { useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { Cookie, CheckCircle2, Shield, Info } from 'lucide-react';

const CookiesPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Política de Cookies"
        subtitle="Información transparente sobre las tecnologías de almacenamiento de sesión empleadas en nuestra web"
        imageSrc="/about_banner_wide.jpg"
        imageAlt="Política de Cookies La Secta"
      />

      <div className="max-w-5xl w-full mx-auto px-4 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-surface border border-outline-ghost rounded-lg shadow-2xl p-6 md:p-10 space-y-8 font-body">
          
          {/* Header Banner */}
          <div className="flex items-center gap-3 p-4 bg-surface-low border border-outline-ghost/80 rounded-md text-theme-main">
            <Cookie size={24} className="shrink-0" />
            <p className="text-sm font-display font-medium text-on-surface">
              Solo utilizamos cookies esenciales necesarias para mantener iniciada tu sesión. No empleamos cookies publicitarias ni de seguimiento de terceros.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <Info size={20} /> 1. ¿Qué son las cookies y el almacenamiento local?
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Las cookies y los elementos de almacenamiento local (<em>localStorage</em> / <em>sessionStorage</em>) son pequeños ficheros de datos que se guardan en tu navegador cuando visitas un sitio web para recordar tus preferencias y tu sesión.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <Shield size={20} /> 2. Cookies que utilizamos en La Secta
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Nuestra web utiliza exclusivamente elementos de almacenamiento <strong>estrictamente necesarios y técnicos</strong>:
            </p>
            <div className="bg-surface-low/70 border border-outline-ghost/80 rounded-md p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-theme-main shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-display font-bold text-on-surface">Token de Autenticación de Sesión (JWT / Cookie de sesión)</h4>
                  <p className="text-xs text-on-surface-muted mt-0.5 leading-relaxed">
                    Permite verificar tu identidad mientras navegas por la web para mantener activa tu sesión iniciada de forma segura sin requerir tu clave en cada página.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main">
              3. Ausencia de Cookies Publicitarias y Analítica Invasiva
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              En La Secta no instalamos ni utilizamos cookies de redes publicitarias externas, ni mecanismos de rastreo que monitoricen tu navegación en otros sitios web.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main">
              4. ¿Cómo gestionar o borrar las cookies?
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Puedes configurar tu navegador en cualquier momento para bloquear o eliminar las cookies instaladas. Ten en cuenta que si bloqueas las cookies técnicas necesarias de este sitio, no podrás iniciar sesión ni mantenerte autenticado en tu perfil de La Secta.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default CookiesPage;
