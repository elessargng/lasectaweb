import { MotorPiper } from './MotorPiper';
import type { PeticionMotor, RespuestaMotor } from './mensajesMotor';

/**
 * El worker de la voz neuronal: un MotorPiper fuera del hilo de la página. Recibe
 * el modelo una vez (al preparar) y después las frases, y contesta con su audio.
 */
const ambito = self as unknown as {
  onmessage: ((e: MessageEvent<PeticionMotor>) => void) | null;
  postMessage: (respuesta: RespuestaMotor, transferir?: Transferable[]) => void;
};

let motor: MotorPiper | null = null;

ambito.onmessage = async ({ data }) => {
  try {
    if (data.tipo === 'preparar') {
      const { archivos } = data;
      motor = new MotorPiper(async () => archivos);
      await motor.preparar();
      ambito.postMessage({ id: data.id });
      return;
    }
    if (!motor) throw new Error('La voz no está preparada.');
    const audio = await (await motor.sintetizar(data.texto)).arrayBuffer();
    ambito.postMessage({ id: data.id, audio }, [audio]);
  } catch (error) {
    ambito.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
