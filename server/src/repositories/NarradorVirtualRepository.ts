import type { NarradorVirtualDto } from '../contrato/narradorVirtual';

/**
 * Dónde se guarda el narrador virtual de la sala. Es una interfaz: hoy vive en
 * memoria, como la sala (se pierde al reiniciar el servidor); mañana podría ir a
 * la base de datos sin tocar a quien lo usa.
 */
export interface NarradorVirtualRepository {
  /** El que hay, o null. */
  actual(): NarradorVirtualDto | null;
  guardar(narrador: NarradorVirtualDto): void;
  /** Cambia parte de lo guardado (su etapa, su última frase…); sin narrador, nada. */
  actualizar(cambios: Partial<Omit<NarradorVirtualDto, 'id' | 'participante'>>): void;
  borrar(): void;
}

/** El narrador virtual en memoria (uno por sala). */
export class NarradorVirtualEnMemoria implements NarradorVirtualRepository {
  private narrador: NarradorVirtualDto | null = null;

  actual(): NarradorVirtualDto | null {
    return this.narrador ? { ...this.narrador } : null;
  }

  guardar(narrador: NarradorVirtualDto): void {
    this.narrador = { ...narrador };
  }

  actualizar(cambios: Partial<Omit<NarradorVirtualDto, 'id' | 'participante'>>): void {
    if (this.narrador) this.narrador = { ...this.narrador, ...cambios };
  }

  borrar(): void {
    this.narrador = null;
  }
}
