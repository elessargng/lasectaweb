/** Quién hace algo en la partida: un participante (su id) o la propia sala (los temporizadores). */
export type Quien = string | 'sistema';

/** Algo que se puede copiar y a lo que se puede volver (la partida, las estadísticas…). */
export interface Restaurable<I = unknown> {
  instantanea(): I;
  restaurar(instantanea: I): void;
  /** Lo que se compara para saber si ha cambiado (por defecto, la instantánea en JSON). */
  huella?(instantanea: I): string;
  /**
   * El guardarraíl (ver Historia.guardar): si en un paso ha cambiado algo de lo que
   * tiene que quedar en el diario sin que se apunte nada, qué ha cambiado; si no, null.
   */
  cambioSinHecho?(antes: I, despues: I): string | null;
}

/** Fuera de producción, un cambio sin su hecho en el diario no pasa: en los tests falla, en desarrollo se avisa. */
function sinHecho(uso: string, que: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const aviso = `[Historia] «${uso}» ha cambiado ${que} sin apuntarlo en el diario.`;
  if (process.env.NODE_ENV === 'test') throw new Error(aviso);
  console.error(aviso);
}

/** Cómo estaba todo antes de un paso, y qué paso fue. */
export interface Paso {
  quien: Quien;
  uso: string;
  /** Cada parte (ver Historia.registrar), como estaba antes del paso. */
  antes: Record<string, unknown>;
  /** El paso cambió de fase (anocheció, amaneció, o se limpió el grimorio). */
  cambiaFase: boolean;
}

/** Cuántos pasos se pueden deshacer, como mucho (los más antiguos se olvidan). */
export const PASOS_MAX = 300;

/**
 * Por dónde entra todo lo que cambia la partida: lo que piden los participantes
 * (por los servicios de la sala), el narrador virtual y lo que pasa solo (la
 * votación que avanza con el tiempo). Cada cambio es un paso: lo que se hace
 * dentro de otro paso es parte de él. Antes de cada paso que cambia algo se
 * guarda cómo estaba todo, para deshacerlo (patrón Memento): el último paso, o
 * hasta antes del último cambio de fase. Lo que pasa solo se junta con el paso
 * anterior (la votación, con su nominación). No comprueba permisos.
 */
export class Historia {
  private readonly partes = new Map<string, Restaurable>();
  private pasos: Paso[] = [];
  /** Cuántos pasos hay abiertos ahora (uno dentro de otro). */
  private abiertos = 0;
  /** Se ha deshecho algo en el paso abierto: ese paso no se guarda. */
  private deshecho = false;
  private oyentes: ((paso: Paso | null) => void)[] = [];

  /**
   * Una parte de lo que se guarda en cada paso: la partida ('partida', de la que se
   * lee la fase) y lo que haya que deshacer con ella.
   */
  registrar<I>(nombre: string, parte: Restaurable<I>): void {
    this.partes.set(nombre, parte as Restaurable);
  }

  /** Para enterarse de cada paso que se guarda (null: se ha deshecho, ver deshacer). */
  alCambiar(oyente: (paso: Paso | null) => void): void {
    this.oyentes.push(oyente);
  }

  /** Hace un paso: `hacer`, en nombre de `quien`, por el caso de uso `uso`. Devuelve lo que devuelva. */
  hacer<T>(quien: Quien, uso: string, hacer: () => T): T {
    if (this.abiertos > 0) return this.dentro(hacer);
    const antes = this.instantanea();
    this.deshecho = false;
    const hecho = this.dentro(hacer);
    if (!this.deshecho) this.guardar(quien, uso, antes);
    return hecho;
  }

  /** Si se está haciendo un paso ahora. */
  enCurso(): boolean {
    return this.abiertos > 0;
  }

  /** El último paso que se puede deshacer, o null. */
  ultimo(): Paso | null {
    return this.pasos[this.pasos.length - 1] ?? null;
  }

  /** Se puede volver a antes del último cambio de fase. */
  puedeVolverDeFase(): boolean {
    return this.pasos.some((p) => p.cambiaFase);
  }

  /** Deshace el último paso: todo vuelve a como estaba antes. Devuelve el paso deshecho, o null. */
  deshacer(): Paso | null {
    const paso = this.pasos.pop();
    if (!paso) return null;
    this.volverA(paso);
    return paso;
  }

  /**
   * Vuelve a como estaba todo justo antes del último cambio de fase: lo que se hizo
   * después se deshace. Devuelve ese paso, o null si no hay.
   */
  volverDeFase(): Paso | null {
    const i = this.pasos.map((p) => p.cambiaFase).lastIndexOf(true);
    if (i < 0) return null;
    const paso = this.pasos[i];
    this.pasos = this.pasos.slice(0, i);
    this.volverA(paso);
    return paso;
  }

  /** Cómo está ahora cada parte. */
  instantanea(): Record<string, unknown> {
    return Object.fromEntries([...this.partes].map(([nombre, parte]) => [nombre, parte.instantanea()]));
  }

  private volverA(paso: Paso): void {
    for (const [nombre, parte] of this.partes) if (nombre in paso.antes) parte.restaurar(paso.antes[nombre]);
    this.deshecho = true;
    for (const oyente of this.oyentes) oyente(null);
  }

  private dentro<T>(hacer: () => T): T {
    this.abiertos += 1;
    try {
      return hacer();
    } finally {
      this.abiertos -= 1;
    }
  }

  /** Guarda el paso si ha cambiado algo; lo que pasa solo, con el anterior. */
  private guardar(quien: Quien, uso: string, antes: Record<string, unknown>): void {
    const despues = this.instantanea();
    if (this.huella(antes) === this.huella(despues)) return;
    for (const [nombre, parte] of this.partes) {
      const que = parte.cambioSinHecho?.(antes[nombre], despues[nombre]);
      if (que) sinHecho(uso, que);
    }
    const ultimo = this.ultimo();
    if (quien === 'sistema' && ultimo) return;
    const paso: Paso = { quien, uso, antes, cambiaFase: this.fase(antes) !== this.fase(despues) };
    this.pasos.push(paso);
    if (this.pasos.length > PASOS_MAX) this.pasos.shift();
    for (const oyente of this.oyentes) oyente(paso);
  }

  private huella(todo: Record<string, unknown>): string {
    return [...this.partes].map(([nombre, parte]) => (parte.huella ? parte.huella(todo[nombre]) : JSON.stringify(todo[nombre]))).join('\n');
  }

  /** En qué fase estaba la partida (su momento, número y reinicios), si la hay. */
  private fase(todo: Record<string, unknown>): string {
    const partida = todo.partida as { fase?: unknown } | undefined;
    return JSON.stringify(partida?.fase ?? null);
  }
}
