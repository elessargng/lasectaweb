import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type LocalParticipant,
  type Participant,
  type RemoteTrack,
  type VideoTrack,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaseVideo } from './useSala';

/**
 * La videollamada de la sala (cámaras y micrófonos), con LiveKit.
 *
 * - La mesa: todos ven y oyen; emiten jugadores y narradores. De noche no hay
 *   cámaras (solo voz).
 * - Una conversación privada: sus miembros se ven y se oyen solo entre ellos (y
 *   no emiten en la mesa, ni la oyen). Los visitantes que la escuchan no emiten.
 *
 * El servidor decide los permisos (no se puede emitir lo que no toca); aquí se
 * publica o no según los botones de cámara y micrófono, que empiezan apagados:
 * el navegador pide permiso la primera vez que se encienden, no al entrar.
 */

/** Lo que se ve y se oye de alguien (por su id de participante). */
export interface PistasParticipante {
  /** Su cámara, si la tiene encendida. */
  video: VideoTrack | null;
  /** Su micrófono está abierto. */
  microfono: boolean;
  /** Está hablando ahora. */
  hablando: boolean;
}

/** Por qué no se ha podido encender la cámara o el micrófono. */
export interface ProblemaDispositivo {
  dispositivo: 'camara' | 'microfono';
  /** permiso: el navegador no lo deja; sinDispositivo: no hay ninguno (o el elegido ya no está). */
  motivo: 'permiso' | 'sinDispositivo' | 'otro';
}

interface OpcionesVideollamada {
  /** La sala tiene videollamada y estamos dentro. */
  activa: boolean;
  /** Puede emitir en la mesa (jugador o narrador). */
  puedeEmitir: boolean;
  noche: boolean;
  /** La conversación privada en la que está, o null. */
  conversacion: string | null;
  /** En ella habla (miembro); si solo escucha (visitante), no emite. */
  hablaEnConversacion: boolean;
  /** El narrador ha pedido silencio: el micrófono no se emite (el servidor tampoco lo deja). */
  silenciado: boolean;
  idCamara: string;
  idMicrofono: string;
  pedirPase: (sala: string) => Promise<PaseVideo>;
}


const crearRoom = () =>
  new Room({
    // Los cuadros son pequeños: cada uno recibe la calidad que necesita
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: { resolution: VideoPresets.h360.resolution },
    publishDefaults: { simulcast: true, videoSimulcastLayers: [VideoPresets.h90, VideoPresets.h180] },
  });

/** Lo que se ve y se oye de cada participante de una sala (también uno mismo). */
function pistasDe(room: Room | null): Map<string, PistasParticipante> {
  const pistas = new Map<string, PistasParticipante>();
  if (!room) return pistas;
  const de = (p: Participant | LocalParticipant): PistasParticipante => {
    const camara = p.getTrackPublication(Track.Source.Camera);
    const microfono = p.getTrackPublication(Track.Source.Microphone);
    const video = camara && !camara.isMuted ? ((camara.track as VideoTrack | undefined) ?? null) : null;
    return { video, microfono: !!microfono && !microfono.isMuted, hablando: p.isSpeaking };
  };
  for (const p of room.remoteParticipants.values()) pistas.set(p.identity, de(p));
  pistas.set(room.localParticipant.identity, de(room.localParticipant));
  return pistas;
}

function clasificar(error: unknown): ProblemaDispositivo['motivo'] {
  const nombre = error instanceof Error ? error.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'permiso';
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError' || nombre === 'DevicesNotFoundError') return 'sinDispositivo';
  return 'otro';
}

