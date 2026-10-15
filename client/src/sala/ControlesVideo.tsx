import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, X } from 'lucide-react';
import { useAriaLive } from './avisosConfig';
import { botonPrincipal, botonSecundario } from './estilos';
import type { ProblemaDispositivo } from './useVideollamada';

interface ControlesVideoProps {
  /** Puede emitir (jugador o narrador): si no, solo sale «Activar sonido» si hace falta. */
  puedeEmitir: boolean;
  microfono: boolean;
  camara: boolean;
  /** De noche y fuera de una conversación privada no hay cámaras. */
  sinCamaraDeNoche: boolean;
  onMicrofono: () => void;
  onCamara: () => void;
  /** Oír a los demás (todos lo tienen, también los visitantes). */
  sonido: boolean;
  onSonido: () => void;
  /** Las teclas de los atajos, para decirlas («.» y «,»). */
  teclaMicrofono: string;
  teclaCamara: string;
  problema: ProblemaDispositivo | null;
  onCerrarProblema: () => void;
  sonidoBloqueado: boolean;
  onActivarSonido: () => void;
}

const NOMBRES = { camara: 'la cámara', microfono: 'el micrófono' };

/** Qué ha pasado y cómo arreglarlo. */
function explicacion({ dispositivo, motivo }: ProblemaDispositivo): { titulo: string; texto: string } {
  const cual = NOMBRES[dispositivo];
  if (motivo === 'permiso') {
    return {
      titulo: `El navegador no deja usar ${cual}`,
      texto:
        'Pulsa el icono del candado (o de la cámara) a la izquierda de la dirección de la página, en «Cámara» y «Micrófono» elige «Permitir» y vuelve a pulsar el botón. Si antes dijiste que no, puede que tengas que recargar la página.',
    };
  }
  if (motivo === 'sinDispositivo') {
    return {
      titulo: dispositivo === 'camara' ? 'No se encuentra ninguna cámara' : 'No se encuentra ningún micrófono',
      texto:
        'Comprueba que está conectado y encendido. Si tienes varios, elige el que quieras en Preferencias > Comunicaciones. Si no aparece ninguno, puede que el navegador aún no tenga permiso: pulsa el candado junto a la dirección y permite la cámara y el micrófono.',
    };
  }
  return {
    titulo: `No se ha podido encender ${cual}`,
    texto: 'Puede que la esté usando otro programa (Zoom, Teams…). Ciérralo y vuelve a intentarlo.',
  };
}

const boton = (activo: boolean) =>
  `flex h-9 w-9 items-center justify-center rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-main aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${
    activo ? 'border-theme-main bg-theme-container text-white' : 'border-red-500/70 bg-red-950/40 text-red-300'
  }`;

/**
 * En la cabecera: el micrófono y la cámara (botones que se quedan pulsados), con
 * sus atajos. Si el navegador no deja usarlos o no hay ninguno, un recuadro dice
 * por qué y cómo arreglarlo. Si el navegador no deja sonar el audio de los demás
 * hasta que se pulse algo, «Activar sonido».
 */
const ControlesVideo = ({
  puedeEmitir,
  microfono,
  camara,
  sinCamaraDeNoche,
  onMicrofono,
  onCamara,
  sonido,
  onSonido,
  teclaMicrofono,
  teclaCamara,
  problema,
  onCerrarProblema,
  sonidoBloqueado,
  onActivarSonido,
}: ControlesVideoProps) => {
  const ariaLive = useAriaLive('errores');
  const info = problema && explicacion(problema);

  return (
    <div className="relative flex items-center gap-2">
      {sonidoBloqueado && (
        <button type="button" onClick={onActivarSonido} className={`${botonPrincipal} flex items-center gap-1 px-2 py-1 text-xs`}>
          <Volume2 size={16} /> Activar sonido
        </button>
      )}
      {puedeEmitir && (
        <>
          <button
            type="button"
            aria-label="Micrófono"
            aria-pressed={microfono}
            aria-keyshortcuts={teclaMicrofono}
            onClick={onMicrofono}
            className={boton(microfono)}
          >
            {microfono ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button
            type="button"
            aria-label="Cámara"
            aria-pressed={camara && !sinCamaraDeNoche}
            aria-keyshortcuts={teclaCamara}
            aria-disabled={sinCamaraDeNoche}
            aria-describedby={sinCamaraDeNoche ? 'sala-camara-noche' : undefined}
            onClick={sinCamaraDeNoche ? undefined : onCamara}
            className={boton(camara && !sinCamaraDeNoche)}
          >
            {camara && !sinCamaraDeNoche ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          {sinCamaraDeNoche && (
            <span id="sala-camara-noche" className="sr-only">
              De noche no hay cámaras, salvo en las conversaciones privadas.
            </span>
          )}
        </>
      )}
      {/* Oír a los demás (o dejar de oírlos): para todos */}
      <button type="button" aria-label="Sonido" aria-pressed={sonido} onClick={onSonido} className={boton(sonido)}>
        {sonido ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      {/* Si no se puede usar la cámara o el micrófono: por qué y cómo arreglarlo */}
      <div aria-live={ariaLive} className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)]">
        {info && (
          <div className="rounded border border-red-500/60 bg-surface p-3 text-sm shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-red-300">{info.titulo}</p>
              <button type="button" onClick={onCerrarProblema} aria-label="Cerrar el aviso" className={`${botonSecundario} p-1`}>
                <X size={14} />
              </button>
            </div>
            <p className="mt-1 text-on-surface-muted">{info.texto}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlesVideo;
