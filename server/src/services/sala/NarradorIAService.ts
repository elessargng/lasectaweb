import type { ModeloNarrador } from '../../models/narradorVirtual/puertos';
import type { NarradorIARepository } from '../../repositories/NarradorIARepository';

/**
 * El narrador de IA (Jarvis) habla con su modelo siempre por aquí, sea cual sea
 * (ver NarradorIARepository): cada pregunta y lo que contesta quedan en el log
 * del servidor. Antes de usarlo, se comprueba que responde (ver `para`).
 */
export class NarradorIAService implements ModeloNarrador {
  constructor(
    private readonly repositorio: NarradorIARepository,
    /** Dónde se apunta cada pregunta y su respuesta (el log del servidor). */
    private readonly apuntar: (texto: string) => void = (texto) => console.log(texto),
  ) {}

  /** El servicio con ese modelo, si responde; o por qué no se puede usar. */
  static async para(repositorio: NarradorIARepository | null, apuntar?: (texto: string) => void): Promise<NarradorIAService | string> {
    if (!repositorio) return 'Jarvis no está disponible en este servidor.';
    const error = await repositorio.comprobar();
    return error ? `El modelo de Jarvis no responde: ${error}` : new NarradorIAService(repositorio, apuntar);
  }

  async elegir(contexto: unknown, instrucciones: string, opciones: Record<string, string>): Promise<string> {
    return this.preguntar('elegir', { contexto, instrucciones, opciones }, () => this.repositorio.elegir(contexto, instrucciones, opciones));
  }

  async siONo(contexto: unknown, instrucciones: string, si: string, no: string): Promise<number> {
    return this.preguntar('sí o no', { contexto, instrucciones, si, no }, () => this.repositorio.siONo(contexto, instrucciones, si, no));
  }

  /** Le pregunta al modelo y apunta lo que se manda y lo que contesta (si falla, lo apunta ConRespaldo). */
  private async preguntar<R>(que: string, peticion: object, hacer: () => Promise<R>): Promise<R> {
    this.apuntar(`[JARVIS] Petición (${que}):\n${JSON.stringify(peticion, null, 2)}`);
    const respuesta = await hacer();
    this.apuntar(`[JARVIS] Respuesta (${que}): ${JSON.stringify(respuesta)}`);
    return respuesta;
  }
}
