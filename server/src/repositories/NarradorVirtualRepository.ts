import type { SalaNarradorVirtual } from '../contrato/sala';

/**
 * Dónde se guarda el narrador virtual de la sala. Es una interfaz: hoy vive en
 * memoria, como la sala (se pierde al reiniciar el servidor); mañana podría ir a
 * la base de datos sin tocar a quien lo usa.
 */
export interface NarradorVirtualRepository {
  /** El que hay, o null. */
  actual(): SalaNarradorVirtual | null;
  guardar(narrador: SalaNarradorVirtual): void;
  /** Cambia parte de lo guardado (su etapa, su última frase…); sin narrador, nada. */
  actualizar(cambios: Partial<Omit<SalaNarradorVirtual, 'id' | 'participante'>>): void;
  borrar(): void;
}

/** El narrador virtual en memoria (uno por sala). */
export class NarradorVirtualEnMemoria implements NarradorVirtualRepository {
  private narrador: SalaNarradorVirtual | null = null;

  actual(): SalaNarradorVirtual | null {
    return this.narrador ? { ...this.narrador } : null;
  }

  guardar(narrador: SalaNarradorVirtual): void {
    this.narrador = { ...narrador };
  }

  actualizar(cambios: Partial<Omit<SalaNarradorVirtual, 'id' | 'participante'>>): void {
    if (this.narrador) this.narrador = { ...this.narrador, ...cambios };
  }

  borrar(): void {
    this.narrador = null;
  }
}
