import React, { useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import Button from '../components/Button';
import Cita from '../components/Cita';
import { allBotcCharacters } from '../data/botcRoles';
import {
  Search,
  BookOpen,
  Shield,
  Skull,
  Ghost,
  Sparkles,
  ExternalLink,
  Crown,
  ScrollText,
  UserCheck,
  Zap,
  HelpCircle
} from 'lucide-react';

const Grimorio: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEdition, setSelectedEdition] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'characters' | 'editions' | 'rules' | 'guides'>('characters');

  const filteredCharacters = useMemo(() => {
    return allBotcCharacters.filter(char => {
      const matchesSearch =
        char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        char.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        char.ability.toLowerCase().includes(searchTerm.toLowerCase()) ||
        char.summary.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEdition = selectedEdition === 'all' || char.edition === selectedEdition;
      const matchesTeam = selectedTeam === 'all' || char.team === selectedTeam;

      return matchesSearch && matchesEdition && matchesTeam;
    });
  }, [searchTerm, selectedEdition, selectedTeam]);

  const getTeamBadge = (team: string) => {
    switch (team) {
      case 'townsfolk':
        return { label: 'Aldeano', bg: 'bg-blue-900/60 border-blue-500/40 text-blue-300', icon: Shield };
      case 'outsider':
        return { label: 'Forastero', bg: 'bg-cyan-900/60 border-cyan-500/40 text-cyan-300', icon: Ghost };
      case 'minion':
        return { label: 'Esbirro', bg: 'bg-rose-950/70 border-rose-600/50 text-rose-300', icon: Skull };
      case 'demon':
        return { label: 'Demonio', bg: 'bg-red-950 border-red-500 text-red-400 font-bold animate-pulse', icon: Crown };
      case 'traveller':
        return { label: 'Viajero', bg: 'bg-purple-900/60 border-purple-500/40 text-purple-300', icon: Zap };
      default:
        return { label: 'Legendario', bg: 'bg-amber-900/60 border-amber-500/40 text-amber-300', icon: Sparkles };
    }
  };

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="El Grimorio Wiki"
        imageSrc="/wiki_banner.jpg"
        imageAlt="Grimorio Wiki BotC"
      />

      <div className="max-w-7xl w-full mx-auto px-0 md:px-8 py-4 md:py-10 relative z-20 -mt-20">
        <div className="bg-transparent md:bg-surface border-0 md:border border-transparent md:border-outline-ghost rounded-none md:rounded shadow-none md:shadow-2xl px-4 py-6 md:p-10 relative space-y-8">
          
          <Cita texto="Bienvenido al compendio del conocimiento prohibido. Aquí hallarás la lista completa de roles, habilidades y leyes de Blood on the Clocktower." />

          {/* Banner de Enlace a la Wiki Oficial */}
          <div className="bg-gradient-to-r from-theme-container via-surface-low to-theme-container border border-theme-main/40 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-theme-main/20 border border-theme-main/60 flex items-center justify-center shrink-0">
                <BookOpen className="w-7 h-7 text-theme-main" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-display text-theme-main">Wiki Oficial de Blood on the Clocktower</h2>
                <p className="text-on-surface-muted text-sm font-body">
                  Accede al recurso global oficial con todas las aclaraciones avanzadas, scripts comunitarios y fichas técnicas.
                </p>
              </div>
            </div>
            <a
              href="https://wiki.bloodontheclocktower.com/Main_Page"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-theme-main hover:bg-theme-main/80 text-background font-display font-semibold px-6 py-3 rounded shadow-lg transition-all shrink-0 cursor-pointer"
            >
              Visitar Wiki Oficial <ExternalLink size={18} />
            </a>
          </div>

          {/* Pestañas de Navegación Principal */}
          <div className="bg-surface-low/90 p-2 rounded-2xl border border-outline-ghost/80 shadow-inner flex flex-wrap gap-2">
            {[
              { id: 'characters', label: 'Compendio de Personajes', badge: allBotcCharacters.length, icon: UserCheck },
              { id: 'editions', label: 'Ediciones Oficiales', icon: Crown },
              { id: 'rules', label: 'Reglamento y Setup', icon: ScrollText },
              { id: 'guides', label: 'Consejos de Narrador', icon: HelpCircle },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'characters' | 'editions' | 'rules' | 'guides')}
                  className={`px-5 py-3 rounded-xl font-display text-sm md:text-base transition-all duration-200 cursor-pointer flex items-center gap-2.5 ${
                    isActive
                      ? 'bg-theme-main text-background font-bold shadow-lg shadow-theme-main/30 ring-1 ring-theme-main/50'
                      : 'text-on-surface-muted hover:text-on-surface hover:bg-surface-container/70'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-background' : 'text-theme-main/80'} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-sans ${
                      isActive
                        ? 'bg-background/25 text-background font-bold'
                        : 'bg-surface-container text-on-surface-muted border border-outline-ghost'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: PERSONAJES CON BUSCADOR Y FILTROS */}
          {activeTab === 'characters' && (
            <div className="space-y-6">
              {/* Barra de Búsqueda y Filtros */}
              <div className="bg-surface-low border border-outline-ghost p-4 md:p-6 rounded-xl space-y-4 shadow-md">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-muted w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar entre los personajes por nombre (ej: Lavandera, Imp, Poisoner, Monje...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-background border border-outline-ghost rounded-lg pl-12 pr-4 py-3 text-on-surface placeholder:text-on-surface-muted focus:outline-none focus:border-theme-main transition-colors font-body"
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pt-2">
                  {/* Filtro de Edición */}
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-on-surface-muted font-display">Edición:</span>
                    {[
                      { id: 'all', label: 'Todas' },
                      { id: 'trouble-brewing', label: 'Trouble Brewing' },
                      { id: 'bad-moon-rising', label: 'Bad Moon Rising' },
                      { id: 'sects-and-violets', label: 'Sects & Violets' },
                      { id: 'traveller', label: 'Viajeros' },
                      { id: 'fabled', label: 'Legendarios' },
                      { id: 'experimental', label: 'Experimental' }
                    ].map(ed => (
                      <button
                        key={ed.id}
                        onClick={() => setSelectedEdition(ed.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-display transition-all cursor-pointer ${
                          selectedEdition === ed.id
                            ? 'bg-theme-main text-background font-semibold shadow'
                            : 'bg-background hover:bg-surface border border-outline-ghost text-on-surface-muted'
                        }`}
                      >
                        {ed.label}
                      </button>
                    ))}
                  </div>

                  {/* Filtro de Bando */}
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-on-surface-muted font-display">Bando:</span>
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'townsfolk', label: 'Aldeanos' },
                      { id: 'outsider', label: 'Forasteros' },
                      { id: 'minion', label: 'Esbirros' },
                      { id: 'demon', label: 'Demonios' },
                      { id: 'traveller', label: 'Viajeros' },
                      { id: 'fabled', label: 'Legendarios' }
                    ].map(team => (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeam(team.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-display transition-all cursor-pointer ${
                          selectedTeam === team.id
                            ? 'bg-theme-main text-background font-semibold shadow'
                            : 'bg-background hover:bg-surface border border-outline-ghost text-on-surface-muted'
                        }`}
                      >
                        {team.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-on-surface-muted font-display pt-1">
                  Mostrando {filteredCharacters.length} de {allBotcCharacters.length} personajes.
                </div>
              </div>

              {/* Grid de Tarjetas de Personajes */}
              {filteredCharacters.length === 0 ? (
                <div className="text-center py-12 bg-surface-low border border-outline-ghost rounded-xl">
                  <Ghost className="w-12 h-12 text-on-surface-muted mx-auto mb-3 opacity-60" />
                  <p className="text-lg font-display text-on-surface">No se encontraron personajes con los filtros seleccionados.</p>
                  <p className="text-sm text-on-surface-muted font-body mt-1">Prueba a borrar el término de búsqueda o seleccionar "Todas".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCharacters.map(char => {
                    const badge = getTeamBadge(char.team);
                    const BadgeIcon = badge.icon;
                    return (
                      <div
                        key={char.id}
                        className="bg-surface-low border border-outline-ghost hover:border-theme-main/60 rounded-xl p-5 shadow-md hover:shadow-xl transition-all flex flex-col justify-between group space-y-4"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="text-xl font-display text-theme-main group-hover:text-on-surface-bright transition-colors">
                                {char.name}
                              </h3>
                              <span className="text-xs font-body text-on-surface-muted italic">
                                ({char.originalName})
                              </span>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-display ${badge.bg}`}>
                              <BadgeIcon size={12} /> {badge.label}
                            </span>
                          </div>

                          <div className="mt-3 p-3 bg-background/60 rounded-lg border border-outline-ghost/40">
                            <p className="text-sm font-body text-on-surface leading-relaxed italic">
                              "{char.ability}"
                            </p>
                          </div>

                          <p className="text-xs text-on-surface-muted font-body mt-3 leading-normal">
                            {char.summary}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-outline-ghost/40 flex items-center justify-between text-xs text-on-surface-muted font-display">
                          <span className="capitalize">{char.edition.replace(/-/g, ' ')}</span>
                          <a
                            href={`https://wiki.bloodontheclocktower.com/${encodeURIComponent(char.originalName)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-theme-main hover:underline flex items-center gap-1 group-hover:text-theme-main/90"
                          >
                            Ver en Wiki <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EDICIONES */}
          {activeTab === 'editions' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-low border border-outline-ghost p-6 rounded-xl space-y-4 hover:border-theme-main/50 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-44 rounded-lg bg-theme-container flex items-center justify-center p-4 border border-outline-ghost">
                    <img src="/Logo_trouble_brewing.png" alt="Trouble Brewing" className="max-h-full object-contain drop-shadow" />
                  </div>
                  <h3 className="text-2xl font-display text-theme-main">Trouble Brewing</h3>
                  <p className="text-sm text-on-surface font-body leading-relaxed">
                    La edición fundamental e ideal para empezar. Enfocada en la lógica pura, la obtención directa de pistas y la interacción entre roles buenos confirmables contra la astucia del Imp y sus esbirros.
                  </p>
                </div>
                <Button
                  onClick={() => { setSelectedEdition('trouble-brewing'); setActiveTab('characters'); }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Explorar Roles de TB
                </Button>
              </div>

              <div className="bg-surface-low border border-outline-ghost p-6 rounded-xl space-y-4 hover:border-theme-main/50 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-44 rounded-lg bg-theme-container flex items-center justify-center p-4 border border-outline-ghost">
                    <img src="/Logo_bad_moon_rising.png" alt="Bad Moon Rising" className="max-h-full object-contain drop-shadow" />
                  </div>
                  <h3 className="text-2xl font-display text-theme-main">Bad Moon Rising</h3>
                  <p className="text-sm text-on-surface font-body leading-relaxed">
                    Edición violenta y llena de muertes múltiples por la noche. La supervivencia, las protecciones y deducir la causa exacta de cada muerte son las claves para cazar al demonio.
                  </p>
                </div>
                <Button
                  onClick={() => { setSelectedEdition('bad-moon-rising'); setActiveTab('characters'); }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Explorar Roles de BMR
                </Button>
              </div>

              <div className="bg-surface-low border border-outline-ghost p-6 rounded-xl space-y-4 hover:border-theme-main/50 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-44 rounded-lg bg-theme-container flex items-center justify-center p-4 border border-outline-ghost">
                    <img src="/Logo_sects_and_violets.png" alt="Sects & Violets" className="max-h-full object-contain drop-shadow" />
                  </div>
                  <h3 className="text-2xl font-display text-theme-main">Sects & Violets</h3>
                  <p className="text-sm text-on-surface font-body leading-relaxed">
                    Edición caótica centrada en la locura, las alteraciones de información y cambios constantes de roles. La mente del pueblo se pone a prueba contra el engaño supremo.
                  </p>
                </div>
                <Button
                  onClick={() => { setSelectedEdition('sects-and-violets'); setActiveTab('characters'); }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Explorar Roles de S&V
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: REGLAMENTO Y SETUP */}
          {activeTab === 'rules' && (
            <div className="bg-surface-low border border-outline-ghost p-6 md:p-8 rounded-xl space-y-6">
              <h2 className="text-2xl font-display text-theme-main border-b border-outline-ghost pb-3 flex items-center gap-2">
                <ScrollText className="w-6 h-6 text-theme-main" /> Reglas Básicas de Juego
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-body text-on-surface text-base">
                <div className="space-y-3 bg-background/50 p-5 rounded-lg border border-outline-ghost/60">
                  <h3 className="text-lg font-display text-theme-main">1. Ciclo Día y Noche</h3>
                  <p>
                    Durante la <strong>Noche</strong>, el pueblo duerme con los ojos cerrados. El Narrador despierta a los roles uno por uno en secreto para que usen sus habilidades o reciban señales. Durante el <strong>Día</strong>, todos debaten abiertamente, forman alianzas y hacen nominaciones para ejecutar a un sospechoso.
                  </p>
                </div>

                <div className="space-y-3 bg-background/50 p-5 rounded-lg border border-outline-ghost/60">
                  <h3 className="text-lg font-display text-theme-main">2. Los Muertos Siguen Jugando</h3>
                  <p>
                    A diferencia de otros juegos de deducción social, en Blood on the Clocktower <strong>los jugadores asesinados no quedan fuera</strong>. Siguen participando activamente en los debates y conservan <strong>un voto fantasma único</strong> para la votación final o estratégica.
                  </p>
                </div>

                <div className="space-y-3 bg-background/50 p-5 rounded-lg border border-outline-ghost/60">
                  <h3 className="text-lg font-display text-theme-main">3. Nominaciones y Ejecución</h3>
                  <p>
                    Cada jugador vivo puede nominar a otro jugador una vez al día. Para que la acusación prospere debe alcanzar al menos la mitad de los votos de jugadores vivos. Solo se ejecuta al sospechoso con mayor número de votos al final del día.
                  </p>
                </div>

                <div className="space-y-3 bg-background/50 p-5 rounded-lg border border-outline-ghost/60">
                  <h3 className="text-lg font-display text-theme-main">4. Condición de Victoria</h3>
                  <p>
                    <strong>El Bando Bueno gana</strong> si el Demonio es ejecutado en la plaza pública. <strong>El Bando Malvado gana</strong> si solo quedan 2 jugadores vivos (el Demonio y otro participante) o si se cumple una condición especial de victoria malvada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONSEJOS DE NARRADOR */}
          {activeTab === 'guides' && (
            <div className="bg-surface-low border border-outline-ghost p-6 md:p-8 rounded-xl space-y-6">
              <h2 className="text-2xl font-display text-theme-main border-b border-outline-ghost pb-3 flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-theme-main" /> Consejos para el Narrador (Storyteller)
              </h2>

              <div className="space-y-4 font-body text-on-surface text-base leading-relaxed">
                <p>
                  El Narrador no es un árbitro pasivo: es el director de la experiencia. Su meta no es ganar ni favorecer a un bando, sino crear una partida emocionante, equilibrada e inolvidable para todos los participantes.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="bg-background/50 p-5 rounded-lg border border-outline-ghost/60 space-y-2">
                    <h3 className="font-display text-lg text-theme-main">Mantén el Ritmo</h3>
                    <p className="text-sm text-on-surface-muted">
                      Procura que la fase de noche sea fluida y que el debate durante el día tenga un tiempo límite razonable para mantener la tensión.
                    </p>
                  </div>

                  <div className="bg-background/50 p-5 rounded-lg border border-outline-ghost/60 space-y-2">
                    <h3 className="font-display text-lg text-theme-main">Administra la Borrachera</h3>
                    <p className="text-sm text-on-surface-muted">
                      Si hay un Borracho o Envenenador en juego, da información falsa creíble pero que encaje con la partida para mantener el misterio.
                    </p>
                  </div>

                  <div className="bg-background/50 p-5 rounded-lg border border-outline-ghost/60 space-y-2">
                    <h3 className="font-display text-lg text-theme-main">Fomenta la Inclusión</h3>
                    <p className="text-sm text-on-surface-muted">
                      Asegúrate de que los jugadores nuevos o más tímidos tengan oportunidad de hablar y usar sus votos fantasmas con libertad.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Grimorio;