export function useVideollamada({
  activa,
  puedeEmitir,
  noche,
  conversacion,
  hablaEnConversacion,
  silenciado,
  idCamara,
  idMicrofono,
  pedirPase,
}: OpcionesVideollamada) {
  const [camara, setCamara] = useState(false);
  const [microfono, setMicrofono] = useState(false);
  // Oír a los demás (el botón de sonido de la cabecera)
  const [sonido, setSonido] = useState(true);
  const [problema, setProblema] = useState<ProblemaDispositivo | null>(null);
  const [sonidoBloqueado, setSonidoBloqueado] = useState(false);
  // Lo que se ve y se oye, por sala (se recalcula con cada novedad de LiveKit)
  const [mesa, setMesa] = useState<Map<string, PistasParticipante>>(new Map());
  const [privada, setPrivada] = useState<Map<string, PistasParticipante>>(new Map());
  // Sube cada vez que una sala termina de conectarse (para publicar en ella)
  const [conectadas, setConectadas] = useState(0);
  const mesaRef = useRef<Room | null>(null);
  const privadaRef = useRef<Room | null>(null);
  const pedirPaseRef = useRef(pedirPase);
  useEffect(() => {
    pedirPaseRef.current = pedirPase;
  });

  /** Conecta a una sala de vídeo y avisa de cada cambio; devuelve cómo desconectarse. */
  const conectar = useCallback(
    (sala: string, ref: { current: Room | null }, alCambiar: (pistas: Map<string, PistasParticipante>) => void) => {
      const room = crearRoom();
      let cerrada = false;
      const refrescar = () => !cerrada && alCambiar(pistasDe(room));
      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          // El audio de los demás suena por un elemento oculto (fuera del árbol de accesibilidad)
          if (track.kind === Track.Kind.Audio) {
            const elemento = track.attach();
            elemento.setAttribute('aria-hidden', 'true');
            elemento.hidden = true;
            document.body.appendChild(elemento);
          }
          refrescar();
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove());
          refrescar();
        })
        .on(RoomEvent.TrackMuted, refrescar)
        .on(RoomEvent.TrackUnmuted, refrescar)
        .on(RoomEvent.ActiveSpeakersChanged, refrescar)
        .on(RoomEvent.ParticipantConnected, refrescar)
        .on(RoomEvent.ParticipantDisconnected, refrescar)
        .on(RoomEvent.LocalTrackPublished, refrescar)
        .on(RoomEvent.LocalTrackUnpublished, refrescar)
        // Si cambian los permisos propios (p. ej. un narrador que pasa de escuchar a
        // estar dentro), se vuelve a mirar qué publicar
        .on(RoomEvent.ParticipantPermissionsChanged, (_antes, p) => {
          if (!cerrada && p === room.localParticipant) setConectadas((n) => n + 1);
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => !cerrada && setSonidoBloqueado(!room.canPlaybackAudio));
      void pedirPaseRef.current(sala).then(async (pase) => {
        if (cerrada || !pase.ok) return;
        try {
          await room.connect(pase.url, pase.token);
          if (cerrada) return void room.disconnect();
          ref.current = room;
          setSonidoBloqueado(!room.canPlaybackAudio);
          setConectadas((n) => n + 1);
          refrescar();
        } catch (e) {
          console.error('[Videollamada] No se ha podido conectar:', e);
        }
      });
      return () => {
        cerrada = true;
        if (ref.current === room) ref.current = null;
        alCambiar(new Map());
        void room.disconnect();
      };
    },
    [],
  );

  // La mesa: mientras haya videollamada
  useEffect(() => {
    if (!activa) return;
    return conectar('principal', mesaRef, setMesa);
  }, [activa, conectar]);

  // La conversación privada: mientras se esté en una
  useEffect(() => {
    if (!activa || !conversacion) return;
    return conectar(conversacion, privadaRef, setPrivada);
  }, [activa, conversacion, conectar]);

  // Qué se emite y dónde: en la conversación, si se está en una (cámara también de
  // noche); si no, en la mesa (sin cámara de noche). Nunca en las dos.
  useEffect(() => {
    const enConversacion = !!conversacion;
    const publicar = async (room: Room | null, cam: boolean, micro: boolean) => {
      if (!room) return;
      const p = room.localParticipant;
      // Aún sin permiso para emitir (llega enseguida): se publica cuando llegue
      if ((cam || micro) && p.permissions && !p.permissions.canPublish) return;
      try {
        await p.setMicrophoneEnabled(micro, idMicrofono ? { deviceId: idMicrofono } : undefined);
      } catch (e) {
        setMicrofono(false);
        setProblema({ dispositivo: 'microfono', motivo: clasificar(e) });
      }
      try {
        await p.setCameraEnabled(cam, idCamara ? { deviceId: idCamara, resolution: VideoPresets.h360.resolution } : undefined);
      } catch (e) {
        setCamara(false);
        setProblema({ dispositivo: 'camara', motivo: clasificar(e) });
      }
    };
    const enMesa = puedeEmitir && !enConversacion;
    // Con silencio, el micrófono se apaga en todas partes (se queda «encendido» para cuando acabe)
    const micro = microfono && !silenciado;
    void publicar(mesaRef.current, camara && enMesa && !noche, micro && enMesa);
    const hablo = enConversacion && hablaEnConversacion;
    void publicar(privadaRef.current, camara && hablo, micro && hablo);
  }, [camara, microfono, silenciado, noche, puedeEmitir, conversacion, hablaEnConversacion, idCamara, idMicrofono, conectadas]);

  // Cambiar de cámara o de micrófono en Preferencias: se cambia en caliente
  useEffect(() => {
    for (const room of [mesaRef.current, privadaRef.current]) {
      if (!room) continue;
      void room.switchActiveDevice('videoinput', idCamara || 'default').catch(() => undefined);
      void room.switchActiveDevice('audioinput', idMicrofono || 'default').catch(() => undefined);
    }
  }, [idCamara, idMicrofono]);

  // Lo que se oye: nada con el sonido quitado; en una conversación privada, solo ella (la mesa no)
  useEffect(() => {
    for (const p of mesaRef.current?.remoteParticipants.values() ?? []) p.setVolume(sonido && !conversacion ? 1 : 0);
    for (const p of privadaRef.current?.remoteParticipants.values() ?? []) p.setVolume(sonido ? 1 : 0);
  }, [sonido, conversacion, mesa, privada]);

  const alternarCamara = useCallback(() => {
    setProblema(null);
    setCamara((c) => !c);
  }, []);
  const alternarSonido = useCallback(() => setSonido((s) => !s), []);
  const alternarMicrofono = useCallback(() => {
    setProblema(null);
    setMicrofono((m) => !m);
  }, []);
  /** El navegador no deja sonar nada hasta que se interactúa: un clic lo desbloquea. */
  const activarSonido = useCallback(() => {
    for (const room of [mesaRef.current, privadaRef.current]) void room?.startAudio();
    setSonidoBloqueado(false);
  }, []);

  return {
    camara,
    microfono,
    alternarCamara,
    alternarMicrofono,
    sonido,
    alternarSonido,
    problema,
    cerrarProblema: () => setProblema(null),
    sonidoBloqueado,
    activarSonido,
    /** Lo que se ve y se oye en la mesa y en la conversación privada, por participante. */
    mesa,
    privada,
  };
}
