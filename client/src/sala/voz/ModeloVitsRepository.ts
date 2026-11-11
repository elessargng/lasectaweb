import type { AlProgreso, ModeloVoz } from './contratos';
import type { ArchivosPiper, ConfigPiper, CrearMotor, MotorVoz } from './MotorPiper';
import type { VozPiper } from './voces';

/** La librería se descarga solo al usarla: quien no activa la voz neuronal no la baja. */
const libreria = () => import('@diffusionstudio/vits-web');

/**
 * El modelo VITS (Piper) de una voz (ver voces.ts), de @diffusionstudio/vits-web. Se descarga de Hugging Face
 * y se guarda en el almacenamiento del navegador (OPFS): la segunda vez ya está.
 * La síntesis no usa `predict` de la librería, que vuelve a cargar el modelo en cada
 * frase, sino un motor que lo carga una vez (el que se le dé: en un worker, para no
 * trabar la página).
 */
export class ModeloVitsRepository implements ModeloVoz {
  private readonly voz: VozPiper;
  private readonly motor: MotorVoz;

  constructor(voz: VozPiper, crearMotor: CrearMotor) {
    this.voz = voz;
    this.motor = crearMotor(() => this.leer());
  }

  async descargado(): Promise<boolean> {
    const { stored } = await libreria();
    return (await stored()).includes(this.voz.modelo);
  }

  async descargar(alProgreso: AlProgreso): Promise<void> {
    const { download } = await libreria();
    // Son varios archivos (el modelo y su configuración): el progreso, de todos juntos
    const archivos = new Map<string, { cargado: number; total: number }>();
    await download(this.voz.modelo, ({ url, loaded, total }) => {
      archivos.set(url, { cargado: loaded, total });
      let cargado = 0;
      let suma = 0;
      for (const a of archivos.values()) {
        cargado += a.cargado;
        suma += a.total;
      }
      if (suma > 0) alProgreso(Math.min(1, cargado / suma));
    });
  }

  preparar(): Promise<void> {
    return this.motor.preparar();
  }

  sintetizar(texto: string): Promise<Blob> {
    return this.motor.sintetizar(texto);
  }

  liberar(): void {
    this.motor.liberar();
  }

  /** El modelo y su configuración, de donde los guardó la librería (si faltan, los descarga). */
  private async leer(): Promise<ArchivosPiper> {
    if (!(await this.descargado())) await this.descargar(() => undefined);
    const { PATH_MAP } = await libreria();
    const nombre = PATH_MAP[this.voz.modelo].split('/').at(-1)!;
    // La librería guarda cada archivo en la carpeta «piper», con el nombre del final de su dirección
    const carpeta = await (await navigator.storage.getDirectory()).getDirectoryHandle('piper');
    const archivo = async (n: string) => (await carpeta.getFileHandle(n)).getFile();
    const [modelo, config] = await Promise.all([
      archivo(nombre).then((f) => f.arrayBuffer()),
      archivo(`${nombre}.json`).then(async (f) => JSON.parse(await f.text()) as ConfigPiper),
    ]);
    return { modelo, config, hablante: this.voz.hablante };
  }
}
