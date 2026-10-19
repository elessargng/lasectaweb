import {
  ConnectionState,
  createAudioAnalyser,
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  VideoPresets,
  type LocalAudioTrack,
  type LocalParticipant,
  type Participant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type VideoTrack,
} from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Por qué ha fallado el dispositivo, o null si no es cosa del dispositivo (la
 * sala se está cerrando, aún no hay permiso para esa fuente…): eso se arregla
 * solo en cuanto cambia la sala y no hay que apagar el botón ni avisar.
 */
/**
 * Uno mismo habla según lo que capta su micrófono, aquí mismo: lo que dice el
 * servidor de vídeo llega uno o dos segundos tarde, y ver el propio aro con
 * retraso desconcierta. Volumen (0-1) a partir del que se habla, y cuánto se
 * sigue «hablando» tras callar (las pausas entre palabras no lo apagan).
 */
const UMBRAL_VOZ = 0.05;
const PAUSA_VOZ_MS = 400;
const CADA_MS = 50;

/**
 * Oír o no a los de una sala, cada uno a su volumen (0 a 1; de entrada, 1). Bajar
 * el volumen a 0 no basta: Safari en iPhone y iPad no deja cambiarlo y seguiría
 * sonando. Así que, sin oírle, además se le pide al servidor que deje de mandar su audio.
 */
function oir(room: Room | null, oye: boolean, volumenes: Record<string, number>) {
  for (const p of room?.remoteParticipants.values() ?? []) {
    const volumen = oye ? (volumenes[p.identity] ?? 1) : 0;
    p.setVolume(volumen);
    for (const publicacion of p.audioTrackPublications.values()) publicacion.setEnabled(volumen > 0);
  }
}

function clasificar(error: unknown): ProblemaDispositivo['motivo'] | null {
  const nombre = error instanceof Error ? error.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'permiso';
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError' || nombre === 'DevicesNotFoundError') return 'sinDispositivo';
  // En uso por otro programa (o el sistema no deja abrirlo)
  if (nombre === 'NotReadableError' || nombre === 'TrackStartError' || nombre === 'AbortError') return 'otro';
  return null;
}

