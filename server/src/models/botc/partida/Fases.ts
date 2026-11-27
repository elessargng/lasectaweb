import type { Fase } from './tiposPartida';

/**
 * En qué momento está la partida: la preparación y, después, noche 1, día 1,
 * noche 2… Volver atrás es cosa de la historia de la partida (ver Historia).
 */
export class Fases {
  private fase: Fase = { momento: 'preparacion', numero: 0, reinicios: 0 };

  actual(): Fase {
    return { ...this.fase };
  }

  /** Anochece: desde la preparación, la noche 1; desde un día, la siguiente noche. */
  anochecer(): void {
    const { momento, numero, reinicios } = this.fase;
    this.fase = { momento: 'noche', numero: momento === 'preparacion' ? 1 : numero + 1, reinicios };
  }

  /** Amanece: el día de la misma noche. */
  amanecer(): void {
    this.fase = { ...this.fase, momento: 'dia' };
  }

  /** Otra partida: a la preparación (cuenta un reinicio más). */
  nuevaPartida(): void {
    this.fase = { momento: 'preparacion', numero: 0, reinicios: this.fase.reinicios + 1 };
  }

  /** La fase de ahora, para volver a ella (ver restaurar). */
  instantanea(): Fase {
    return this.actual();
  }

  /**
   * Vuelve a esa fase. Si era de otra partida (antes de limpiar el grimorio), cuenta
   * un reinicio más: los reinicios nunca bajan (quien los mira sabe así que todo ha cambiado).
   */
  restaurar(fase: Fase): void {
    const reinicios = fase.reinicios === this.fase.reinicios ? fase.reinicios : this.fase.reinicios + 1;
    this.fase = { ...fase, reinicios };
  }
}
