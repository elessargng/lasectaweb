import type { SalaReloj } from '../../contrato/sala';

/** El reloj del narrador: cuánto puede durar (segundos) y cuánto se sigue viendo al acabar (ms). */
export const SALA_RELOJ = { minSegundos: 5, maxSegundos: 60 * 60, mensajeMax: 120 };
const SALA_RELOJ_TRAS_FIN_MS = 15_000;

/**
 * El tiempo que marca el narrador: el gong («¡regresad a la plaza!») y el reloj,
 * una cuenta atrás con su mensaje que ven todos. No comprueba permisos.
 */
export class RelojSala {
  /** Hora (ms) del último gong del narrador, o null. */
  private ultimoGong: number | null = null;
  /** El reloj del narrador (ver SalaEstado.reloj), o null. */
  private relojActual: SalaReloj | null = null;

  /** Hora (ms) del último gong (ver SalaEstado.gong), o null. */
  gong(): number | null {
    return this.ultimoGong;
  }

  /** Suena el gong: todos vuelven a la plaza. */
  sonarGong(): void {
    this.ultimoGong = Date.now();
  }

  /**
   * El reloj del narrador, o null. Acabado, se sigue viendo un rato (con su
   * «¡Tiempo!»); después ya no se manda, para que no lo vea quien entra.
   */
  reloj(): SalaReloj | null {
    if (this.relojActual && Date.now() - this.relojActual.fin > SALA_RELOJ_TRAS_FIN_MS) this.relojActual = null;
    return this.relojActual;
  }

  /** Pone el reloj: cuenta atrás de `segundos` con su mensaje (sustituye al que hubiera). */
  ponerReloj(segundos: number, mensaje: string): void {
    const inicio = Date.now();
    this.relojActual = { inicio, fin: inicio + segundos * 1000, mensaje };
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
