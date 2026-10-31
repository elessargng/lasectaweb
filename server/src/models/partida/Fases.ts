import type { FaseDto, SenalamientoDto } from '../../contrato/partida';
import type { HiloDespertar } from './Despertares';
import { PASOS_DE_FASE_MAX } from './eventos';

/**
 * Lo que un cambio de fase deja atrás y la máquina del tiempo devuelve: al
 * anochecer, la calavera y el récord de votos del día; al amanecer, los
 * despertares y el señalamiento de la noche.
 */
export interface Recuerdo {
  marcas?: { asiento: string; votos: number | null }[];
  maximoDelDia?: number | null;
  hilos?: HiloDespertar[];
  senalamiento?: SenalamientoDto | null;
}

interface Paso {
  antes: FaseDto;
  despues: FaseDto;
  recuerdo: Recuerdo;
}

const igual = (a: FaseDto, b: FaseDto) => a.momento === b.momento && a.numero === b.numero && a.reinicios === b.reinicios;

/**
 * En qué momento está la partida (la preparación y, después, noche 1, día 1,
 * noche 2…) y la máquina del tiempo del narrador. No sabe qué pasa en la partida
 * al cambiar de fase: quien la usa le da lo que hay que recordar (ver Recuerdo).
 */
export class Fases {
  private fase: FaseDto = { momento: 'preparacion', numero: 0, reinicios: 0 };
  /** Los cambios de fase hechos, para volver atrás (los más antiguos se olvidan). */
  private pasos: Paso[] = [];

  actual(): FaseDto {
    return { ...this.fase };
  }

  /** Anochece: desde la preparación, la noche 1; desde un día, la siguiente noche. */
  anochecer(recuerdo: Recuerdo): void {
    const { momento, numero, reinicios } = this.fase;
    this.cambiar({ momento: 'noche', numero: momento === 'preparacion' ? 1 : numero + 1, reinicios }, recuerdo);
  }

  /** Amanece: el día de la misma noche. */
  amanecer(recuerdo: Recuerdo): void {
    this.cambiar({ ...this.fase, momento: 'dia' }, recuerdo);
  }

  private cambiar(despues: FaseDto, recuerdo: Recuerdo): void {
    this.pasos.push({ antes: this.actual(), despues: { ...despues }, recuerdo });
    if (this.pasos.length > PASOS_DE_FASE_MAX) this.pasos.shift();
    this.fase = despues;
  }

  /**
   * La fase a la que se volvería con la máquina del tiempo: del día N, la noche N;
   * de la noche N, el día anterior (de la noche 1, la preparación). null en la preparación.
   */
  anterior(): FaseDto | null {
    const { momento, numero, reinicios } = this.fase;
    if (momento === 'preparacion') return null;
    if (momento === 'dia') return { momento: 'noche', numero, reinicios };
    return numero <= 1 ? { momento: 'preparacion', numero: 0, reinicios } : { momento: 'dia', numero: numero - 1, reinicios };
  }

  /**
   * Vuelve a la fase anterior (ver anterior). Si fue este mismo cambio el último
   * que se hizo, devuelve también lo que se recordó al hacerlo; si no, recuerdo
   * null. null si no hay a dónde volver.
   */
  volver(): { fase: FaseDto; recuerdo: Recuerdo | null } | null {
    const anterior = this.anterior();
    if (!anterior) return null;
    const ultimo = this.pasos[this.pasos.length - 1];
    const paso = ultimo && igual(ultimo.despues, this.fase) && igual(ultimo.antes, anterior) ? this.pasos.pop()! : null;
    this.fase = anterior;
    return { fase: { ...anterior }, recuerdo: paso?.recuerdo ?? null };
  }

  /** Otra partida: a la preparación, sin historial (cuenta un reinicio más). */
  nuevaPartida(): void {
    this.pasos = [];
    this.fase = { momento: 'preparacion', numero: 0, reinicios: this.fase.reinicios + 1 };
  }
}
