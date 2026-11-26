/** El reloj del narrador: cuánto puede durar (segundos) y cuánto se sigue viendo al acabar (ms). */
export const SALA_RELOJ = { minSegundos: 5, maxSegundos: 60 * 60, mensajeMax: 120 };
const SALA_RELOJ_TRAS_FIN_MS = 15_000;
/** Tiempo mínimo (ms) entre dos gongs, para que no se pisen. */
const SALA_PAUSA_GONG_MS = 5000;

/** La cuenta atrás del narrador, con su mensaje: cuándo empezó y cuándo acaba (ms). */
export interface Reloj {
  inicio: number;
  fin: number;
  mensaje: string;
}

/**
 * El tiempo que marca el narrador: el gong («¡regresad a la plaza!») y el reloj,
 * una cuenta atrás con su mensaje que ven todos. No comprueba permisos.
 */
export class RelojSala {
  /** Hora (ms) del último gong del narrador, o null. */
  private ultimoGong: number | null = null;
  /** El reloj del narrador, o null. */
  private relojActual: Reloj | null = null;

  /** Hora (ms) del último gong, o null. */
  gong(): number | null {
    return this.ultimoGong;
  }

  /** Suena el gong: todos vuelven a la plaza. Uno cada pocos segundos; si no, el error. */
  sonarGong(): string | null {
    const ahora = Date.now();
    if (this.ultimoGong && ahora - this.ultimoGong < SALA_PAUSA_GONG_MS) return 'El gong aún está sonando.';
    this.ultimoGong = ahora;
    return null;
  }

  /**
   * El reloj del narrador, o null. Acabado, se sigue viendo un rato (con su
   * «¡Tiempo!»); después ya no se manda, para que no lo vea quien entra.
   */
  reloj(): Reloj | null {
    if (this.relojActual && Date.now() - this.relojActual.fin > SALA_RELOJ_TRAS_FIN_MS) this.relojActual = null;
    return this.relojActual;
  }

  /**
   * Pone el reloj: cuenta atrás de `segundos` con su mensaje (sustituye al que
   * hubiera). Si no dura lo que puede durar, el error.
   */
  ponerReloj(segundos: number, mensaje: string): string | null {
    if (!Number.isInteger(segundos)) return 'Indica cuánto dura el reloj.';
    if (segundos < SALA_RELOJ.minSegundos) return `El reloj tiene que durar al menos ${SALA_RELOJ.minSegundos} segundos.`;
    if (segundos > SALA_RELOJ.maxSegundos) return `El reloj puede durar como mucho ${SALA_RELOJ.maxSegundos / 60} minutos.`;
    const inicio = Date.now();
    this.relojActual = { inicio, fin: inicio + segundos * 1000, mensaje: mensaje.trim().slice(0, SALA_RELOJ.mensajeMax) };
    return null;
  }

  /** El reloj está en marcha (aún no ha acabado). */
  relojEnMarcha(): boolean {
    return !!this.relojActual && this.relojActual.fin > Date.now();
  }

  /** Acaba el reloj ya: suena el gong y se ve «¡Tiempo!», como si se hubiera agotado. */
  terminarReloj(): void {
    if (this.relojActual && this.relojActual.fin > Date.now()) this.relojActual = { ...this.relojActual, fin: Date.now() };
  }

  /** Quita el reloj (sin gong). */
  quitarReloj(): void {
    this.relojActual = null;
  }
}
