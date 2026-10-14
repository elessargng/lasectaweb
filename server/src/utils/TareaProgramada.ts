import cron, { ScheduledTask } from 'node-cron';

/**
 * Una tarea que se repite según una expresión cron. Solo sabe de cuándo
 * ejecutarse; qué hace se le pasa como función y los errores se registran sin
 * parar la programación.
 */
export class TareaProgramada {
  private programada: ScheduledTask | null = null;

  constructor(
    private nombre: string,
    /** Expresión cron, o null para no programarla. */
    private expresion: string | null,
    private tarea: () => Promise<unknown>,
  ) {}

  iniciar(): void {
    if (this.programada) return;
    if (!this.expresion) {
      console.log(`[${this.nombre}] Deshabilitada por configuración.`);
      return;
    }
    if (!cron.validate(this.expresion)) {
      console.error(`[${this.nombre}] Expresión cron no válida: "${this.expresion}". No se programa.`);
      return;
    }
    this.programada = cron.schedule(this.expresion, () => void this.ejecutar());
    console.log(`[${this.nombre}] Programada (${this.expresion}).`);
  }

  detener(): void {
    this.programada?.stop();
    this.programada = null;
  }

  /** Ejecuta la tarea ahora (también la usa la programación). */
  async ejecutar(): Promise<void> {
    try {
      await this.tarea();
    } catch (e) {
      console.error(`[${this.nombre}] Error:`, e);
    }
  }
}
