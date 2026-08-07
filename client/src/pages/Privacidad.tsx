import React, { useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { Lock, UserCheck, EyeOff, ShieldAlert } from 'lucide-react';

const Privacidad: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Política de Privacidad"
        subtitle="Protección de datos y tratamiento transparente de la información personal de nuestros miembros"
        imageSrc="/profile_banner_wide.jpg"
        imageAlt="Política de Privacidad La Secta"
      />

      <div className="max-w-5xl w-full mx-auto px-4 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-surface border border-outline-ghost rounded-lg shadow-2xl p-6 md:p-10 space-y-8 font-body">
          
          {/* Header Banner */}
          <div className="flex items-center gap-3 p-4 bg-surface-low border border-outline-ghost/80 rounded-md text-theme-main">
            <Lock size={24} className="shrink-0" />
            <p className="text-sm font-display font-medium text-on-surface">
              En La Secta nos tomamos muy en serio la privacidad. Tratamos tus datos únicamente para gestionar tu participación en la comunidad.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <UserCheck size={20} /> 1. Datos que Recopilamos
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Al registrarte en el portal de La Secta, solicitamos la información estrictamente necesaria para identificarte en las partidas y eventos:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-on-surface-muted text-sm pl-2">
              <li><strong>Nombre de usuario y contraseña:</strong> Para la creación e inicio de sesión de tu cuenta.</li>
              <li><strong>Nombre real u apodo:</strong> Utilizado en las listas de inscripción y partidas de la comunidad.</li>
              <li><strong>Dirección de correo electrónico:</strong> Para verificación de cuenta y notificaciones indispensables.</li>
              <li><strong>Usuario de Telegram y/o BotC.app (opcional):</strong> Para facilitar la organización e integración en las mesas de juego.</li>
              <li><strong>Foto de perfil o avatar:</strong> Para personalizar la experiencia dentro de la plataforma.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <EyeOff size={20} /> 2. Uso y Finalidad de los Datos
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Los datos proporcionados serán utilizados exclusivamente para los siguientes fines:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-on-surface-muted text-sm pl-2">
              <li>Gestión de la cuenta de usuario y autenticación en la plataforma.</li>
              <li>Organización de las partidas de <em>Blood on the Clocktower</em> y asignación en listas de jugadores.</li>
              <li>Publicación del perfil público dentro de la comunidad (solo visible para otros miembros registrados si procede).</li>
            </ul>
            <p className="text-on-surface-muted text-sm leading-relaxed font-semibold text-theme-main mt-2">
              Jamás cederemos, venderemos ni compartiremos tus datos personales con terceros con fines comerciales ni de publicidad.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main flex items-center gap-2">
              <ShieldAlert size={20} /> 3. Conservación y Seguridad
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Tus datos se almacenan de forma segura en bases de datos protegidas por contraseña y cifrado de credenciales. La información se mantendrá activa mientras conserves tu cuenta en La Secta.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h3 className="text-xl font-display font-bold text-theme-main">
              4. Tus Derechos (Derechos ARCO / RGPD)
            </h3>
            <p className="text-on-surface/90 leading-relaxed text-sm md:text-base">
              Como usuario registrado, tienes derecho en cualquier momento a:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-on-surface-muted text-sm pl-2">
              <li>Acceder a la información personal que conservamos sobre ti.</li>
              <li>Modificar o actualizar tus datos a través de tu panel de <strong>Perfil</strong>.</li>
              <li>Solicitar la eliminación completa de tu cuenta y el borrado de tus datos personales.</li>
            </ul>
            <p className="text-on-surface-muted text-sm leading-relaxed mt-2">
              Para solicitar el borrado total de tu cuenta, puedes hacerlo poniéndote en contacto con la administración o desde las opciones habilitadas en tu perfil.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Privacidad;
