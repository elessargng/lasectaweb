import type { RemoteAudioTrack } from 'livekit-client';
import { anguloAsiento } from './geometriaMesa';

/**
 * Sonido envolvente (Preferencias → Accesibilidad): el narrador (y quien no tiene
 * asiento) suena delante; los jugadores, en un círculo alrededor de la cabeza que
 * pasa por los oídos, ni delante ni detrás, según su asiento en la plaza. Con 4
 * asientos: el 1 encima, el 2 en el oído derecho, el 3 debajo y el 4 en el izquierdo.
 * Cómo se consigue depende de con qué se oye.
 */
export const SALIDAS_AUDIO = [
  { id: 'auriculares71', nombre: 'Auriculares 7.1' },
  { id: 'auriculares', nombre: 'Auriculares estéreo' },
  { id: 'altavoces', nombre: 'Altavoces estéreo' },
  { id: 'mono', nombre: 'Altavoces mono' },
] as const;
export type SalidaAudio = (typeof SALIDAS_AUDIO)[number]['id'];
export const SALIDA_DEFECTO: SalidaAudio = 'auriculares';
export const esSalidaAudio = (v: unknown): v is SalidaAudio => SALIDAS_AUDIO.some((s) => s.id === v);

/**
 * Lo que se hace de verdad con el sonido: audio 3D para auriculares (HRTF),
 * reparto entre izquierda y derecha, todo al centro, o un canal por altavoz
 * (5.1 o 7.1, si el sistema los da: los auriculares 7.1 hacen el resto).
 */
type Proceso = 'hrtf' | 'estereo' | 'mono' | 'multicanal';

/**
 * Los canales que se usan de cada disposición (5.1: L R C LFE SL SR; 7.1: L R C
 * LFE BL BR SL SR): el central para el narrador y los de los lados, a la altura de
 * los oídos, para los jugadores (no hay altavoces encima ni debajo).
 */
const CANALES: Record<6 | 8, { centro: number; izquierda: number; derecha: number }> = {
  6: { centro: 2, izquierda: 4, derecha: 5 },
  8: { centro: 2, izquierda: 6, derecha: 7 },
};

/** Lo que tarda en llegar a su sitio una voz que cambia de asiento (s): sin saltos. */
const SUAVE = 0.05;

/**
 * La prueba: una plaza de 8 asientos, del 1 al 8 como si hablara quien se sienta
 * en cada uno, y al final el narrador.
 */
const ASIENTOS_PRUEBA = 8;
interface PasoPrueba {
  angulo: number | null;
  texto: string;
  /** La grabación que lo dice (en /sonidos/asientos/, .m4a o .mp3); sin ella, golpes de ruido. */
  archivo: string;
}
const PRUEBA: PasoPrueba[] = [
  ...Array.from({ length: ASIENTOS_PRUEBA }, (_, i) => ({
    angulo: anguloAsiento(i, ASIENTOS_PRUEBA),
    texto: `Asiento ${i + 1}`,
    archivo: `asiento-${i + 1}`,
  })),
  { angulo: null, texto: 'Narrador', archivo: 'narrador' },
];
/** Silencio tras cada grabación, y tras los golpes de ruido (que el lector diga cuál es antes del siguiente). */
const PAUSA_TRAS_VOZ_S = 0.3;
const PAUSA_TRAS_RAFAGAS_S = 0.9;
const DURA_RAFAGAS_S = 0.6;

/**
 * Lleva un sonido a un sitio de la mesa: el ángulo del asiento (radianes, 0
 * arriba, como las agujas del reloj) o null, delante.
 */
interface Espacializador {
  entrada: AudioNode;
  colocar: (angulo: number | null, suave: boolean) => void;
  desconectar: () => void;
}

function fijar(ctx: BaseAudioContext, param: AudioParam, valor: number, suave: boolean) {
  if (suave) param.setTargetAtTime(valor, ctx.currentTime, SUAVE);
  else param.setValueAtTime(valor, ctx.currentTime);
}

