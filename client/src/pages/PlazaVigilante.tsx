import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  Clock,
  ShieldCheck,
  ScrollText,
  Scale,
  BellRing,
  Mail,
  KeyRound,
  Search,
  TriangleAlert
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

/**
 * Qué es el vigilante de La Plaza y cómo sacarle partido, para quien no tiene
 * conocimientos técnicos. Se enlaza desde el perfil, junto a la opción de
 * recibir sus avisos.
 */
const PlazaVigilante = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sectionTitle = 'text-xl font-display text-theme-main flex items-center gap-2 mb-3';
  const paragraph = 'text-on-surface/90 leading-relaxed text-sm md:text-base';
  const card = 'bg-surface-low border border-outline-ghost rounded p-4';

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="El Vigilante"
        subtitle="El que comprueba, hora a hora, que las votaciones y el Códice están en orden"
        imageSrc="/profile_banner_wide.jpg"
        imageAlt="El Vigilante de La Plaza"
        maxWidthClass="max-w-3xl"
      />

      <div className="max-w-3xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 space-y-10 font-body">
          {/* Qué es */}
          <section>
            <h3 className={sectionTitle}>
              <Eye className="w-5 h-5" /> Qué es
            </h3>
            <p className={`${paragraph} mb-3`}>
              El vigilante es un programa que trabaja solo, sin que nadie tenga que acordarse de
              ponerlo en marcha. <strong>Cada hora</strong> repasa todas las votaciones de La Plaza
              y todas las normas del Códice, y comprueba que todo sigue en orden.
            </p>
            <p className={paragraph}>
              Piensa en él como alguien que cuadra la caja de un bar cada hora: no sabe quién ha
              pagado qué, pero sí se da cuenta enseguida si falta o sobra un euro.
            </p>
          </section>

          {/* Cómo funciona */}
          <section>
            <h3 className={sectionTitle}>
              <Clock className="w-5 h-5" /> Cómo lo sabe
            </h3>
            <p className={`${paragraph} mb-4`}>
              Cada voto se guarda con un <strong>precinto</strong>: una especie de huella dactilar
              calculada a partir del voto y del precinto del voto anterior. Los votos quedan así
              encadenados, como los eslabones de una cadena, y basta con recorrerla para saber
              que cada voto sigue siendo el que se emitió. Eso es lo que hace el vigilante, de
              principio a fin.
            </p>
            <p className={`${paragraph} mb-3`}>En cada ronda comprueba que:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={card}>
                <p className="font-display text-on-surface mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-theme-main" /> Los votos cuadran
                </p>
                <p className="text-sm text-on-surface-muted">
                  Cada voto es el que se emitió, y el número de votos coincide con el de personas
                  que han participado.
                </p>
              </div>
              <div className={card}>
                <p className="font-display text-on-surface mb-1 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-theme-main" /> La pregunta es la misma
                </p>
                <p className="text-sm text-on-surface-muted">
                  El texto de cada propuesta es exactamente el que se convocó: lo que se vota es
                  lo que se propuso.
                </p>
              </div>
              <div className={card}>
                <p className="font-display text-on-surface mb-1 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-theme-main" /> El resultado es el que salió
                </p>
                <p className="text-sm text-on-surface-muted">
                  Una votación figura como aprobada o rechazada solo si eso es lo que dicen sus
                  votos, y se cerró cuando tocaba.
                </p>
              </div>
              <div className={card}>
                <p className="font-display text-on-surface mb-1 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-theme-main" /> Las leyes son las votadas
                </p>
                <p className="text-sm text-on-surface-muted">
                  Cada norma del Códice dice exactamente lo que aprobó su votación, y las normas
                  de siempre siguen como estaban.
                </p>
              </div>
            </div>
            <p className={`${paragraph} mt-4`}>
              Además, cierra las votaciones cuyo plazo ha terminado, lleva al Códice lo que se ha
              aprobado y reenvía los correos de resultado que no hubieran llegado a salir. Antes
              de cambiar una ley comprueba la votación: si algo no cuadra, no la aplica.
            </p>
          </section>

          {/* Lo que no hace */}
          <section>
            <h3 className={sectionTitle}>
              <KeyRound className="w-5 h-5" /> Lo que no hace
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-on-surface/90 text-sm md:text-base">
              <li>
                <strong>No sabe qué has votado.</strong> Nadie lo sabe: la lista de quién ha
                participado y los votos se guardan por separado y no hay forma de unirlos.
              </li>
              <li>
                <strong>No decide nada.</strong> Solo comprueba. Las decisiones las toma la
                comunidad votando.
              </li>
              <li>
                <strong>No informa a una sola persona.</strong> Sus avisos llegan siempre a
                quienes administran la web, y también a todas las personas que los activen, para
                que la información esté repartida.
              </li>
            </ul>
          </section>

          {/* Cómo usarlo */}
          <section>
            <h3 className={sectionTitle}>
              <BellRing className="w-5 h-5" /> Cómo usarlo
            </h3>
            <p className={`${paragraph} mb-4`}>
              No tienes que hacer nada para que el vigilante funcione: trabaja siempre. Si te
              apetece participar, esto es lo que puedes hacer:
            </p>
            <ol className="space-y-4">
              <li className={card}>
                <p className="font-display text-on-surface mb-1">
                  1. Activa sus avisos en tu perfil
                </p>
                <p className="text-sm text-on-surface-muted">
                  Están desactivados por defecto. Si los activas, recibirás un correo{' '}
                  <strong>solo si algo no cuadra</strong>. Si todo va bien, no recibirás nada: el
                  silencio es buena señal. Cuantas más personas los tengan activados, más repartida
                  está la información.{' '}
                  {isAuthenticated ? (
                    <Link to="/profile" className="text-theme-main hover:underline">
                      Ir a mi perfil
                    </Link>
                  ) : (
                    <span>Para activarlos, inicia sesión y ve a tu perfil.</span>
                  )}
                </p>
              </li>
              <li className={card}>
                <p className="font-display text-on-surface mb-1 flex items-center gap-2">
                  2. Guarda los correos de resultado <Mail className="w-4 h-4 text-theme-main" />
                </p>
                <p className="text-sm text-on-surface-muted">
                  Al cerrarse cada votación, toda la comunidad recibe un correo con el resultado,
                  una huella final (una larga serie de letras y números) y, si cambia una norma, su
                  texto. No hace falta que entiendas la huella: basta con que no borres el correo.
                  Es tu propia copia de lo que se decidió.
                </p>
              </li>
              <li className={card}>
                <p className="font-display text-on-surface mb-1">3. Apunta tu sello al votar</p>
                <p className="text-sm text-on-surface-muted">
                  Al votar recibes un sello de cuatro palabras. Con él puedes comprobar, en la
                  página de la votación, que tu voto consta y se ha contado. Es tu forma de revisar
                  tu propio voto; el vigilante revisa todos los demás.
                </p>
              </li>
              <li className={card}>
                <p className="font-display text-on-surface mb-1 flex items-center gap-2">
                  4. Echa un vistazo a la comprobación <Search className="w-4 h-4 text-theme-main" />
                </p>
                <p className="text-sm text-on-surface-muted">
                  En la página de cada votación cerrada, el botón «Comprobar ahora» hace la misma
                  comprobación que el vigilante, cuando tú quieras. Quien sepa algo de informática
                  puede incluso descargar el registro y comprobarlo por su cuenta, fuera de la
                  web.
                </p>
              </li>
            </ol>
          </section>

          {/* Si llega un aviso */}
          <section>
            <h3 className={sectionTitle}>
              <TriangleAlert className="w-5 h-5" /> Si te llega un aviso
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-on-surface/90 text-sm md:text-base">
              <li>
                <strong>Con calma.</strong> Un aviso significa que algo no cuadra y conviene
                revisarlo; por ejemplo, un fallo técnico. No quiere decir que haya pasado nada
                grave.
              </li>
              <li>
                <strong>Guarda el correo</strong>, igual que los de resultado.
              </li>
              <li>
                <strong>Compáralo con lo que tengas.</strong> Si el aviso habla de una votación,
                busca su correo de resultado: lo que dice ese correo es lo que se decidió.
              </li>
              <li>
                <strong>Coméntalo con la comunidad</strong>, en La Plaza o en los canales
                habituales, para que se revise entre todos.
              </li>
              <li>
                Mientras el problema no se resuelva, una votación que no supere la comprobación
                no cambia el Códice.
              </li>
            </ul>
          </section>

          {/* Preguntas */}
          <section>
            <h3 className={sectionTitle}>Preguntas frecuentes</h3>
            <div className="space-y-4">
              <div>
                <p className="font-display text-on-surface">¿Por qué no viene activado?</p>
                <p className="text-sm text-on-surface-muted">
                  Para no mandar correos a nadie sin su permiso. Es una decisión de cada cual.
                  Solo quienes administran la web los reciben siempre, para que nunca se queden
                  sin destinatario.
                </p>
              </div>
              <div>
                <p className="font-display text-on-surface">¿Me llenará el correo?</p>
                <p className="text-sm text-on-surface-muted">
                  No. Solo escribe cuando encuentra un problema, y no repite el aviso cada hora
                  mientras ese problema siga sin resolverse.
                </p>
              </div>
              <div>
                <p className="font-display text-on-surface">
                  Si no activo los avisos, ¿me entero de los resultados?
                </p>
                <p className="text-sm text-on-surface-muted">
                  Sí. Los correos de resultado llegan a toda la comunidad, tengas los avisos del
                  vigilante activados o no.
                </p>
              </div>
              <div>
                <p className="font-display text-on-surface">¿Puedo desactivarlos después?</p>
                <p className="text-sm text-on-surface-muted">
                  Cuando quieras, desde tu perfil, con el mismo interruptor.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-outline-ghost pt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/plaza" className="text-theme-main hover:underline">
              Volver a La Plaza
            </Link>
            <a
              href="/propuesta-votaciones-plaza.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-on-surface-muted hover:text-theme-main"
            >
              Cómo funciona el voto seguro
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlazaVigilante;
