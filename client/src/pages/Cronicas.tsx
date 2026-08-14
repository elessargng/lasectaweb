import { Link } from 'react-router-dom';
import Cita from '../components/Cita';
import PageHeader from '../components/PageHeader';
import { Compass, History } from 'lucide-react';

const Cronicas = () => {
  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Las Crónicas"
        imageSrc="/calendar_banner_wide.jpg"
        imageAlt="Calendario"
      />
      <div className="max-w-5xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 md:pt-8 relative">
          
          {/* Primer bloque: Cita e información general */}
          <div className="bg-surface-low p-4 md:p-8 border border-outline-ghost shadow-inner mb-8 relative z-20 space-y-6">
            <Cita texto="El fuego de la plaza consume mi última coartada. Escucho susurros en las esquinas; no son los vivos quienes me preocupan, sino los ojos fríos de mis víctimas de cada noche. Aunque sus cuerpos yazcan sin vida,* sus espíritus siguen votando... y hoy me señalan a mí*." />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
              <div>
                <h3 className="text-xl font-display text-theme-main mb-3">¿Qué es Blood in the Clocktower?</h3>
                <p className="text-on-surface text-base font-body leading-relaxed">
                  Es un juego de deducción social para entre 5 y 20 jugadores en el que el bien y el mal libran una batalla de ingenio. Un Narrador guía la historia, mientras que cada participante recibe un rol único con habilidades especiales. Lo que lo hace especial es que los jugadores asesinados siguen participando activamente, teniendo un voto fantasmal para influir en el destino del pueblo.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-display text-theme-main mb-3">¿Cómo jugamos?</h3>
                <p className="text-on-surface text-base font-body leading-relaxed">
                  En La Secta nos reunimos habitualmente de manera online para desatar el caos. Utilizamos la plataforma <a href="https://www.botc.app" target="_blank" rel="noopener noreferrer" className="text-theme-main hover:underline">botc.app</a> para visualizar el grimorio en tiempo real y gestionar las interacciones del pueblo, mientras que toda la diplomacia, las acusaciones y los susurros ocurren a través de nuestros canales de voz dedicados en Telegram. La narración inmersiva, las alianzas secretas y las puñaladas por la espalda están garantizadas en cada sesión.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-display text-theme-main mb-3">¿Quiénes somos?</h3>
                <p className="text-on-surface text-base font-body leading-relaxed">
                  Somos una comunidad de aficionados a Blood on the Clocktower, abierta e inclusiva, cuyo objetivo es compartir nuestra pasión y generar espacios y oportunidades para jugar, conversar, conocernos e interactuar entre nosotros, creando una comunidad activa donde cada partida sea también una ocasión para conectar con otras personas.
                </p>
              </div>
            </div>
          </div>

          {/* Segundo bloque: Historia de La Secta */}
          <div className="bg-surface-low p-4 md:p-8 border border-outline-ghost shadow-inner mb-8 relative z-20 space-y-8">
            <div className="border-b border-outline-ghost/60 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <History className="w-6 h-6 text-theme-main" />
                <h2 className="text-2xl md:text-3xl font-display text-theme-main">Historia de La Secta</h2>
              </div>
              <p className="text-on-surface-muted italic font-display text-lg">
                Quiénes somos, de dónde venimos, a dónde vamos.
              </p>
            </div>

            {/* Obra de Gauguin */}
            <div className="my-6 space-y-2">
              <div className="overflow-hidden rounded border border-outline-ghost shadow-lg bg-surface">
                <img
                  src="/historia/imagen_1.jpg"
                  alt="Paul Gauguin - ¿De dónde venimos? ¿Quiénes somos? ¿Adónde vamos? (1897)"
                  className="w-full max-h-[380px] object-cover hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
              <p className="text-xs text-center text-on-surface-muted italic font-body">
                Paul Gauguin - ¿De dónde venimos? ¿Quiénes somos? ¿Adónde vamos? (1897)
              </p>
            </div>

            {/* Texto de Origen */}
            <div className="space-y-4 text-on-surface font-body leading-relaxed text-base">
              <p className="italic text-on-surface-muted border-l-2 border-theme-main/60 pl-4 py-1">
                Dicen los que saben algo de esto que las personas y comunidades se definen por aquello que hacen y que “el mejor predictor de la conducta futura es la conducta pasada”. Por eso quizá la mejor manera de explicar quiénes somos y a dónde vamos es explicar de dónde venimos y cómo nos hemos construido como colectivo.
              </p>
              <p>
                Esta comunidad nace en verano de 2023, alrededor de uno de los pioneros en esto de juntar gente para jugar a Blood on the Clocktower: <strong className="text-theme-main font-semibold">Javier Rodríguez - “Mishigeek”</strong> y de su canal de Discord en el que había comenzado a organizar partidas unos meses antes, alrededor de junio. Durante esos meses de verano se congregan distintos aficionados e interesados al juego de distintos puntos de España y Latinoamérica, como <span className="text-on-surface-bright font-medium">Andreu “Nafsica”</span>, <span className="text-on-surface-bright font-medium">Marina</span> y <span className="text-on-surface-bright font-medium">Carlos</span>, entorno a este canal, jugando las primeras partidas comunitarias.
              </p>
              <p>
                Otra parte significativa procede de haber probado el juego en las jornadas <strong className="text-on-surface-bright">Tierra de Nadie</strong> en agosto de 2022, en el <strong className="text-on-surface-bright">Campamento Barton</strong> de mayo de 2023 gracias a las copias de Kalino y Roberto y muy especialmente de las <strong className="text-on-surface-bright">CLBSK 2023</strong> (convivencias lúdicas de la BSK, uno de los foros de juegos de mesa precursores en castellano), donde comenzó la “fiebre” con el juego, ya que desde que llegó Guillermo Ribeiro con su copia ese viernes de julio no se paró de jugar, ininterrumpidamente, hasta que finalizaron las jornadas el domingo por la tarde: <span className="text-on-surface-bright font-medium">Alicia, Amarillo, Bea, Adrian o Calvo</span> fueron algunos de los que no pararon de jugar ese fin de semana.
              </p>
            </div>

            {/* Dinámicas y Logotipo */}
            <div className="space-y-4 text-on-surface font-body leading-relaxed text-base pt-2">
              <h3 className="text-xl font-display text-theme-main">Sesgos, Moscas y la Identidad del Culto</h3>
              <p>
                En esas primeras partidas, tanto presenciales como telemáticas, comenzamos a experimentar las dinámicas características del juego: esa persistencia en acusar a alguien y de interpretar cualquier señal, por débil que sea, como evidencia de nuestra certeza (<em className="text-theme-main/90">el sesgo de confirmación</em>), el sobreestimar las posibilidades de una opción, por ejemplo que quien dice ser santo sea el demonio con esa coartada, porque recientemente o con alguna frecuencia eso ha sucedido así (<em className="text-theme-main/90">sesgo de disponibilidad</em>) o cómo olvidamos tan fácilmente hipótesis e información que teníamos como válida ante una nueva información que aparece (derivado de la gran carga cognitiva que supone el juego y la reorientación atencional) y empezamos a generar una jerga propia para algunos de estos efectos, por ejemplo, para esto último referirnos a que <strong className="text-on-surface-bright">“nos hemos distraído con una mosca”</strong> y hemos olvidado las hipótesis que teníamos o que alguien está <strong className="text-on-surface-bright">“soltando moscas”</strong> para distraer nuestra atención.
              </p>
              <p>
                Por este motivo el primer logotipo, diseñado por Bea, incluía la cabeza de una mosca dentro del triángulo del icono del “Líder de culto”: la mosca representaba una de las dinámicas del juego junto con la jerga identitaria de la comunidad y el triángulo el nombre de grupo, “la secta”, a través del personaje más representativo, y utilizando el color azul del alineamiento “bueno” del juego original. Más tarde, en verano de 2026 y con la actualización de la comunidad a través de distintos grupos de trabajo, se actualizó el logotipo para mantener la tradición y la esencia conservando el triángulo del sectario y renovando la imagen principal focalizando en el sectario junto con un cambio de color al morado “corporativo” del rediseño de la web.
              </p>
              <p>
                Hasta ese verano de 2023 y en paralelo se comienzan a organizar las primeras sesiones presenciales en clubes o locales particulares y el juego comienza a tener cierta repercusión en la “ludosfera”.
              </p>
              <p>
                En ese verano se crean los canales propios de Discord y Telegram, para comenzar a organizar la comunidad de manera independiente y se incorpora por esas fechas uno de los pioneros en la divulgación del juego en Latinoamérica, <strong className="text-theme-main font-semibold">“Sapaki”</strong>.
              </p>
            </div>

            {/* Captura partida 2023 */}
            <div className="my-6 space-y-2">
              <div className="overflow-hidden rounded border border-outline-ghost shadow-lg bg-surface flex justify-center">
                <img
                  src="/historia/imagen_2.jpg"
                  alt="Partida convocada en verano de 2023"
                  className="w-full max-h-[450px] object-contain hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
              <p className="text-xs text-center text-on-surface-muted italic font-body">
                Aquí podemos ver una de las partidas convocadas en verano de 2023, y Gabriel “Goodwizard” entre los jugadores.
              </p>
            </div>

            {/* Organización y divulgación */}
            <div className="space-y-4 text-on-surface font-body leading-relaxed text-base">
              <p>
                Progresivamente vamos organizándonos como comunidad con un objetivo común que es el que define a la comunidad: generar un espacio común y plural en el que poder disfrutar de esta afición tanto compartiendo partidas de forma telemática como con jornadas o partidas presenciales. Y uno de los pasos significativos es la creación de una cuenta común para este grupo, bautizado como <strong className="text-theme-main font-semibold">“La secta”</strong> y que buscaba ser el espacio compartido para los aficionados a BotC en castellano, el 26 de septiembre de 2023, apenas unos días después de otra de las jornadas en las que no se paró de jugar en todas las convivencias: <strong className="text-on-surface-bright">Asturlúdicas</strong>.
              </p>
              <p>
                Creamos en octubre de 2023 un canal de YouTube para la divulgación del juego y de la propia comunidad, <a href="https://www.youtube.com/@Lasecta_botc" target="_blank" rel="noopener noreferrer" className="text-theme-main hover:underline font-medium">youtube.com/@Lasecta_botc</a>, con distintos recursos como tutoriales para aprender a jugar o narrar, además de partidas.
              </p>
              <p>
                También con el objetivo de hacer llegar el juego y la comunidad a más personas se han llevado adelante proyectos como la <strong className="text-on-surface-bright">“Escuela de verano”</strong> o el taller de narración <strong className="text-on-surface-bright">“El veranuco de la secta”</strong> coordinado por <span className="text-on-surface-bright font-medium">Alicia – “Harishka”</span> para enseñar tanto a jugar como a narrar.
              </p>
            </div>

            {/* Sectarias y Eventos */}
            <div className="space-y-4 text-on-surface font-body leading-relaxed text-base pt-2">
              <h3 className="text-xl font-display text-theme-main">Espacios Propios: Sectarias y Convivencias</h3>
              <p>
                Uno de los objetivos era generar espacios propios en los que jugar y eso se inauguró con las primeras convivencias, <strong className="text-theme-main font-semibold">“Sectarias I”</strong> en enero de 2024, en Chinchón, unas convivencias para unas 30 personas centradas en Clocktower.
              </p>
            </div>

            {/* Foto acreditación Sectarias */}
            <div className="my-6 space-y-2">
              <div className="overflow-hidden rounded border border-outline-ghost shadow-lg bg-surface flex justify-center">
                <img
                  src="/historia/imagen_3.jpg"
                  alt="Acreditación Sectarias Enero 2024 - Calvo Expósito"
                  className="w-full max-w-md max-h-[400px] object-cover rounded hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
              <p className="text-xs text-center text-on-surface-muted italic font-body">
                Otras 72 horas de juego casi ininterrumpido.
              </p>
            </div>

            <div className="space-y-4 text-on-surface font-body leading-relaxed text-base">
              <p>
                Continuamos asistiendo a jornadas y convivencias (De Empatadas, Campamento Barton, Asturlúdicas y muchas más) y en todo este tiempo y hasta hoy ha ido creciendo esta familia que ha servido de excusa para poner en contacto a muchísima gente.
              </p>
              <p>
                En la fecha en la que se redacta este resumen contamos con distintos grupos de trabajo orientados a cuidar a la comunidad, organizar y coordinar eventos y jornadas, promocionar la comunidad o dar continuidad a la divulgación y canal de vídeo.
              </p>
              <p className="italic text-on-surface-muted">
                Esto podría explicar de dónde venimos, qué somos y hacia dónde nos dirigimos.
              </p>
            </div>

            {/* Cierre / Séneca */}
            <div className="mt-8 pt-6 border-t border-outline-ghost/50 bg-surface/60 p-6 rounded border border-outline-ghost shadow-sm space-y-3 text-center">
              <Compass className="w-6 h-6 text-theme-main mx-auto mb-1" />
              <p className="text-base md:text-lg font-display text-on-surface italic max-w-2xl mx-auto leading-relaxed">
                «Decía Séneca que <span className="text-theme-main">“ningún viento es favorable para el que no sabe a qué puerto se dirige”</span>. Nosotros sí conocemos el rumbo: venimos del entusiasmo de unos pocos, somos la pasión de muchos y vamos, simplemente, hacia la próxima partida.»
              </p>
              <p className="text-sm font-body text-theme-main/90 font-medium pt-2">
                Porque al final, las grandes preguntas de Gauguin siempre se responden mejor frente a unas Crónicas abiertas.
              </p>
            </div>
          </div>

          <Link to="/escrituras" className="inline-block text-theme-main hover:text-on-surface transition-colors font-display text-[15px] underline relative z-20">
            El Códice &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Cronicas;