function crearEspacializador(ctx: AudioContext, proceso: Proceso, canales: 6 | 8, destino: AudioNode): Espacializador {
  switch (proceso) {
    case 'hrtf': {
      // Sin atenuar con la distancia: todos a la misma, solo cambia de dónde vienen
      const panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'linear', rolloffFactor: 0 });
      panner.connect(destino);
      return {
        entrada: panner,
        colocar: (angulo, suave) => {
          // En Web Audio, delante es -z y encima +y: el narrador, delante; los jugadores, en
          // el círculo que pasa por los oídos (el de arriba de la plaza, encima)
          const [x, y, z] = angulo === null ? [0, 0, -1] : [Math.sin(angulo), Math.cos(angulo), 0];
          if (panner.positionX) {
            fijar(ctx, panner.positionX, x, suave);
            fijar(ctx, panner.positionY, y, suave);
            fijar(ctx, panner.positionZ, z, suave);
          } else {
            panner.setPosition(x, y, z);
          }
        },
        desconectar: () => panner.disconnect(),
      };
    }
    case 'estereo': {
      // Con altavoces no se distingue encima de debajo: solo de izquierda a derecha
      const panner = new StereoPannerNode(ctx);
      panner.connect(destino);
      return {
        entrada: panner,
        colocar: (angulo, suave) => fijar(ctx, panner.pan, angulo === null ? 0 : 0.9 * Math.sin(angulo), suave),
        desconectar: () => panner.disconnect(),
      };
    }
    case 'mono': {
      const centro = new GainNode(ctx, { channelCount: 1, channelCountMode: 'explicit' });
      centro.connect(destino);
      return { entrada: centro, colocar: () => {}, desconectar: () => centro.disconnect() };
    }
    case 'multicanal': {
      const { centro, izquierda, derecha } = CANALES[canales];
      const entrada = new GainNode(ctx, { channelCount: 1, channelCountMode: 'explicit' });
      const mezcla = new ChannelMergerNode(ctx, { numberOfInputs: canales });
      const ganancias = Array.from({ length: canales }, (_, i) => {
        const g = new GainNode(ctx, { gain: 0 });
        entrada.connect(g).connect(mezcla, 0, i);
        return g;
      });
      mezcla.connect(destino);
      return {
        entrada,
        colocar: (angulo, suave) => {
          const cuanto = ganancias.map(() => 0);
          if (angulo === null) cuanto[centro] = 1;
          else {
            // De un oído al otro, a potencia constante (encima y debajo quedan en medio)
            const p = ((Math.sin(angulo) + 1) / 2) * (Math.PI / 2);
            cuanto[izquierda] = Math.cos(p);
            cuanto[derecha] = Math.sin(p);
          }
          ganancias.forEach((g, i) => fijar(ctx, g.gain, cuanto[i], suave));
        },
        desconectar: () => {
          entrada.disconnect();
          ganancias.forEach((g) => g.disconnect());
          mezcla.disconnect();
        },
      };
    }
  }
}

interface Fuente {
  id: string;
  nodo: MediaStreamAudioSourceNode;
  volumen: GainNode;
  espacio: Espacializador;
  /** Si algo le quita el silencio al elemento de LiveKit (p. ej. room.startAudio), se le vuelve a poner. */
  callar: (e: Event) => void;
}

/**
 * Las voces de los demás pasan por aquí en vez de por sus elementos <audio>
 * (que siguen puestos pero callados: sin ellos Chrome no recibe el audio).
 * Tiene su propio AudioContext: el 7.1 cambia los canales de la salida.
 */
export class MezcladorEspacial {
  private readonly ctx = new AudioContext({ latencyHint: 'interactive' });
  private readonly fuentes = new Map<RemoteAudioTrack, Fuente>();
  private posiciones = new Map<string, number>();
  private salida: SalidaAudio;
  private ruido: AudioBuffer | null = null;
  /** Las grabaciones de la prueba («Asiento 1»…), según se piden. */
  private readonly voces = new Map<string, Promise<AudioBuffer | null>>();
  /** Lo que está sonando de la prueba, para pararla a medias. */
  private readonly sonandoPrueba = new Set<AudioBufferSourceNode>();
  /** Canales que da el sistema: 2 casi siempre; 6 u 8 con 5.1 o 7.1 configurado en él. */
  readonly canales: number;

