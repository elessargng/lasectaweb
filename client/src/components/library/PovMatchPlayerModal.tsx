import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  LibraryPovMatch,
  LibraryPov,
  CharacterType
} from '../../utils/libraryApi';
import { extractYoutubeVideoId } from '../../utils/libraryApi';
import {
  X,
  Play,
  Shuffle,
  Users,
  Eye,
  EyeOff,
  Skull,
  Shield,
  HelpCircle,
  Compass,
  Scroll,
  User,
  ArrowLeft,
  Tv,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Clock
} from 'lucide-react';

interface PovMatchPlayerModalProps {
  isOpen: boolean;
  match: LibraryPovMatch | null;
  onClose: () => void;
}

type SelectionStep =
  | { type: 'main' }
  | { type: 'category_menu'; category: CharacterType }
  | { type: 'category_pick_character'; category: CharacterType }
  | { type: 'category_pick_player'; category: CharacterType }
  | { type: 'general_pick_player' };

export const PovMatchPlayerModal: React.FC<PovMatchPlayerModalProps> = ({
  isOpen,
  match,
  onClose
}) => {
  // Estado de navegación en el selector anti-spoiler
  const [step, setStep] = useState<SelectionStep>({ type: 'main' });
  
  // POV activo en reproducción (null si aún está en el menú de selección)
  const [activePov, setActivePov] = useState<LibraryPov | null>(null);

  // Segundos actuales de reproducción para sincronizar al cambiar de POV
  const [startSeconds, setStartSeconds] = useState<number>(0);
  const [currentSecondsDisplay, setCurrentSecondsDisplay] = useState<number>(0);
  const currentSecondsRef = useRef<number>(0);
  const playerRef = useRef<any>(null);
  const playerContainerId = 'yt-pov-embedded-player';

  // Toggle para mostrar/ocultar información de rol en el reproductor (modo anti-spoiler)
  const [showRoleInfo, setShowRoleInfo] = useState<boolean>(false);

  // Toggle para barra lateral en pantallas móviles
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Cargar YouTube IFrame API
  useEffect(() => {
    if (!isOpen) return;

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'youtube-iframe-api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, [isOpen]);

  // Reiniciar estado al abrir modal o cambiar de partida
  useEffect(() => {
    if (isOpen) {
      setStep({ type: 'main' });
      setActivePov(null);
      setStartSeconds(0);
      setCurrentSecondsDisplay(0);
      currentSecondsRef.current = 0;
      setShowRoleInfo(false);
      setMobileSidebarOpen(false);
    } else {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    }
  }, [isOpen, match?.id]);

  // Leer los segundos actuales de forma segura desde el reproductor
  const getCurrentPlaybackSeconds = useCallback((): number => {
    if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
      try {
        const time = playerRef.current.getCurrentTime();
        if (typeof time === 'number' && !isNaN(time) && time >= 0) {
          const sec = Math.floor(time);
          currentSecondsRef.current = sec;
          return sec;
        }
      } catch {
        // ignore
      }
    }
    return currentSecondsRef.current || 0;
  }, []);

  // Intervalo para actualizar el contador de segundos mientras se reproduce
  useEffect(() => {
    if (!activePov) return;

    const interval = setInterval(() => {
      const sec = getCurrentPlaybackSeconds();
      setCurrentSecondsDisplay(sec);
    }, 1000);

    return () => clearInterval(interval);
  }, [activePov, getCurrentPlaybackSeconds]);

  // Inicializar o actualizar el reproductor de YouTube mediante IFrame API
  useEffect(() => {
    if (!activePov) return;

    const videoId = activePov.youtubeId || extractYoutubeVideoId(activePov.youtubeUrl);
    if (!videoId) return;

    const initPlayer = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        // Si el reproductor ya existe, cargar el nuevo vídeo en los segundos exactos
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          try {
            playerRef.current.loadVideoById({
              videoId,
              startSeconds: currentSecondsRef.current
            });
            return;
          } catch {
            // Si falla la llamada directa, destruir y recrear
            try {
              playerRef.current.destroy();
            } catch {
              // ignore
            }
            playerRef.current = null;
          }
        }

        // Crear nueva instancia de YT.Player
        try {
          playerRef.current = new (window as any).YT.Player(playerContainerId, {
            videoId,
            playerVars: {
              autoplay: 1,
              start: currentSecondsRef.current,
              rel: 0,
              modestbranding: 1,
              enablejsapi: 1
            },
            events: {
              onStateChange: (event: any) => {
                if (event && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                  const sec = Math.floor(playerRef.current.getCurrentTime() || 0);
                  currentSecondsRef.current = sec;
                  setCurrentSecondsDisplay(sec);
                }
              }
            }
          });
        } catch {
          // Fallback a iframe estándar
        }
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
      // Timeout de respaldo por si el evento ya se disparó
      const timer = setTimeout(initPlayer, 500);
      return () => clearTimeout(timer);
    }
  }, [activePov]);

  if (!isOpen || !match) return null;

  const povs = match.povs || [];

  // Agrupación de POVs por tipo
  const povsByType: Record<CharacterType, LibraryPov[]> = {
    narrador: povs.filter(p => p.characterType === 'narrador'),
    demonio: povs.filter(p => p.characterType === 'demonio'),
    esbirro: povs.filter(p => p.characterType === 'esbirro'),
    forastero: povs.filter(p => p.characterType === 'forastero'),
    aldeano: povs.filter(p => p.characterType === 'aldeano'),
    viajero: povs.filter(p => p.characterType === 'viajero')
  };

  // Función para iniciar o cambiar reproducción con un POV seleccionado manteniendo los segundos actuales
  const handleStartPlayback = (pov: LibraryPov) => {
    const isSwitching = activePov !== null;
    let targetSeconds = 0;

    if (isSwitching) {
      targetSeconds = getCurrentPlaybackSeconds();
    }

    currentSecondsRef.current = targetSeconds;
    setStartSeconds(targetSeconds);
    setCurrentSecondsDisplay(targetSeconds);
    setActivePov(pov);
    setStep({ type: 'main' });
    setMobileSidebarOpen(false);

    // Si el reproductor ya existe y tiene la API disponible, cargar en el segundo exacto
    const videoId = pov.youtubeId || extractYoutubeVideoId(pov.youtubeUrl);
    if (videoId && playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: targetSeconds
        });
      } catch {
        // ignore
      }
    }
  };

  // Función para elegir un POV al azar de una lista manteniendo los segundos
  const pickRandomPov = (list: LibraryPov[]) => {
    if (!list || list.length === 0) return;
    const randomIndex = Math.floor(Math.random() * list.length);
    handleStartPlayback(list[randomIndex]);
  };

  // Manejador del menú principal (8 opciones)
  const handleMainMenuOption = (optionKey: CharacterType | 'random_player' | 'concrete_player') => {
    if (optionKey === 'random_player') {
      // Opción 7: Jugador aleatorio de entre todos los jugadores
      pickRandomPov(povs);
      return;
    }

    if (optionKey === 'concrete_player') {
      // Opción 8: Jugador concreto (muestra nombres sin roles)
      setStep({ type: 'general_pick_player' });
      return;
    }

    const categoryList = povsByType[optionKey] || [];
    if (categoryList.length === 0) return;

    if (optionKey === 'narrador' || optionKey === 'demonio') {
      // Para Narrador y Demonio: no hay segunda opción, el vídeo comienza
      pickRandomPov(categoryList);
      return;
    }

    // Para Esbirro / Forastero / Aldeano / Viajero:
    // Si solo hay uno, comienza directamente. Si hay más de uno, muestra subopciones.
    if (categoryList.length === 1) {
      handleStartPlayback(categoryList[0]);
    } else {
      setStep({ type: 'category_menu', category: optionKey });
    }
  };

  // Formatear segundos a formato MM:SS o HH:MM:SS
  const formatTime = (seconds: number): string => {
    const totalSec = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Obtener URL embebida de YouTube con startSeconds y enablejsapi
  const getEmbedUrl = (pov: LibraryPov, sec: number = 0) => {
    const videoId = pov.youtubeId || extractYoutubeVideoId(pov.youtubeUrl);
    if (!videoId) return pov.youtubeUrl;
    const startParam = sec > 0 ? `&start=${sec}` : '';
    return `https://www.youtube.com/embed/${videoId}?autoplay=1${startParam}&enablejsapi=1&rel=0&modestbranding=1`;
  };

  // Obtener icono para categoría
  const getCategoryIcon = (category: CharacterType) => {
    switch (category) {
      case 'narrador':
        return <Scroll className="w-5 h-5 text-amber-400" />;
      case 'demonio':
        return <Skull className="w-5 h-5 text-red-500" />;
      case 'esbirro':
        return <Skull className="w-5 h-5 text-orange-400" />;
      case 'forastero':
        return <HelpCircle className="w-5 h-5 text-teal-400" />;
      case 'aldeano':
        return <Shield className="w-5 h-5 text-blue-400" />;
      case 'viajero':
        return <Compass className="w-5 h-5 text-purple-400" />;
      default:
        return <User className="w-5 h-5 text-theme-main" />;
    }
  };

  const getCategoryLabel = (category: CharacterType) => {
    switch (category) {
      case 'narrador': return 'el Narrador';
      case 'demonio': return 'el Demonio';
      case 'esbirro': return 'un Esbirro';
      case 'forastero': return 'un Forastero';
      case 'aldeano': return 'un Aldeano';
      case 'viajero': return 'un Viajero';
      default: return category;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-theme-container border border-outline-ghost/80 rounded-2xl max-w-6xl w-full max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-outline-ghost/60 bg-surface-container/50 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-theme-main/15 border border-theme-main/30 flex items-center justify-center text-theme-main shrink-0 shadow-inner">
              <Tv className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-display font-semibold text-on-surface truncate">
                  {match.title}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-theme-main/20 text-theme-main border border-theme-main/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Multicámara</span>
                </span>
              </div>
              <p className="text-xs text-on-surface-muted truncate">
                {activePov
                  ? `Reproduciendo punto de vista de: ${activePov.name}${showRoleInfo ? ` (${activePov.character})` : ''}`
                  : `${povs.length} cámaras / perspectivas disponibles`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activePov && (
              <button
                type="button"
                onClick={() => {
                  setActivePov(null);
                  setStep({ type: 'main' });
                }}
                className="px-3 py-1.5 text-xs font-display font-medium text-on-surface bg-surface-container/80 hover:bg-surface-container border border-outline-ghost/60 rounded-xl transition-all flex items-center gap-1.5"
                title="Volver a la selección de punto de vista"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cambiar Modo</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-on-surface-muted hover:text-on-surface hover:bg-surface-container rounded-xl transition-all"
              title="Cerrar reproductor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: O BIEN SELECTOR ANTI-SPOILERS O BIEN REPRODUCTOR ACTIVO */}
        <div className="flex-1 overflow-auto bg-background/50 flex flex-col">
          {!activePov ? (
            /* --- FASE 1: SELECTOR INTERACTIVO ANTI-SPOILERS --- */
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-3xl mx-auto w-full">
              
              {/* Botón de retorno si estamos en un submenú */}
              {step.type !== 'main' && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      step.type === 'category_pick_character' ||
                      step.type === 'category_pick_player'
                    ) {
                      setStep({ type: 'category_menu', category: step.category });
                    } else {
                      setStep({ type: 'main' });
                    }
                  }}
                  className="self-start mb-4 inline-flex items-center gap-2 text-xs sm:text-sm font-display text-on-surface-muted hover:text-theme-main transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver</span>
                </button>
              )}

              {/* Encabezado del selector */}
              <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-semibold text-on-surface mb-2">
                  {step.type === 'main' && '¿Qué punto de vista deseas ver?'}
                  {step.type === 'category_menu' && `Elige cómo quieres ver a ${getCategoryLabel(step.category)}`}
                  {step.type === 'category_pick_character' && `Selecciona el personaje (${getCategoryLabel(step.category)})`}
                  {step.type === 'category_pick_player' && `Selecciona el jugador (${getCategoryLabel(step.category)})`}
                  {step.type === 'general_pick_player' && 'Selecciona un jugador concreto'}
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-muted max-w-md mx-auto">
                  {step.type === 'main' && 'Selecciona un rol, perspectiva aleatoria o jugador concreto sin spoilers.'}
                  {step.type === 'category_menu' && 'Elige si prefieres que sea seleccionado al azar o ver los disponibles.'}
                  {step.type === 'category_pick_character' && 'Haz clic en el personaje que deseas presenciar.'}
                  {step.type === 'category_pick_player' && 'Haz clic en el jugador que deseas seguir.'}
                  {step.type === 'general_pick_player' && 'Selecciona el jugador por su nombre. Su personaje no será revelado.'}
                </p>
              </div>

              {/* 1. MENÚ PRINCIPAL (8 OPCIONES) */}
              {step.type === 'main' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
                  {/* Opción 1: Narrador */}
                  <button
                    type="button"
                    disabled={povsByType.narrador.length === 0}
                    onClick={() => handleMainMenuOption('narrador')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povsByType.narrador.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-amber-400/50 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Scroll className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-amber-300 transition-colors">
                        1. Punto de vista del narrador
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        {povsByType.narrador.length > 0 ? 'Comienza directamente con la visión del grimorio' : 'No disponible'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Opción 2: Demonio */}
                  <button
                    type="button"
                    disabled={povsByType.demonio.length === 0}
                    onClick={() => handleMainMenuOption('demonio')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povsByType.demonio.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-red-500/50 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Skull className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-red-400 transition-colors">
                        2. Punto de vista del demonio
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        {povsByType.demonio.length > 0 ? 'Comienza directamente con el bando malvado' : 'No disponible'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-red-400 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Opción 3: Esbirro */}
                  <button
                    type="button"
                    disabled={povsByType.esbirro.length === 0}
                    onClick={() => handleMainMenuOption('esbirro')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povsByType.esbirro.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-orange-500/50 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Skull className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-orange-300 transition-colors">
                        3. Punto de vista de un esbirro
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        {povsByType.esbirro.length > 0 ? `${povsByType.esbirro.length} disponible${povsByType.esbirro.length > 1 ? 's' : ''}` : 'No disponible'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Opción 4: Forastero */}
                  <button
                    type="button"
                    disabled={povsByType.forastero.length === 0}
                    onClick={() => handleMainMenuOption('forastero')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povsByType.forastero.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-teal-500/50 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <HelpCircle className="w-6 h-6 text-teal-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-teal-300 transition-colors">
                        4. Punto de vista de un forastero
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        {povsByType.forastero.length > 0 ? `${povsByType.forastero.length} disponible${povsByType.forastero.length > 1 ? 's' : ''}` : 'No disponible'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Opción 5: Aldeano */}
                  <button
                    type="button"
                    disabled={povsByType.aldeano.length === 0}
                    onClick={() => handleMainMenuOption('aldeano')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povsByType.aldeano.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-blue-500/50 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Shield className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-blue-300 transition-colors">
                        5. Punto de vista de un aldeano
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        {povsByType.aldeano.length > 0 ? `${povsByType.aldeano.length} disponible${povsByType.aldeano.length > 1 ? 's' : ''}` : 'No disponible'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Opción 6: Viajero */}
                  <button
                    type="button"
                    disabled={povsByType.viajero.length === 0}
                    onClick={() => handleMainMenuOption('viajero')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povsByType.viajero.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-purple-500/50 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Compass className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-purple-300 transition-colors">
                        6. Punto de vista de un viajero
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        {povsByType.viajero.length > 0 ? `${povsByType.viajero.length} disponible${povsByType.viajero.length > 1 ? 's' : ''}` : 'No disponible'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Opción 7: Jugador aleatorio */}
                  <button
                    type="button"
                    disabled={povs.length === 0}
                    onClick={() => handleMainMenuOption('random_player')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povs.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-theme-main/60 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-theme-main/15 border border-theme-main/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Shuffle className="w-6 h-6 text-theme-main" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-theme-main transition-colors">
                        7. Jugador aleatorio
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        Sorpréndete con una perspectiva al azar entre todos los jugadores
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-theme-main group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Opción 8: Jugador concreto */}
                  <button
                    type="button"
                    disabled={povs.length === 0}
                    onClick={() => handleMainMenuOption('concrete_player')}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all group ${
                      povs.length > 0
                        ? 'bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-theme-main/60 hover:shadow-lg cursor-pointer'
                        : 'bg-surface-container-low/30 border-outline-ghost/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-theme-main/15 border border-theme-main/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <User className="w-6 h-6 text-theme-main" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-sm sm:text-base text-on-surface group-hover:text-theme-main transition-colors">
                        8. Jugador concreto
                      </span>
                      <span className="text-[11px] text-on-surface-muted">
                        Elige directamente a la persona sin conocer su personaje
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-theme-main group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              )}

              {/* 2. SUBMENÚ DE CATEGORÍA (4 OPCIONES CUANDO HAY >1 EN LA CATEGORÍA) */}
              {step.type === 'category_menu' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  {/* Subopción 1: Personaje aleatorio */}
                  <button
                    type="button"
                    onClick={() => pickRandomPov(povsByType[step.category])}
                    className="flex items-center gap-3.5 p-5 rounded-xl border bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-theme-main/60 transition-all text-left group cursor-pointer shadow-md"
                  >
                    <div className="w-11 h-11 rounded-xl bg-theme-main/15 border border-theme-main/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Shuffle className="w-6 h-6 text-theme-main" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-base text-on-surface group-hover:text-theme-main transition-colors">
                        1. Personaje aleatorio
                      </span>
                      <span className="text-xs text-on-surface-muted">
                        Elige al azar uno de los {povsByType[step.category].length} personajes
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-theme-main" />
                  </button>

                  {/* Subopción 2: Personaje concreto */}
                  <button
                    type="button"
                    onClick={() => setStep({ type: 'category_pick_character', category: step.category })}
                    className="flex items-center gap-3.5 p-5 rounded-xl border bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-theme-main/60 transition-all text-left group cursor-pointer shadow-md"
                  >
                    <div className="w-11 h-11 rounded-xl bg-theme-main/15 border border-theme-main/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {getCategoryIcon(step.category)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-base text-on-surface group-hover:text-theme-main transition-colors">
                        2. Personaje concreto
                      </span>
                      <span className="text-xs text-on-surface-muted">
                        Ver lista de personajes para seleccionar uno específico
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-theme-main" />
                  </button>

                  {/* Subopción 3: Jugador aleatorio */}
                  <button
                    type="button"
                    onClick={() => pickRandomPov(povsByType[step.category])}
                    className="flex items-center gap-3.5 p-5 rounded-xl border bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-theme-main/60 transition-all text-left group cursor-pointer shadow-md"
                  >
                    <div className="w-11 h-11 rounded-xl bg-theme-main/15 border border-theme-main/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Shuffle className="w-6 h-6 text-theme-main" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-base text-on-surface group-hover:text-theme-main transition-colors">
                        3. Jugador aleatorio
                      </span>
                      <span className="text-xs text-on-surface-muted">
                        Elige al azar un jugador de este grupo
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-theme-main" />
                  </button>

                  {/* Subopción 4: Jugador concreto */}
                  <button
                    type="button"
                    onClick={() => setStep({ type: 'category_pick_player', category: step.category })}
                    className="flex items-center gap-3.5 p-5 rounded-xl border bg-surface-container/60 hover:bg-surface-container border-outline-ghost hover:border-theme-main/60 transition-all text-left group cursor-pointer shadow-md"
                  >
                    <div className="w-11 h-11 rounded-xl bg-theme-main/15 border border-theme-main/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <User className="w-6 h-6 text-theme-main" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-display font-medium text-base text-on-surface group-hover:text-theme-main transition-colors">
                        4. Jugador concreto
                      </span>
                      <span className="text-xs text-on-surface-muted">
                        Ver lista de nombres de jugadores en esta categoría
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-muted group-hover:text-theme-main" />
                  </button>
                </div>
              )}

              {/* 3. LISTA DE PERSONAJES CONCRETOS DENTRO DE UNA CATEGORÍA */}
              {step.type === 'category_pick_character' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  {povsByType[step.category].map(pov => (
                    <button
                      key={pov.id}
                      type="button"
                      onClick={() => handleStartPlayback(pov)}
                      className="p-4 rounded-xl bg-surface-container/70 border border-outline-ghost hover:border-theme-main hover:bg-surface-container transition-all flex flex-col items-center text-center gap-2 group cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-full bg-theme-main/10 border border-theme-main/30 flex items-center justify-center text-theme-main group-hover:scale-110 transition-transform">
                        {getCategoryIcon(step.category)}
                      </div>
                      <span className="font-display font-semibold text-sm sm:text-base text-on-surface group-hover:text-theme-main transition-colors">
                        {pov.character}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* 4. LISTA DE JUGADORES CONCRETOS DENTRO DE UNA CATEGORÍA */}
              {step.type === 'category_pick_player' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  {povsByType[step.category].map(pov => (
                    <button
                      key={pov.id}
                      type="button"
                      onClick={() => handleStartPlayback(pov)}
                      className="p-4 rounded-xl bg-surface-container/70 border border-outline-ghost hover:border-theme-main hover:bg-surface-container transition-all flex flex-col items-center text-center gap-2 group cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-full bg-theme-main/10 border border-theme-main/30 flex items-center justify-center text-theme-main group-hover:scale-110 transition-transform">
                        <User className="w-5 h-5" />
                      </div>
                      <span className="font-display font-semibold text-sm sm:text-base text-on-surface group-hover:text-theme-main transition-colors">
                        {pov.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* 5. LISTA GENERAL DE JUGADORES CONCRETOS (OPCIÓN 8 GENERAL, SIN REVELAR ROL) */}
              {step.type === 'general_pick_player' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
                  {povs.map(pov => (
                    <button
                      key={pov.id}
                      type="button"
                      onClick={() => handleStartPlayback(pov)}
                      className="p-4 rounded-xl bg-surface-container/70 border border-outline-ghost hover:border-theme-main hover:bg-surface-container transition-all flex flex-col items-center text-center gap-2 group cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-full bg-theme-main/10 border border-theme-main/30 flex items-center justify-center text-theme-main group-hover:scale-110 transition-transform">
                        <User className="w-5 h-5" />
                      </div>
                      <span className="font-display font-semibold text-sm sm:text-base text-on-surface group-hover:text-theme-main transition-colors">
                        {pov.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* --- FASE 2: REPRODUCTOR ACTIVO CON PANEL LATERAL Y CAMBIO EN VIVO --- */
            <div className="flex-1 flex flex-col lg:flex-row h-full min-h-[500px]">
              
              {/* BOTÓN MÓVIL PARA MOSTRAR/OCULTAR CÁMARAS */}
              <div className="lg:hidden flex items-center justify-between p-2.5 bg-surface-container border-b border-outline-ghost">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                  className="px-3 py-1.5 text-xs font-display font-medium text-on-surface bg-surface-container-high rounded-lg flex items-center gap-2"
                >
                  <Users className="w-4 h-4 text-theme-main" />
                  <span>{mobileSidebarOpen ? 'Ocultar Cámaras' : 'Ver Todas las Cámaras (POVs)'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRoleInfo(!showRoleInfo)}
                    className="p-1.5 text-xs rounded-lg text-on-surface-muted hover:text-on-surface"
                    title={showRoleInfo ? 'Ocultar rol' : 'Revelar rol'}
                  >
                    {showRoleInfo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* PANEL LATERAL / FILTRO A LA IZQUIERDA */}
              <div className={`w-full lg:w-80 bg-surface-container/80 border-b lg:border-b-0 lg:border-r border-outline-ghost/80 flex flex-col shrink-0 overflow-y-auto ${
                mobileSidebarOpen ? 'block max-h-60' : 'hidden lg:flex'
              }`}>
                {/* Accesos rápidos de cambio de POV */}
                <div className="p-3.5 border-b border-outline-ghost/60">
                  <span className="text-[11px] font-display font-bold uppercase tracking-wider text-on-surface-muted block mb-2">
                    Cambio Rápido de Cámara
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {povsByType.demonio.length > 0 && (
                      <button
                        type="button"
                        onClick={() => pickRandomPov(povsByType.demonio)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-1.5 transition-all"
                      >
                        <Skull className="w-3.5 h-3.5" />
                        <span>Demonio</span>
                      </button>
                    )}

                    {povsByType.narrador.length > 0 && (
                      <button
                        type="button"
                        onClick={() => pickRandomPov(povsByType.narrador)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium flex items-center gap-1.5 transition-all"
                      >
                        <Scroll className="w-3.5 h-3.5" />
                        <span>Narrador</span>
                      </button>
                    )}

                    {povsByType.esbirro.length > 0 && (
                      <button
                        type="button"
                        onClick={() => pickRandomPov(povsByType.esbirro)}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-medium flex items-center gap-1.5 transition-all"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Esbirro azar</span>
                      </button>
                    )}

                    {povsByType.aldeano.length > 0 && (
                      <button
                        type="button"
                        onClick={() => pickRandomPov(povsByType.aldeano)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium flex items-center gap-1.5 transition-all"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Aldeano azar</span>
                      </button>
                    )}

                    {povsByType.forastero.length > 0 && (
                      <button
                        type="button"
                        onClick={() => pickRandomPov(povsByType.forastero)}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs font-medium flex items-center gap-1.5 transition-all"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Forastero azar</span>
                      </button>
                    )}

                    {povsByType.viajero.length > 0 && (
                      <button
                        type="button"
                        onClick={() => pickRandomPov(povsByType.viajero)}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-medium flex items-center gap-1.5 transition-all"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Viajero azar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => pickRandomPov(povs)}
                      className="col-span-2 px-2.5 py-1.5 rounded-lg bg-theme-main/15 hover:bg-theme-main/25 border border-theme-main/40 text-theme-main text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Cualquier jugador al azar</span>
                    </button>
                  </div>
                </div>

                {/* Lista de todos los jugadores para cambiar en cualquier momento */}
                <div className="p-3.5 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-display font-bold uppercase tracking-wider text-on-surface-muted">
                      Lista de Jugadores ({povs.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRoleInfo(!showRoleInfo)}
                      className="text-[11px] font-display text-theme-main hover:underline flex items-center gap-1"
                    >
                      {showRoleInfo ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showRoleInfo ? 'Ocultar roles' : 'Revelar roles'}</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {povs.map(pov => {
                      const isActive = activePov.id === pov.id;
                      return (
                        <button
                          key={pov.id}
                          type="button"
                          onClick={() => handleStartPlayback(pov)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                            isActive
                              ? 'bg-theme-main/20 border-theme-main text-theme-main font-semibold shadow-sm'
                              : 'bg-surface-container-low/50 hover:bg-surface-container border-outline-ghost/40 text-on-surface'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                              isActive ? 'bg-theme-main text-background font-bold' : 'bg-surface-container-high text-on-surface-muted'
                            }`}>
                              {isActive ? <Play className="w-3 h-3 fill-current ml-0.5" /> : <User className="w-3 h-3" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs truncate">{pov.name}</span>
                              {showRoleInfo && (
                                <span className="text-[10px] text-on-surface-muted truncate">
                                  {pov.character} ({pov.characterType})
                                </span>
                              )}
                            </div>
                          </div>

                          {isActive && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-theme-main/20 text-theme-main border border-theme-main/40 shrink-0">
                              En vivo
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* REPRODUCTOR CENTRAL DE YOUTUBE */}
              <div className="flex-1 flex flex-col bg-black relative">
                <div className="relative flex-1 w-full min-h-[360px] md:min-h-[500px]">
                  <iframe
                    id={playerContainerId}
                    key={`${activePov.id}-${startSeconds}`}
                    src={getEmbedUrl(activePov, startSeconds)}
                    title={`POV de ${activePov.name} - ${match.title}`}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>

                {/* Barra de información inferior del reproductor */}
                <div className="p-3 bg-surface-container/90 border-t border-outline-ghost/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-on-surface">Punto de vista:</span>
                    <span className="text-theme-main font-bold">{activePov.name}</span>
                    {showRoleInfo && (
                      <span className="text-on-surface-muted">
                        • {activePov.character} ({activePov.characterType} - {activePov.initialAlignment})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {currentSecondsDisplay > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-theme-main/15 text-theme-main border border-theme-main/30">
                        <Clock className="w-3 h-3" />
                        <span>Minuto {formatTime(currentSecondsDisplay)} (Sincronizado)</span>
                      </span>
                    )}

                    <a
                      href={`${activePov.youtubeUrl}${activePov.youtubeUrl.includes('?') ? '&' : '?'}t=${currentSecondsDisplay}s`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-on-surface-muted hover:text-theme-main transition-colors flex items-center gap-1 font-medium"
                      title="Abrir este vídeo directamente en YouTube en este segundo"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir en YouTube</span>
                    </a>
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
export default PovMatchPlayerModal;
