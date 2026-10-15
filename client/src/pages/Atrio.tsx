import React from 'react';
import { Link } from 'react-router-dom';

import CalendarWidgets from '../components/CalendarWidget'

import {
  MessageSquare,
  Calendar,
  BookOpen,
  BookMarked,
  MapPin,
  ArrowRight,
  Satellite,
} from 'lucide-react';
import Cita from '../components/Cita';
import StatsWidget from '../components/StatsWidget';
import PageHeader from '../components/PageHeader';

// Título de cada bloque del Atrio: rótulo en versalitas con su icono y un filo dorado a la derecha.
const tituloBloque = 'flex items-center gap-3 font-ui text-sm md:text-base font-semibold tracking-[0.22em] text-theme-main';

const Atrio: React.FC = () => {
  /*
  const recentThreads = [
    { title: 'Script de Fang Gu', author: 'A2', date: 'Ayer', id: 1 },
    { title: 'Como jugar Acróbata de forma (no) óptima', author: 'A3', date: '3 días', id: 2 },
    { title: 'Bienvenida a los nuevos iniciados', author: 'A1', date: 'Hace 2 meses', id: 3 },
  ];
  */

  const quickActions = [
    { label: 'Ir a la Plaza', icon: MessageSquare, path: '/plaza', desc: 'Participa en las discusiones' },
    { label: 'Explorar Crónicas', icon: BookOpen, path: '/cronicas', desc: 'Conoce la historia del culto' },
    { label: 'Grimorio Wiki', icon: BookMarked, path: '/grimorio', desc: 'Enciclopedia de BotC' },
    { label: 'Ver Rituales', icon: Calendar, path: '/rituales', desc: 'No te pierdas los eventos' },
  ];

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Atrio Principal"
        imageSrc="/profile_banner_wide.jpg"
        maxWidthClass="max-w-7xl"
      />

      <div className="max-w-7xl w-full mx-auto px-4 md:px-8 relative z-20 -mt-12 md:-mt-16">
        <div className="max-w-3xl mx-auto">
          <Cita texto="Ven, siéntate al borde del abismo. Contaremos historias sobre los condenados, *y uno de nosotros no mentirá al hacerlo*." />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="flex flex-col gap-8 min-w-0">
            {/* Calendario */}
            <section aria-labelledby="atrio-rituales" className="panel-premium rounded-sm p-5 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h3 id="atrio-rituales" className={tituloBloque}>
                  <Calendar size={18} /> Próximos Rituales
                </h3>
                <Link to="/rituales" className="group inline-flex items-center gap-1.5 font-ui text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-muted hover:text-gold-bright transition-colors">
                  Ver rituales <ArrowRight size={14} className="text-theme-main transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </div>
              <CalendarWidgets />
            </section>

              {/* Enlace a hilos de la plaza -- No funcional */}
              {/*
                <div className="bg-surface-low border border-outline-ghost p-4 rounded shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-display text-theme-main flex items-center gap-2">
                      <MessageSquare size={18} /> Últimas deliberaciones
                    </h4>
                    <Link to="/plaza" className="text-theme-main hover:text-theme-main/80 text-sm flex items-center gap-1">
                      Ver todos <ArrowRight size={14} />
                    </Link>
                  </div>
                  <div className="divide-y divide-outline-ghost">
                    
                    <div className="py-3 flex justify-between items-center">
                          <div>
                            <p className="text-on-surface font-medium">Sección en Construccion</p>
                          </div>
                    
                      {recentThreads.map((thread) => (
                        <li key={thread.id} className="py-3 flex justify-between items-center">
                          <div>
                            <p className="text-on-surface font-medium">{thread.title}</p>
                            <p className="text-sm text-on-surface-muted">
                              por {thread.author} • {thread.date}
                            </p>
                          </div>
                          <Link
                            to={`/plaza/${thread.id}`}
                            className="text-theme-main hover:text-theme-main/80 text-sm transition"
                          >
                            Leer
                          </Link>
                        </li>
                      ))}
                    
                    </div>
                  </div>
                </div>

              */}
            <section aria-labelledby="atrio-estadisticas" className="panel-premium rounded-sm p-5 md:p-8">
              <h3 id="atrio-estadisticas" className={`${tituloBloque} mb-8`}>
                <Satellite size={18} /> Estadísticas
              </h3>
              <StatsWidget />
            </section>
          </div>

          <section aria-labelledby="atrio-acceso" className="panel-premium rounded-sm p-5 md:p-6">
            <h3 id="atrio-acceso" className={`${tituloBloque} mb-5`}>
              <MapPin size={18} /> Acceso rápido
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {quickActions.map((action) => (
                <li key={action.path}>
                  <Link
                    to={action.path}
                    className="group flex items-center gap-4 p-3.5 rounded-sm bg-background/60 border border-outline-ghost hover:border-theme-main/60 hover:bg-[linear-gradient(90deg,rgba(212,175,106,0.08),transparent)] transition-colors"
                  >
                    <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center border border-theme-main/40 bg-[radial-gradient(circle_at_50%_35%,#1f2538,#0d0f17)] text-theme-main group-hover:border-theme-main group-hover:shadow-[0_0_14px_rgba(212,175,106,0.35)] transition-shadow">
                      <action.icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-ui text-sm font-semibold tracking-wide text-on-surface group-hover:text-gold-bright transition-colors">{action.label}</span>
                      <span className="block text-sm text-on-surface-muted">{action.desc}</span>
                    </span>
                    <ArrowRight size={16} className="ml-auto shrink-0 text-on-surface-muted group-hover:text-theme-main group-hover:translate-x-0.5 transition motion-reduce:transition-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Atrio;