  constructor(salida: SalidaAudio) {
    this.salida = salida;
    this.canales = this.ctx.destination.maxChannelCount;
    this.configurarSalida();
  }

  private get proceso(): Proceso {
    switch (this.salida) {
      case 'auriculares71':
        // Sin 5.1 ni 7.1 en el sistema, lo mejor que se puede: el 3D de los auriculares estéreo
        return this.canales >= 6 ? 'multicanal' : 'hrtf';
      case 'auriculares':
        return 'hrtf';
      case 'altavoces':
        return 'estereo';
      case 'mono':
        return 'mono';
    }
  }

  private configurarSalida() {
    const destino = this.ctx.destination;
    try {
      if (this.proceso === 'multicanal') {
        destino.channelCount = this.canales >= 8 ? 8 : 6;
        destino.channelInterpretation = 'discrete';
      } else {
        destino.channelCount = Math.max(1, Math.min(2, this.canales));
        destino.channelInterpretation = 'speakers';
      }
      destino.channelCountMode = 'explicit';
    } catch {
      // El navegador no deja cambiar los canales: se queda con los suyos.
    }
  }

  private espacializador(): Espacializador {
    return crearEspacializador(this.ctx, this.proceso, this.canales >= 8 ? 8 : 6, this.ctx.destination);
  }

  /** La voz de `id` (su pista), desde su asiento. */
  conectar(pista: RemoteAudioTrack, id: string): void {
    if (this.fuentes.has(pista)) return;
    const nodo = this.ctx.createMediaStreamSource(new MediaStream([pista.mediaStreamTrack]));
    const volumen = new GainNode(this.ctx);
    const espacio = this.espacializador();
    nodo.connect(volumen).connect(espacio.entrada);
    espacio.colocar(this.posiciones.get(id) ?? null, false);
    const callar = (e: Event) => {
      const elemento = e.currentTarget as HTMLMediaElement;
      if (!elemento.muted) elemento.muted = true;
    };
    for (const elemento of pista.attachedElements) {
      elemento.muted = true;
      elemento.addEventListener('volumechange', callar);
    }
    this.fuentes.set(pista, { id, nodo, volumen, espacio, callar });
    this.reanudar();
  }

  /** Deja la voz como estaba: por su elemento <audio>. */
  desconectar(pista: RemoteAudioTrack): void {
    const fuente = this.fuentes.get(pista);
    if (!fuente) return;
    this.fuentes.delete(pista);
    fuente.nodo.disconnect();
    fuente.volumen.disconnect();
    fuente.espacio.desconectar();
    for (const elemento of pista.attachedElements) {
      elemento.removeEventListener('volumechange', fuente.callar);
      elemento.muted = false;
    }
  }

  /** El volumen (0 a 1) al que se oye esa pista: el elemento está callado, así que va aquí. */
  volumen(pista: RemoteAudioTrack, volumen: number): void {
    const fuente = this.fuentes.get(pista);
    if (fuente) fijar(this.ctx, fuente.volumen.gain, volumen, true);
  }

  /** El ángulo del asiento de cada uno (por su id); quien no tiene asiento suena delante. */
  colocar(posiciones: Map<string, number>): void {
    this.posiciones = posiciones;
    for (const { id, espacio } of this.fuentes.values()) espacio.colocar(posiciones.get(id) ?? null, true);
  }

  cambiarSalida(salida: SalidaAudio): void {
    if (salida === this.salida) return;
    this.salida = salida;
    this.configurarSalida();
    for (const fuente of this.fuentes.values()) {
      fuente.volumen.disconnect();
      fuente.espacio.desconectar();
      fuente.espacio = this.espacializador();
      fuente.volumen.connect(fuente.espacio.entrada);
      fuente.espacio.colocar(this.posiciones.get(fuente.id) ?? null, false);
    }
  }

