import React, { useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { ShieldCheck, FileText, Scale, ExternalLink } from 'lucide-react';

const AvisoLegal: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Aviso Legal"
        subtitle="Condiciones generales de uso e información legal del portal web de La Secta"
        imageSrc="/rules_banner_wide.jpg"
        imageAlt="Aviso Legal La Secta"
      />

      <div className="max-w-5xl w-full mx-auto px-4 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-surface border border-outline-ghost rounded-lg shadow-2xl p-6 md:p-10 space-y-8 font-body">
          
          {/* Header Badge */}
          <div className="flex items-center gap-3 p-4 bg-surface-low border border-outline-ghost/80 rounded-md text-theme-main">
            <ShieldCheck size={24} className="shrink-0" />
            <p className="text-sm font-display font-medium text-on-surface">
              Última actualización: Agosto de 2026 • Este sitio web opera como punto de encuentro comunitario sin ánimo de lucro.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <FileText size={20} /> 1. Datos Identificativos
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              En cumplimiento del deber de información, se hace constar que la presente plataforma web es un portal comunitario impulsado por y para la comunidad de afines a los juegos de deducción social y rol conocidos como <strong>La Secta</strong>.
            </p>
            <p className="text-on-surface-muted text-sm leading-relaxed">
              El objetivo principal de este sitio es facilitar la organización de eventos, partidas (tanto en línea como presenciales), la gestión de perfiles de los miembros y la divulgación de las normas de convivencia de nuestro colectivo.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <Scale size={20} /> 2. Condiciones de Uso y Aceptación
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              El acceso y uso de este sitio web le atribuye la condición de usuario e implica la aceptación plena y sin reservas de todas y cada una de las disposiciones incluidas en este Aviso Legal, así como el cumplimiento de las normas comunitarias recogidas en nuestro <strong>Códice</strong>.
            </p>
            <p className="text-on-surface-muted text-sm leading-relaxed">
              El usuario se compromete a hacer un uso adecuado de los contenidos y servicios de la web, absteniéndose de realizar actividades ilícitas, contrarias a la buena fe o al orden público, o que puedan atentar contra la integridad de otros miembros de la comunidad.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <ExternalLink size={20} /> 3. Propiedad Intelectual y Marcas
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Todos los elementos de diseño gráfico, logos propios de La Secta, código fuente y textos creados para esta plataforma son propiedad de sus respectivos autores comunitarios o cuentan con licencia de uso.
            </p>
            <p className="text-on-surface-muted text-sm leading-relaxed">
              <em>Blood on the Clocktower</em> es una marca registrada de The Pandemonium Institute. Las herramientas externas referenciadas o integradas (como <a href="https://www.botc.app" target="_blank" rel="noopener noreferrer" className="text-theme-main underline hover:text-white">botc.app</a> o Telegram) pertenecen a sus respectivos propietarios y desarrolladores.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main">
              4. Exclusión de Responsabilidad
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              La Secta no se hace responsable de las interrupciones temporales del servicio debidas a tareas de mantenimiento técnico o fallos en los servidores, ni del contenido que los usuarios pudieran publicar en áreas interactivas (como publicaciones en la Plaza o comentarios), si bien se reserva el derecho de moderar o eliminar aquellos contenidos que infrinjan el Códice.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main">
              5. Contacto
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Para cualquier consulta relativa a este Aviso Legal o al funcionamiento del sitio web, puedes comunicarte con los administradores de la comunidad a través de nuestras redes sociales oficiales o canales de soporte.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default AvisoLegal;
