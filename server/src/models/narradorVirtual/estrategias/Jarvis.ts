import type { FotoPartida } from '../contexto/FotoPartida';
import { contextoPara } from '../contexto/extractores';
import type { ModeloNarrador } from '../puertos';
import type { Decision, EstrategiaNarrador, MotivoDecision, PreguntaSiONo } from './EstrategiaNarrador';
import { describirParaJarvis, INSTRUCCIONES_NARRADOR, instruccionesPara } from './instruccionesJarvis';

/** El modelo ha contestado algo que no vale (otra opción). */
export class RespuestaInvalida extends Error {}

/**
 * Jarvis: decide con un modelo de IA (sea cual sea, ver ModeloNarrador). Cada
 * decisión es una pregunta: elegir una de las opciones (por su clave) o sí o no,
 * con lo que de la partida sirve para esa decisión como contexto (ver
 * contexto/extractores) y lo que traiga la propia decisión en sus datos. Con una
 * sola opción, no pregunta. Si el modelo falla o contesta algo que no vale, falla
 * (ver ConRespaldo).
 *
 * Apunta en el log del servidor lo que elige en cada decisión.
 */
export class Jarvis implements EstrategiaNarrador {
  constructor(
    private readonly modelo: ModeloNarrador,
    /** Dónde se apunta cada decisión (el log del servidor). */
    private readonly apuntar: (texto: string) => void = (texto) => console.log(texto),
  ) {}

  async elegir<T>(decision: Decision<T>, foto: FotoPartida): Promise<T> {
    const { motivo, pregunta, opciones, instrucciones, sujeto, datos } = decision;
    if (opciones.length === 1) {
      this.apuntar(`[JARVIS] «${motivo}»: solo hay una opción, ${opciones[0].clave} (${opciones[0].descripcion}); no se pregunta.`);
      return opciones[0].valor;
    }
    const clave = await this.modelo.elegir(
      this.contexto(motivo, pregunta, foto, { sujeto, datos }),
      instruccionesPara(motivo, pregunta, instrucciones),
      Object.fromEntries(opciones.map((o) => [o.clave, describirParaJarvis(o.descripcion, o.rasgos)])),
    );
    const elegida = opciones.find((o) => o.clave === clave);
    if (!elegida) throw new RespuestaInvalida(`Ha contestado una opción que no existe (${motivo}).`);
    this.apuntar(`[JARVIS] Elige «${motivo}»: ${elegida.clave} (${elegida.descripcion}).`);
    return elegida.valor;
  }

  async siONo({ motivo, pregunta, si, no, probabilidad, sujeto }: PreguntaSiONo, foto: FotoPartida): Promise<boolean> {
    const probabilidadSi = await this.modelo.siONo(this.contexto(motivo, pregunta, foto, { sujeto, probabilidad }), instruccionesPara(motivo, pregunta), si, no);
    const eleccion = probabilidadSi > 0.5;
    this.apuntar(`[JARVIS] Elige «${motivo}»: ${eleccion ? 'sí' : 'no'} (${eleccion ? si : no}; probabilidad de sí ${probabilidadSi}).`);
    return eleccion;
  }

  /** Quién es, qué se decide (con el consejo, si lo hay) y lo de la partida que sirve para decidirlo. */
  private contexto(
    motivo: MotivoDecision,
    pregunta: string,
    foto: FotoPartida,
    { sujeto, datos, probabilidad }: { sujeto?: string; datos?: Record<string, unknown>; probabilidad?: number },
  ) {
    return {
      narrador: INSTRUCCIONES_NARRADOR,
      decision: { motivo, pregunta, ...(probabilidad !== undefined ? { consejo: { probabilidadSi: probabilidad } } : {}) },
      ...contextoPara(motivo, foto, { sujeto, datos }),
    };
  }
}