/** Si el servidor le deja emitir esa fuente en esa sala (sin lista, todas). */
function puedePublicar(p: LocalParticipant, fuente: Track.Source): boolean {
  if (!p.permissions) return true;
  const { canPublish, canPublishSources } = p.permissions;
  if (!canPublish) return false;
  return canPublishSources.length === 0 || canPublishSources.some((s) => Track.sourceFromProto(s) === fuente);
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
  // El volumen al que se oye a cada uno (0 a 1, por su id; de entrada, 1), en esta pestaña
  const [volumenes, setVolumenes] = useState<Record<string, number>>({});
  const [problema, setProblema] = useState<ProblemaDispositivo | null>(null);
  const [sonidoBloqueado, setSonidoBloqueado] = useState(false);
  // Lo que se ve y se oye, por sala (se recalcula con cada novedad de LiveKit)
  const [mesa, setMesa] = useState<Map<string, PistasParticipante>>(new Map());
  const [privada, setPrivada] = useState<Map<string, PistasParticipante>>(new Map());
  // Uno mismo (su id de participante) y si está hablando, medido en su micrófono
  const [yo, setYo] = useState<string | null>(null);
  const [yoHablando, setYoHablando] = useState(false);
  // Sube cada vez que publico o retiro una pista (para medir el micrófono que toca)
  const [pistasPropias, setPistasPropias] = useState(0);
  // Sube cada vez que una sala termina de conectarse (para publicar en ella)
  const [conectadas, setConectadas] = useState(0);
  const mesaRef = useRef<Room | null>(null);
  const privadaRef = useRef<Room | null>(null);
  /** Si ahora toca oír cada sala (para cortar desde el principio el audio que llegue nuevo). */
  const oyeMesaRef = useRef(true);
  const oyePrivadaRef = useRef(true);
  /** Lo último pedido a cada sala (publicar o dejar de hacerlo), para encadenar lo siguiente. */
  const colasRef = useRef(new WeakMap<Room, Promise<void>>());
  const pedirPaseRef = useRef(pedirPase);
  useEffect(() => {
    pedirPaseRef.current = pedirPase;
  });

  /** Conecta a una sala de vídeo y avisa de cada cambio; devuelve cómo desconectarse. */
  const conectar = useCallback(
    (
      sala: string,
      ref: { current: Room | null },
      oye: { current: boolean },
      alCambiar: (pistas: Map<string, PistasParticipante>) => void,
    ) => {
      const room = crearRoom();
      let cerrada = false;
      const refrescar = () => !cerrada && alCambiar(pistasDe(room));
      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publicacion: RemoteTrackPublication) => {
          // El audio de los demás suena por un elemento oculto (fuera del árbol de accesibilidad)
          if (track.kind === Track.Kind.Audio) {
            // Si ahora no toca oír esta sala, cortado desde el primer instante
            if (!oye.current) publicacion.setEnabled(false);
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
        .on(RoomEvent.LocalTrackPublished, () => {
          refrescar();
          if (!cerrada) setPistasPropias((n) => n + 1);
        })
        .on(RoomEvent.LocalTrackUnpublished, () => {
          refrescar();
          if (!cerrada) setPistasPropias((n) => n + 1);
        })
        // Si cambian los permisos propios (p. ej. un narrador que pasa de escuchar a
        // estar dentro), se vuelve a mirar qué publicar
        .on(RoomEvent.ParticipantPermissionsChanged, (_antes, p) => {
          if (!cerrada && p === room.localParticipant) setConectadas((n) => n + 1);
        })
        // Tras un corte de red, se vuelve a mirar qué publicar
        .on(RoomEvent.Reconnected, () => !cerrada && setConectadas((n) => n + 1))
        // El servidor la ha cerrado (p. ej. al salir de una conversación, antes de que
        // llegue el aviso de la sala): ya no se publica en ella
        .on(RoomEvent.Disconnected, () => {
          if (ref.current === room) ref.current = null;
          if (!cerrada) alCambiar(new Map());
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => !cerrada && setSonidoBloqueado(!room.canPlaybackAudio));
      void pedirPaseRef.current(sala).then(async (pase) => {
        if (cerrada || !pase.ok) return;
        try {
          await room.connect(pase.url, pase.token);
          if (cerrada) return void room.disconnect();
          ref.current = room;
          setYo(room.localParticipant.identity);
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
    return conectar('principal', mesaRef, oyeMesaRef, setMesa);
  }, [activa, conectar]);

  // La conversación privada: mientras se esté en una
  useEffect(() => {
    if (!activa || !conversacion) return;
    return conectar(conversacion, privadaRef, oyePrivadaRef, setPrivada);
  }, [activa, conversacion, conectar]);

  // Qué se emite y dónde: en la conversación, si se está en una (cámara también de
  // noche); si no, en la mesa (sin cámara de noche). Nunca en las dos.
  useEffect(() => {
    const enConversacion = !!conversacion;
    /** Enciende o apaga una fuente; solo un fallo del dispositivo apaga el botón y avisa. */
    const ajustar = async (room: Room, dispositivo: ProblemaDispositivo['dispositivo'], encender: boolean) => {
      const p = room.localParticipant;
      const fuente = dispositivo === 'camara' ? Track.Source.Camera : Track.Source.Microphone;
      // Aún sin permiso para emitirla (llega enseguida): se publica cuando llegue
      if (encender && !puedePublicar(p, fuente)) return;
      try {
        if (dispositivo === 'camara') {
          await p.setCameraEnabled(encender, idCamara ? { deviceId: idCamara, resolution: VideoPresets.h360.resolution } : undefined);
        } else {
          await p.setMicrophoneEnabled(encender, idMicrofono ? { deviceId: idMicrofono } : undefined);
        }
      } catch (e) {
        // Con la sala cerrándose (al salir de una conversación) o sin permiso todavía,
        // no es cosa del dispositivo: se vuelve a intentar con el siguiente cambio
        const motivo = room.state === ConnectionState.Connected ? clasificar(e) : null;
        if (!motivo) return console.warn(`[Videollamada] No se ha podido ${encender ? 'encender' : 'apagar'} ${dispositivo}:`, e);
        if (dispositivo === 'camara') setCamara(false);
        else setMicrofono(false);
        setProblema({ dispositivo, motivo });
      }
    };
    // Las órdenes a cada sala van una detrás de otra: encender y apagar a la vez se pisan
    const publicar = (room: Room | null, cam: boolean, micro: boolean) => {
      if (!room) return;
      const aplicar = async () => {
        if (room.state !== ConnectionState.Connected) return;
        await ajustar(room, 'microfono', micro);
        await ajustar(room, 'camara', cam);
      };
      const siguiente = (colasRef.current.get(room) ?? Promise.resolve()).then(aplicar);
      colasRef.current.set(room, siguiente);
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
    oyeMesaRef.current = sonido && !conversacion;
    oyePrivadaRef.current = sonido;
    oir(mesaRef.current, oyeMesaRef.current, volumenes);
    oir(privadaRef.current, oyePrivadaRef.current, volumenes);
  }, [sonido, conversacion, mesa, privada, volumenes]);

  // Si hablo: el volumen de mi micrófono, en la sala en la que lo emito (la
  // conversación o la mesa). Se vuelve a mirar al publicar o retirar pistas y al
  // conectarse; silenciarse no la retira, pero se mira en cada medida.
  useEffect(() => {
    const room = conversacion ? (hablaEnConversacion ? privadaRef.current : null) : mesaRef.current;
    const publicacion = room?.localParticipant.getTrackPublication(Track.Source.Microphone);
    const pista = publicacion?.track as LocalAudioTrack | undefined;
    // Sin micrófono que medir, callado (la limpieza de la medida anterior ya lo apagó)
    if (!publicacion || !pista || !microfono || silenciado) return;
    let analizador = createAudioAnalyser(pista, { cloneTrack: true });
    // Al cambiar de micrófono en Preferencias la pista se reinicia: se vuelve a medir la nueva
    const alReiniciar = () => {
      void analizador.cleanup();
      analizador = createAudioAnalyser(pista, { cloneTrack: true });
    };
    pista.on(TrackEvent.Restarted, alReiniciar);
    let ultimaVoz = 0;
    const medir = window.setInterval(() => {
      const ahora = Date.now();
      if (!publicacion.isMuted && analizador.calculateVolume() > UMBRAL_VOZ) ultimaVoz = ahora;
      setYoHablando(ahora - ultimaVoz < PAUSA_VOZ_MS);
    }, CADA_MS);
    return () => {
      window.clearInterval(medir);
      pista.off(TrackEvent.Restarted, alReiniciar);
      void analizador.cleanup();
      setYoHablando(false);
    };
  }, [pistasPropias, conectadas, conversacion, hablaEnConversacion, microfono, silenciado]);

  // Lo que dice el servidor de los demás, pero lo mío medido aquí
  const conYo = useCallback(
    (pistas: Map<string, PistasParticipante>) => {
      const mias = yo ? pistas.get(yo) : undefined;
      if (!yo || !mias || mias.hablando === yoHablando) return pistas;
      return new Map(pistas).set(yo, { ...mias, hablando: yoHablando });
    },
    [yo, yoHablando],
  );
  const mesaConYo = useMemo(() => conYo(mesa), [conYo, mesa]);
  const privadaConYo = useMemo(() => conYo(privada), [conYo, privada]);

  const alternarCamara = useCallback(() => {
    setProblema(null);
    setCamara((c) => !c);
  }, []);
  const alternarSonido = useCallback(() => setSonido((s) => !s), []);
  /** El volumen al que se oye a alguien (0 a 1), en la mesa y en las conversaciones. */
  const cambiarVolumen = useCallback((id: string, volumen: number) => {
    setVolumenes((v) => ({ ...v, [id]: Math.min(1, Math.max(0, volumen)) }));
  }, []);
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
    volumenes,
    cambiarVolumen,
    problema,
    cerrarProblema: () => setProblema(null),
    sonidoBloqueado,
    activarSonido,
    /** Lo que se ve y se oye en la mesa y en la conversación privada, por participante. */
    mesa: mesaConYo,
    privada: privadaConYo,
  };
}
