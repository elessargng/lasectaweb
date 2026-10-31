import type { Grimorio } from '../grimorio';
import type { ClienteJev, PreguntaJev, RespuestaJev } from '../puertos';
import type { Decision, EstrategiaNarrador, PreguntaSiONo } from './EstrategiaNarrador';
import { describirParaJarvis, INSTRUCCIONES_NARRADOR, instruccionesPara } from './instruccionesJarvis';

/** El modelo ha contestado algo que no vale (otra opción, otro tipo). */
export class RespuestaInvalida extends Error {}

/**
 * Jarvis: decide con el modelo JEV. Cada decisión es una pregunta: elegir una de
 * las opciones (`choice`, por su clave) o sí o no (`noul`), con el grimorio y lo
 * que se decide como estado (antes de haber grimorio, como en la bolsa, lo que
 * traiga la decisión en `sinGrimorio`). Con una sola opción, no pregunta. Si el modelo falla
 * o contesta algo que no vale, falla (ver ConRespaldo).
 *
 * Apunta en el log del servidor cada decisión: la petición que manda, lo que
 * contesta el modelo y lo que elige al final.
 */
export class Jarvis implements EstrategiaNarrador {
  constructor(
    private readonly jev: ClienteJev,
    /** Dónde se apunta cada decisión (el log del servidor). */
    private readonly apuntar: (texto: string) => void = (texto) => console.log(texto),
  ) {}

  async elegir<T>(decision: Decision<T>, grimorio: Grimorio): Promise<T> {
    const { motivo, pregunta, opciones, sinGrimorio, instrucciones } = decision;
    if (opciones.length === 1) {
      this.apuntar(`[JARVIS] «${motivo}»: solo hay una opción, ${opciones[0].clave} (${opciones[0].descripcion}); no se pregunta.`);
      return opciones[0].valor;
    }
    const estado = sinGrimorio ? { narrador: INSTRUCCIONES_NARRADOR, decision: { motivo, pregunta }, ...sinGrimorio } : this.estado(motivo, pregunta, grimorio);
    const { decision: r } = await this.preguntar(motivo, estado, {
      decision: {
        type: 'choice',
        instructions: instruccionesPara(motivo, pregunta, instrucciones),
        criteria: Object.fromEntries(opciones.map((o) => [o.clave, describirParaJarvis(o.descripcion, o.rasgos)])),
      },
    });
    const elegida = r?.type === 'choice' ? opciones.find((o) => o.clave === r.choice) : undefined;
    if (!elegida) throw new RespuestaInvalida(`Ha contestado una opción que no existe (${motivo}).`);
    this.apuntar(`[JARVIS] Elige «${motivo}»: ${elegida.clave} (${elegida.descripcion}).`);
    return elegida.valor;
  }

  async siONo({ motivo, pregunta, si, no, probabilidad }: PreguntaSiONo, grimorio: Grimorio): Promise<boolean> {
    const { decision: r } = await this.preguntar(motivo, this.estado(motivo, pregunta, grimorio, probabilidad), {
      decision: { type: 'noul', instructions: instruccionesPara(motivo, pregunta), criteria: { true: si, false: no } },
    });
    if (r?.type !== 'noul' || typeof r.noul !== 'number') throw new RespuestaInvalida(`No ha contestado sí o no (${motivo}).`);
    const eleccion = r.noul > 0.5;
    this.apuntar(`[JARVIS] Elige «${motivo}»: ${eleccion ? 'sí' : 'no'} (${eleccion ? si : no}; noul ${r.noul}).`);
    return eleccion;
  }

  /** Le pregunta al modelo y apunta lo que se manda y lo que contesta (si falla, lo apunta ConRespaldo). */
  private async preguntar(motivo: string, state: unknown, questions: Record<string, PreguntaJev>): Promise<Record<string, RespuestaJev>> {
    this.apuntar(`[JARVIS] Petición «${motivo}»:\n${JSON.stringify({ state, questions }, null, 2)}`);
    const respuesta = await this.jev.decidir(state, questions);
    this.apuntar(`[JARVIS] Respuesta «${motivo}»:\n${JSON.stringify(respuesta, null, 2)}`);
    return respuesta;
  }

  private estado(motivo: string, pregunta: string, grimorio: Grimorio, probabilidad?: number) {
    return {
      narrador: INSTRUCCIONES_NARRADOR,
      decision: { motivo, pregunta, ...(probabilidad !== undefined ? { consejo: { probabilidadSi: probabilidad } } : {}) },
      grimorio,
    };
  }
}
