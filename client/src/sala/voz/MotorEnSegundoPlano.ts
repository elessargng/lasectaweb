import type { PeticionMotor, RespuestaMotor } from './mensajesMotor';
import type { ArchivosPiper, MotorVoz } from './MotorPiper';

type Pedido = { tipo: 'preparar'; archivos: ArchivosPiper } | { tipo: 'sintetizar'; texto: string };

/**
 * Un MotorPiper en un worker (motorPiper.worker.ts), para que calcular el audio no
 * trabe la página. El modelo se le pasa una vez, sin copiarlo. Si el worker se cae,
 * lo pendiente falla (esa frase la dice el navegador) y la próxima arranca otro.
 */
export class MotorEnSegundoPlano implements MotorVoz {
  private readonly cargarArchivos: () => Promise<ArchivosPiper>;
  private worker: Worker | null = null;
  private preparado: Promise<void> | null = null;
  private readonly pendientes = new Map<number, { resolver: (audio?: ArrayBuffer) => void; rechazar: (e: Error) => void }>();
  private siguiente = 0;

  constructor(cargarArchivos: () => Promise<ArchivosPiper>) {
    this.cargarArchivos = cargarArchivos;
  }

  preparar(): Promise<void> {
    this.preparado ??= (async () => {
      const archivos = await this.cargarArchivos();
      await this.pedir({ tipo: 'preparar', archivos }, [archivos.modelo]);
    })();
    this.preparado.catch(() => this.reiniciar());
    return this.preparado;
  }

  async sintetizar(texto: string): Promise<Blob> {
    await this.preparar();
    const audio = await this.pedir({ tipo: 'sintetizar', texto });
    return new Blob([audio!], { type: 'audio/wav' });
  }

  private pedir(pedido: Pedido, transferir: Transferable[] = []): Promise<ArrayBuffer | undefined> {
    const id = ++this.siguiente;
    return new Promise((resolver, rechazar) => {
      this.pendientes.set(id, { resolver, rechazar });
      this.arrancar().postMessage({ ...pedido, id } satisfies PeticionMotor, transferir);
    });
  }

  private arrancar(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./motorPiper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<RespuestaMotor>) => {
      const pendiente = this.pendientes.get(data.id);
      if (!pendiente) return;
      this.pendientes.delete(data.id);
      if ('error' in data) pendiente.rechazar(new Error(data.error));
      else pendiente.resolver(data.audio);
    };
    worker.onerror = () => this.reiniciar();
    this.worker = worker;
    return worker;
  }

  /** Cierra el worker y hace fallar lo pendiente: lo siguiente empieza de cero. */
  private reiniciar() {
    this.worker?.terminate();
    this.worker = null;
    this.preparado = null;
    for (const { rechazar } of this.pendientes.values()) rechazar(new Error('El worker de la voz se ha cerrado.'));
    this.pendientes.clear();
  }
}
