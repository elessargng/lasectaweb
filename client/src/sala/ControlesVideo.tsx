import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { IconoSilencio } from './IconosJuego';
import { useAriaLive } from './avisosConfig';
import { botonIcono, botonPrincipal } from './estilos';
import TeclaAtajo from './TeclaAtajo';
import type { Atajo } from './atajos';
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
  /** Los atajos completos, para verlos al lado como una tecla. */
  atajoMicrofono: Atajo;
  atajoCamara: Atajo;
  problema: ProblemaDispositivo | null;
  onCerrarProblema: () => void;
  sonidoBloqueado: boolean;
  onActivarSonido: () => void;
  /** El narrador ha pedido silencio: el micrófono no se puede usar (y dice por qué). */
  silenciado: boolean;
  /** Narradores, con el Bibliotecario del Infierno en juego: pedir silencio a todos o levantarlo; null si no. */
  silencio: { activo: boolean; onAlternar: () => void } | null;
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

/** Medallón de latón; apagado, de lacre. */
const boton = (activo: boolean) => `${botonIcono} h-9 w-9 ${activo ? '' : 'sala-boton-apagado'}`;

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
  atajoMicrofono,
  atajoCamara,
  problema,
  onCerrarProblema,
  sonidoBloqueado,
  onActivarSonido,
  silenciado,
  silencio,
}: ControlesVideoProps) => {
  const ariaLive = useAriaLive('errores');
  const info = problema && explicacion(problema);

  return (
    <div className="relative flex items-center gap-2">
      {sonidoBloqueado && (
        <button type="button" onClick={onActivarSonido} className={`${botonPrincipal} px-3 py-1.5 text-xs`}>
          <Volume2 size={16} />
          {/* En pantallas estrechas, solo el icono a la vista (el texto sigue siendo su nombre) */}
          <span className="max-sm:sr-only">Activar sonido</span>
        </button>
      )}
      {puedeEmitir && (
        <>
          <button
            type="button"
            aria-label="Micrófono"
            aria-pressed={microfono && !silenciado}
            aria-keyshortcuts={teclaMicrofono}
            aria-disabled={silenciado}
            aria-describedby={silenciado ? 'sala-microfono-silencio' : undefined}
            onClick={silenciado ? undefined : onMicrofono}
            className={boton(microfono && !silenciado)}
          >
            {microfono && !silenciado ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <TeclaAtajo atajo={atajoMicrofono} ocultoALector className="max-sm:hidden" />
          {silenciado && (
            <span id="sala-microfono-silencio" className="sr-only">
              El narrador ha pedido silencio.
            </span>
          )}
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
          <TeclaAtajo atajo={atajoCamara} ocultoALector className="max-sm:hidden" />
          {sinCamaraDeNoche && (
            <span id="sala-camara-noche" className="sr-only">
              De noche no hay cámaras, salvo en las conversaciones privadas.
            </span>
          )}
        </>
      )}
      {/* Pedir silencio a todos (narradores, con el Bibliotecario del Infierno): un interruptor;
          pulsado, en sangre (los jugadores no pueden hablar) */}
      {silencio && (
        <button
          type="button"
          aria-label="Pedir silencio"
          aria-pressed={silencio.activo}
          onClick={silencio.onAlternar}
          className={`${botonIcono} h-9 w-9 ${silencio.activo ? 'sala-boton-apagado' : ''}`}
        >
          <IconoSilencio size={18} />
        </button>
      )}
      {/* Oír a los demás (o dejar de oírlos): para todos */}
      <button type="button" aria-label="Sonido" aria-pressed={sonido} onClick={onSonido} className={boton(sonido)}>
        {sonido ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      {/* Si no se puede usar la cámara o el micrófono: por qué y cómo arreglarlo */}
      <div aria-live={ariaLive} className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)]">
        {info && (
          <div className="sala-aviso sala-aviso-error p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-ui font-semibold">{info.titulo}</p>
              <button type="button" onClick={onCerrarProblema} aria-label="Cerrar el aviso" className={`${botonIcono} h-7 w-7`}>
                <X size={14} />
              </button>
            </div>
            <p className="mt-1 text-on-surface">{info.texto}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlesVideo;
