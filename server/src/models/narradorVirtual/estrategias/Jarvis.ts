import type { Grimorio } from '../grimorio';
import type { ModeloNarrador } from '../puertos';
import type { Decision, EstrategiaNarrador, PreguntaSiONo } from './EstrategiaNarrador';
import { describirParaJarvis, INSTRUCCIONES_NARRADOR, instruccionesPara } from './instruccionesJarvis';

/** El modelo ha contestado algo que no vale (otra opción). */
export class RespuestaInvalida extends Error {}

/**
 * Jarvis: decide con un modelo de IA (sea cual sea, ver ModeloNarrador). Cada
 * decisión es una pregunta: elegir una de las opciones (por su clave) o sí o no,
 * con el grimorio y lo que se decide como contexto (antes de haber grimorio, como
 * en la bolsa, lo que traiga la decisión en `sinGrimorio`). Con una sola opción,
 * no pregunta. Si el modelo falla o contesta algo que no vale, falla (ver ConRespaldo).
 *
 * Apunta en el log del servidor lo que elige en cada decisión.
 */
export class Jarvis implements EstrategiaNarrador {
  constructor(
    private readonly modelo: ModeloNarrador,
    /** Dónde se apunta cada decisión (el log del servidor). */
    private readonly apuntar: (texto: string) => void = (texto) => console.log(texto),
  ) {}

  async elegir<T>(decision: Decision<T>, grimorio: Grimorio): Promise<T> {
    const { motivo, pregunta, opciones, sinGrimorio, instrucciones } = decision;
    if (opciones.length === 1) {
      this.apuntar(`[JARVIS] «${motivo}»: solo hay una opción, ${opciones[0].clave} (${opciones[0].descripcion}); no se pregunta.`);
      return opciones[0].valor;
    }
    const contexto = sinGrimorio ? { narrador: INSTRUCCIONES_NARRADOR, decision: { motivo, pregunta }, ...sinGrimorio } : this.contexto(motivo, pregunta, grimorio);
    const clave = await this.modelo.elegir(
      contexto,
      instruccionesPara(motivo, pregunta, instrucciones),
      Object.fromEntries(opciones.map((o) => [o.clave, describirParaJarvis(o.descripcion, o.rasgos)])),
    );
    const elegida = opciones.find((o) => o.clave === clave);
    if (!elegida) throw new RespuestaInvalida(`Ha contestado una opción que no existe (${motivo}).`);
    this.apuntar(`[JARVIS] Elige «${motivo}»: ${elegida.clave} (${elegida.descripcion}).`);
    return elegida.valor;
  }

  async siONo({ motivo, pregunta, si, no, probabilidad }: PreguntaSiONo, grimorio: Grimorio): Promise<boolean> {
    const probabilidadSi = await this.modelo.siONo(this.contexto(motivo, pregunta, grimorio, probabilidad), instruccionesPara(motivo, pregunta), si, no);
    const eleccion = probabilidadSi > 0.5;
    this.apuntar(`[JARVIS] Elige «${motivo}»: ${eleccion ? 'sí' : 'no'} (${eleccion ? si : no}; probabilidad de sí ${probabilidadSi}).`);
    return eleccion;
  }

  private contexto(motivo: string, pregunta: string, grimorio: Grimorio, probabilidad?: number) {
    return {
      narrador: INSTRUCCIONES_NARRADOR,
      decision: { motivo, pregunta, ...(probabilidad !== undefined ? { consejo: { probabilidadSi: probabilidad } } : {}) },
      grimorio,
    };
  }
}
