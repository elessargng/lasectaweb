/** Quién hace algo en la partida: un participante (su id) o la propia sala (los temporizadores). */
export type Quien = string | 'sistema';

/**
 * Por dónde entra todo lo que cambia la partida: lo que piden los participantes
 * (por los servicios de la sala), el narrador virtual y lo que pasa solo (la
 * votación que avanza con el tiempo). Cada cambio es un paso: lo que se hace
 * dentro de otro paso es parte de él. No comprueba permisos.
 */
export class Historia {
  /** Cuántos pasos hay abiertos ahora (uno dentro de otro). */
  private abiertos = 0;

  /** Hace un paso: `hacer`, en nombre de `quien`, por el caso de uso `uso`. Devuelve lo que devuelva. */
  hacer<T>(quien: Quien, uso: string, hacer: () => T): T {
    void quien;
    void uso;
    this.abiertos += 1;
    try {
      return hacer();
    } finally {
      this.abiertos -= 1;
    }
  }

  /** Si se está haciendo un paso ahora. */
  enCurso(): boolean {
    return this.abiertos > 0;
  }
}
