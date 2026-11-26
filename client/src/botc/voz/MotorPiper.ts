import type { InferenceSession } from 'onnxruntime-web';

/** Lo que trae el .onnx.json de una voz de Piper (solo lo que se usa). */
export interface ConfigPiper {
  espeak: { voice: string };
  audio: { sample_rate: number };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  speaker_id_map: Record<string, number>;
}

/** El modelo de una voz ya en memoria: el .onnx y su configuración. */
export interface ArchivosPiper {
  modelo: ArrayBuffer;
  config: ConfigPiper;
  /** Qué hablante del modelo (los que tienen varios, como Sharvard); 0 si solo hay uno. */
  hablante: number;
}

/** Lo que pasa texto a voz con un modelo ya descargado (aquí mismo o en un worker). */
export interface MotorVoz {
  /** Carga el modelo sin esperar a la primera frase. */
  preparar(): Promise<void>;
  /** El audio de la frase, en WAV. */
  sintetizar(texto: string): Promise<Blob>;
  /** Suelta el modelo de la memoria. */
  liberar(): void;
}

/** Cómo se monta un motor: con de dónde salen el modelo y su configuración. */
export type CrearMotor = (cargarArchivos: () => Promise<ArchivosPiper>) => MotorVoz;

interface Fonemizador {
  callMain(args: string[]): void;
}
type CrearFonemizador = (opciones: {
  print: (linea: string) => void;
  printErr: (linea: string) => void;
  locateFile: (archivo: string) => string;
}) => Promise<Fonemizador>;

/**
 * El fonemizador (espeak-ng en WebAssembly) va dentro de vits-web, que no lo
 * exporta: se toma de su carpeta (el nombre lleva un hash, de ahí el patrón).
 */
const modulosFonemizador = import.meta.glob<{ createPiperPhonemize: CrearFonemizador }>(
  '/node_modules/@diffusionstudio/vits-web/dist/piper-*.js',
);

/**
 * Pasa texto a voz con un modelo de Piper (VITS): texto → fonemas (espeak-ng) →
 * audio (ONNX). Lo caro (crear la sesión con el modelo y arrancar el fonemizador)
 * se hace una vez, con la primera frase; las demás solo calculan su audio. Las
 * frases se atienden de una en una, en el orden en que llegan.
 */
export class MotorPiper implements MotorVoz {
  private readonly cargarArchivos: () => Promise<ArchivosPiper>;
  private preparado: Promise<{ sesion: InferenceSession; config: ConfigPiper; hablante: number; ort: typeof import('onnxruntime-web') }> | null = null;
  private fonemizador: Promise<Fonemizador> | null = null;
  /** Lo que escribe el fonemizador va a la frase que se esté fonemizando. */
  private alEscribir: ((linea: string) => void) | null = null;
  private cola: Promise<unknown> = Promise.resolve();

  /** `cargarArchivos`: de dónde salen el modelo y su configuración (se llama una vez). */
  constructor(cargarArchivos: () => Promise<ArchivosPiper>) {
    this.cargarArchivos = cargarArchivos;
  }

  /** Carga el modelo y arranca el fonemizador sin esperar a la primera frase. */
  async preparar(): Promise<void> {
    await Promise.all([this.cargar(), this.arrancarFonemizador()]);
  }

  liberar(): void {
    const preparado = this.preparado;
    this.preparado = null;
    this.fonemizador = null;
    void preparado?.then(({ sesion }) => sesion.release()).catch(() => undefined);
  }

  /** El audio de la frase, en WAV. */
  sintetizar(texto: string): Promise<Blob> {
    const turno = this.cola.then(() => this.calcular(texto));
    this.cola = turno.catch(() => undefined);
    return turno;
  }

