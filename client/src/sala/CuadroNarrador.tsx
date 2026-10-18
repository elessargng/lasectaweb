import type { VideoTrack } from 'livekit-client';
import { Ear, MicOff, VolumeX } from 'lucide-react';
import BotonesContacto, { type ContactoParticipante } from './BotonesContacto';
import VideoPista from './VideoPista';
import CuadroAvatar from './CuadroAvatar';
import { botonPrincipal } from './estilos';
import { idNombreNarrador } from './ids';
import { urlDelServidor } from '../utils/api';
import { iconoDe, useFichas } from './fichas';
import { nombreMano } from './formasMano';
import ManoLevantada from './ManoLevantada';
import type { PersonajeMostrado } from './guiones';
import type { SalaParticipante } from './useSala';

interface CuadroNarradorProps {
  narrador: SalaParticipante;
  esYo: boolean;
  /**
   * Visitantes: el botón sobre el retrato para pedir ver el grimorio, o
   * «solicitado» (desactivado) mientras el narrador responde.
   */
  grimorio?: { onSolicitar: () => void } | 'solicitado';
  /** Escribirle y conversar con él (lo que se pueda; escribirle, siempre). */
  contacto?: ContactoParticipante;
  /** Su cámara, si la tiene encendida en la mesa (la propia, en espejo). */
  video?: VideoTrack | null;
  espejo?: boolean;
  hablando?: boolean;
  enConversacion?: boolean;
  /** Escucha una conversación (solo se sabe entre narradores y visitantes): una oreja delante del nombre. */
  escuchando?: boolean;
  /** Tiene el micrófono cerrado (un micro tachado a la izquierda del nombre). */
  silenciado?: boolean;
  /**
   * Un NPC que acompaña al narrador (el Deus Ex Fiasco, si está en juego): su imagen,
   * encima del retrato, apoyada en su borde de abajo. Decorativa: el NPC ya sale en la pestaña NPCs.
   */
  npc?: PersonajeMostrado;
}

/**
 * El cuadro de un narrador: su avatar con «Narrador» encima y su nombre debajo.
 * El rótulo de encima no se lee; el nombre lleva «Narrador:» oculto en pantalla,
 * así se oye todo junto («Narrador: Ana») y es lo que lee al llevarle el foco.
 *
 * Un visitante puede pedirle ver su grimorio: el botón aparece sobre el retrato
 * al pasar el ratón o al llegarle el foco (en pantallas táctiles, siempre); para
 * el lector está siempre, justo después del nombre. Pedido, se queda como
 * «Grimorio solicitado» (desactivado) hasta que el narrador responde: así el
 * foco no se pierde y se sabe que está pedido.
 *
 * También puede levantar la mano (no vota: es para hacerse ver): sale en la
 * esquina del retrato, como la de los jugadores en su ficha, y se dice con el nombre.
 */
const CuadroNarrador = ({
  narrador,
  esYo,
  grimorio,
  contacto,
  video,
  espejo = false,
  hablando = false,
  enConversacion = false,
  escuchando = false,
  silenciado = false,
  npc,
}: CuadroNarradorProps) => {
  const { todosPorId } = useFichas();
  return (
  <div className={`group relative rounded ${hablando ? 'sala-habla' : ''}`}>
    <CuadroAvatar
      titulo="Narrador"
      // Mensaje y conversación junto al rótulo «Narrador», arriba
      junto={contacto && <BotonesContacto nombre={narrador.nombre} {...contacto} />}
      contenido={video ? <VideoPista pista={video} espejo={espejo} /> : undefined}
      imagen={narrador.avatar}
      pie={
        <>
          <p id={idNombreNarrador(narrador.id)} tabIndex={-1} className="mt-2 text-center font-semibold break-words [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] focus:outline-none">
            <span className="sr-only">Narrador: </span>
            {silenciado && (
              <>
                <MicOff size={14} className="mr-1 inline-block align-[-2px] text-blood-pale" />
                <span className="sr-only">silenciado, </span>
              </>
            )}
            {escuchando && <Ear size={14} className="mr-1 inline-block align-[-2px] text-theme-main" />}
            {/* Tu nombre, en latón (el lector oye «(tú)») */}
            <span className={esYo ? 'text-gold-bright' : undefined}>{narrador.nombre}</span>
            {esYo && <span className="sr-only"> (tú)</span>}
            {narrador.sinSonido && (
              <>
                <VolumeX size={14} className="ml-1 inline-block align-[-2px] text-blood-pale" />
                <span className="sr-only"> (sin sonido)</span>
              </>
            )}
            {!narrador.conectado && (
              <span className="block text-xs font-normal italic text-on-surface-muted">
                <span className="sr-only"> (</span>desconectado<span className="sr-only">)</span>
              </span>
            )}
            {narrador.manoLevantada && (
              <span className="sr-only"> (mano levantada: {nombreMano(narrador.formaMano, todosPorId).toLocaleLowerCase('es')})</span>
            )}
            {enConversacion && <span className="sr-only"> (en una conversación privada)</span>}
            {escuchando && <span className="sr-only"> (escuchando una conversación)</span>}
          </p>
        </>
      }
    />
    {npc && iconoDe(npc, null) && (
      // Encima del retrato (o la cámara), en su esquina de abajo a la izquierda (para tapar
      // poco), con tres cuartos de su ancho. La imagen (400×400) tiene márgenes
      // transparentes (77 px a la izquierda, 107 abajo): se desplaza eso para que el dibujo,
      // y no su caja, quede pegado a los bordes. La caja tiene el tamaño y el sitio del retrato.
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-5 z-10 aspect-square">
        <img
          src={urlDelServidor(iconoDe(npc, null)!)}
          alt=""
          className="absolute bottom-0 left-0 w-[75%] -translate-x-[19.25%] translate-y-[26.75%] object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.75)]"
        />
      </div>
    )}
    {/* La mano, en la esquina de arriba a la derecha del retrato (la caja tiene su tamaño y su sitio) */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-5 z-10 aspect-square">
      <ManoLevantada levantada={narrador.manoLevantada} forma={narrador.formaMano} estilo={narrador.estiloMano} enNominacion={false} />
    </div>
    {grimorio && (
      // Sobre el retrato (debajo del rótulo «Narrador»), centrado; solo el botón recibe el ratón
      <div className="pointer-events-none absolute inset-x-0 top-5 flex aspect-square items-center justify-center">
        <button
          type="button"
          onClick={grimorio === 'solicitado' ? undefined : grimorio.onSolicitar}
          aria-disabled={grimorio === 'solicitado'}
          className={`${botonPrincipal} pointer-events-auto px-3 py-1 text-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 motion-reduce:transition-none aria-disabled:cursor-default [@media(hover:none)]:opacity-100`}
        >
          {grimorio === 'solicitado' ? 'Grimorio solicitado' : 'Solicitar grimorio'}
        </button>
      </div>
    )}
  </div>
  );
};

export default CuadroNarrador;