  /** El navegador no deja sonar hasta que se interactúa: se intenta con cada gesto. */
  reanudar(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  /** Todas las voces vuelven a sus elementos y se cierra el contexto. */
  cerrar(): void {
    for (const pista of [...this.fuentes.keys()]) this.desconectar(pista);
    void this.ctx.close().catch(() => undefined);
  }

  /**
   * Cada asiento de una plaza de 8 y luego el narrador, uno tras otro, desde su
   * sitio, para comprobar la salida elegida: la grabación que lo dice o, si no
   * está, golpes de ruido. `alPaso` recibe cuál suena y si lo dice la grabación
   * (sin ella, que lo diga el lector); '' al acabar. Devuelve cómo pararla.
   */
  probar(alPaso: (texto: string, hablado: boolean) => void): () => void {
    this.reanudar();
    let parada = false;
    let temporizador = 0;
    const esperar = (s: number) =>
      new Promise<void>((listo) => {
        temporizador = window.setTimeout(listo, s * 1000);
      });
    void (async () => {
      for (const { angulo, texto, archivo } of PRUEBA) {
        const voz = await this.cargarVoz(archivo);
        if (parada) return;
        alPaso(texto, !!voz);
        if (voz) {
          this.sonarDesde(voz, angulo);
          await esperar(voz.duration + PAUSA_TRAS_VOZ_S);
        } else {
          this.rafagas(angulo);
          await esperar(DURA_RAFAGAS_S + PAUSA_TRAS_RAFAGAS_S);
        }
        if (parada) return;
      }
      alPaso('', false);
    })();
    return () => {
      parada = true;
      window.clearTimeout(temporizador);
      for (const fuente of this.sonandoPrueba) {
        try {
          fuente.stop();
        } catch {
          // Ya había acabado.
        }
      }
    };
  }

  /** Descarga y decodifica una grabación de la prueba (una vez); null si no está. */
  private cargarVoz(archivo: string): Promise<AudioBuffer | null> {
    let voz = this.voces.get(archivo);
    if (!voz) {
      // En m4a o en mp3, la que esté (y se pueda decodificar en este navegador)
      const leer = (extension: string) =>
        fetch(`/sonidos/asientos/${archivo}.${extension}`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((datos) => this.ctx.decodeAudioData(datos));
      voz = leer('m4a')
        .catch(() => leer('mp3'))
        .catch(() => {
          this.voces.delete(archivo); // si se añade luego, se encuentra en la próxima prueba
          return null;
        });
      this.voces.set(archivo, voz);
    }
    return voz;
  }

  /** Suena un sonido desde ese sitio, pasado a mono (el sitio lo pone el espacializador). */
  private sonarDesde(buffer: AudioBuffer, angulo: number | null, antes: AudioNode[] = []): AudioBufferSourceNode {
    const ctx = this.ctx;
    const fuente = new AudioBufferSourceNode(ctx, { buffer });
    const mono = new GainNode(ctx, { channelCount: 1, channelCountMode: 'explicit' });
    const espacio = this.espacializador();
    espacio.colocar(angulo, false);
    let ultimo: AudioNode = fuente;
    for (const nodo of [...antes, mono]) ultimo = ultimo.connect(nodo);
    ultimo.connect(espacio.entrada);
    this.sonandoPrueba.add(fuente);
    fuente.onended = () => {
      this.sonandoPrueba.delete(fuente);
      for (const nodo of [fuente, ...antes, mono]) nodo.disconnect();
      espacio.desconectar();
    };
    fuente.start();
    return fuente;
  }

  /** Tres golpes de ruido suave: se sitúan mucho mejor que un tono puro. */
  private rafagas(angulo: number | null): void {
    const ctx = this.ctx;
    if (!this.ruido) {
      this.ruido = ctx.createBuffer(1, Math.round(ctx.sampleRate * DURA_RAFAGAS_S), ctx.sampleRate);
      const datos = this.ruido.getChannelData(0);
      for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    }
    const filtro = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1500, Q: 0.6 });
    const envolvente = new GainNode(ctx, { gain: 0 });
    const t = ctx.currentTime;
    for (let golpe = 0; golpe < 3; golpe++) {
      const empieza = t + golpe * 0.2;
      envolvente.gain.setValueAtTime(0, empieza);
      envolvente.gain.linearRampToValueAtTime(0.5, empieza + 0.01);
      envolvente.gain.exponentialRampToValueAtTime(0.001, empieza + 0.15);
      envolvente.gain.setValueAtTime(0, empieza + 0.16);
    }
    this.sonarDesde(this.ruido, angulo, [filtro, envolvente]);
  }
}