  private async calcular(texto: string): Promise<Blob> {
    const { sesion, config, hablante, ort } = await this.cargar();
    const fonemas = await this.fonemas(texto, config.espeak.voice);
    const { noise_scale, length_scale, noise_w } = config.inference;
    const entradas: Record<string, InstanceType<typeof ort.Tensor>> = {
      input: new ort.Tensor('int64', BigInt64Array.from(fonemas, BigInt), [1, fonemas.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(fonemas.length)])),
      scales: new ort.Tensor('float32', Float32Array.from([noise_scale, length_scale, noise_w])),
    };
    if (Object.keys(config.speaker_id_map).length) entradas.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(hablante)]));
    const { output } = await sesion.run(entradas);
    return new Blob([pcmAWav(output.data as Float32Array, config.audio.sample_rate)], { type: 'audio/wav' });
  }

  private cargar() {
    this.preparado ??= (async () => {
      const ort = await import('onnxruntime-web');
      const { ONNX_BASE } = await import('@diffusionstudio/vits-web');
      // Varios hilos solo si la página está aislada (COOP/COEP); si no, el navegador no los deja
      ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? navigator.hardwareConcurrency : 1;
      ort.env.wasm.wasmPaths = ONNX_BASE;
      const { modelo, config, hablante } = await this.cargarArchivos();
      return { sesion: await ort.InferenceSession.create(modelo), config, hablante, ort };
    })();
    // Si falla (sin conexión, sin el modelo), la próxima frase lo vuelve a intentar
    this.preparado.catch(() => (this.preparado = null));
    return this.preparado;
  }

  /** Los ids de los fonemas de la frase. Si el fonemizador falla, se arranca otro y se reintenta una vez. */
  private async fonemas(texto: string, voz: string, reintento = false): Promise<number[]> {
    const fonemizador = await this.arrancarFonemizador();
    const salida: { fonemas?: number[] } = {};
    this.alEscribir = (linea) => (salida.fonemas = (JSON.parse(linea) as { phoneme_ids: number[] }).phoneme_ids);
    try {
      fonemizador.callMain(['-l', voz, '--input', JSON.stringify([{ text: texto.trim() }]), '--espeak_data', '/espeak-ng-data']);
    } catch {
      delete salida.fonemas;
    } finally {
      this.alEscribir = null;
    }
    if (salida.fonemas?.length) return salida.fonemas;
    this.fonemizador = null;
    if (reintento) throw new Error('El fonemizador no ha devuelto nada.');
    return this.fonemas(texto, voz, true);
  }

  private arrancarFonemizador() {
    this.fonemizador ??= (async () => {
      const [cargar] = Object.values(modulosFonemizador);
      const { createPiperPhonemize } = await cargar();
      const { WASM_BASE } = await import('@diffusionstudio/vits-web');
      return createPiperPhonemize({
        print: (linea) => this.alEscribir?.(linea),
        printErr: () => undefined,
        locateFile: (archivo) => (archivo.endsWith('.wasm') ? `${WASM_BASE}.wasm` : archivo.endsWith('.data') ? `${WASM_BASE}.data` : archivo),
      });
    })();
    this.fonemizador.catch(() => (this.fonemizador = null));
    return this.fonemizador;
  }
}

/** Muestras de -1 a 1, en un WAV de 16 bits y un canal. */
function pcmAWav(muestras: Float32Array, frecuencia: number): ArrayBuffer {
  const vista = new DataView(new ArrayBuffer(44 + muestras.length * 2));
  const texto = (en: number, s: string) => [...s].forEach((c, i) => vista.setUint8(en + i, c.charCodeAt(0)));
  texto(0, 'RIFF');
  vista.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);
  vista.setUint16(22, 1, true);
  vista.setUint32(24, frecuencia, true);
  vista.setUint32(28, frecuencia * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  texto(36, 'data');
  vista.setUint32(40, muestras.length * 2, true);
  muestras.forEach((m, i) => vista.setInt16(44 + i * 2, Math.max(-1, Math.min(1, m)) * 0x7fff, true));
  return vista.buffer;
}
