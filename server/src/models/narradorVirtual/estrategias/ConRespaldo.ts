import type { Grimorio } from '../grimorio';
import type { Temporizador } from '../puertos';
import type { Decision, EstrategiaNarrador, MotivoDecision, PreguntaSiONo } from './EstrategiaNarrador';

/** Lo que espera antes de volver a preguntar a la principal cuando falla (ms). */
export const ESPERA_REINTENTO_MS = 10_000;
/** Las decisiones seguidas del respaldo con las que la principal se rinde. */
export const FALLOS_PARA_RENDIRSE = 5;

/**
 * Una estrategia con otra de respaldo (Jarvis con «Tonto y tú»): si la principal
 * falla, espera un rato y vuelve a intentarlo; si falla otra vez, decide la de
 * respaldo y se apunta. Con unas cuantas decisiones seguidas del respaldo, se da
 * por perdida (`alRendirse`) y desde entonces decide siempre el respaldo.
 */
export class ConRespaldo implements EstrategiaNarrador {
  private seguidas = 0;
  private rendida = false;

  constructor(
    private readonly principal: EstrategiaNarrador,
    private readonly respaldo: EstrategiaNarrador,
    private readonly temporizador: Temporizador,
    private readonly alRendirse: () => void,
    /** Dónde se apunta cada fallo (el log del servidor). */
    private readonly apuntar: (texto: string) => void = (texto) => console.warn(texto),
  ) {}

  elegir<T>(decision: Decision<T>, grimorio: Grimorio): Promise<T> {
    return this.intentar(
      decision.motivo,
      (e) => e.elegir(decision, grimorio),
      (valor) => {
        const opcion = decision.opciones.find((o) => o.valor === valor);
        return opcion ? `${opcion.clave} (${opcion.descripcion})` : JSON.stringify(valor);
      },
    );
  }

  siONo(pregunta: PreguntaSiONo, grimorio: Grimorio): Promise<boolean> {
    return this.intentar(
      pregunta.motivo,
      (e) => e.siONo(pregunta, grimorio),
      (si) => (si ? `sí (${pregunta.si})` : `no (${pregunta.no})`),
    );
  }

  /** `describir`: lo que ha elegido, en palabras (para apuntar lo que decide el respaldo). */
  private async intentar<T>(motivo: MotivoDecision, decidir: (e: EstrategiaNarrador) => Promise<T>, describir: (valor: T) => string): Promise<T> {
    if (this.rendida) return this.delRespaldo(motivo, decidir, describir);
    for (let vez = 1; vez <= 2; vez++) {
      try {
        const r = await decidir(this.principal);
        this.seguidas = 0;
        return r;
      } catch (e) {
        const motivoFallo = e instanceof Error ? e.message : String(e);
        if (vez === 1) {
          this.apuntar(`[JARVIS] Falla al decidir «${motivo}» (${motivoFallo}); se reintenta en ${ESPERA_REINTENTO_MS / 1000} s.`);
          await new Promise<void>((seguir) => this.temporizador.programar(ESPERA_REINTENTO_MS, seguir));
          if (this.rendida) break;
        } else {
          this.apuntar(`[JARVIS] Vuelve a fallar al decidir «${motivo}» (${motivoFallo}): decide «Tonto y tú».`);
        }
      }
    }
    this.seguidas++;
    if (this.seguidas >= FALLOS_PARA_RENDIRSE && !this.rendida) {
      this.rendida = true;
      this.apuntar(`[JARVIS] ${FALLOS_PARA_RENDIRSE} decisiones seguidas de «Tonto y tú»: Jarvis se va.`);
      this.alRendirse();
    }
    return this.delRespaldo(motivo, decidir, describir);
  }

  /** Decide el respaldo, y se apunta qué (lo que finalmente se elige en lugar de Jarvis). */
  private async delRespaldo<T>(motivo: MotivoDecision, decidir: (e: EstrategiaNarrador) => Promise<T>, describir: (valor: T) => string): Promise<T> {
    const valor = await decidir(this.respaldo);
    this.apuntar(`[JARVIS] «Tonto y tú» elige «${motivo}» en su lugar: ${describir(valor)}.`);
    return valor;
  }
}
