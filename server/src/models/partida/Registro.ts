import { randomUUID } from 'crypto';
import type { EntradaDiario, HechoDiario } from '../compartido/diario';
import type { Fase } from '../compartido/partida';

/**
 * El registro de la sala: todo lo que pasa en sus partidas, en orden (el diario,
 * ver models/compartido/diario). Solo se apunta, nunca se cambia lo apuntado; cada
 * partida empieza en su «nuevaPartida» (la primera, al principio). Es parte de la
 * partida: al deshacer, vuelve con ella. Como solo crece, su instantánea es cuánto
 * había apuntado, y volver a ella es quitar lo de después. No comprueba nada.
 */
export class Registro {
  private entradas: EntradaDiario[] = [];
  /** La primera partida de la sala no empieza con «nuevaPartida»: su id. */
  private primera: string = randomUUID();

  /** Apunta un hecho, en esa fase y ahora. */
  anotar(hecho: HechoDiario, fase: Fase): void {
    this.entradas.push({ ...structuredClone(hecho), fase: { momento: fase.momento, numero: fase.numero }, hora: Date.now() } as EntradaDiario);
  }

  /** Lo apuntado en la partida de ahora (desde su «nuevaPartida»), en orden: una copia. */
  hechos(): EntradaDiario[] {
    return structuredClone(this.entradas.slice(this.inicio()));
  }

  /** El id de la partida de ahora (cambia con cada «nuevaPartida»). */
  partida(): string {
    const i = this.inicio();
    const empieza = this.entradas[i - 1];
    return empieza?.tipo === 'nuevaPartida' ? empieza.partida : this.primera;
  }

  /** Cuántos hechos hay apuntados (en la sala). */
  cuantos(): number {
    return this.entradas.length;
  }

  instantanea(): number {
    return this.entradas.length;
  }

  /** Vuelve a cuando había `cuantos` apuntados: lo de después, fuera. */
  restaurar(cuantos: number): void {
    this.entradas.length = Math.min(this.entradas.length, cuantos);
  }

  /** Todo lo apuntado y el id de la primera partida: para guardarlo y recuperarlo tras un reinicio (ver cargar). */
  exportar(): RegistroGuardado {
    return { primera: this.primera, entradas: structuredClone(this.entradas) };
  }

  /** Vuelve a tener lo apuntado (lo exportado antes de un reinicio). */
  cargar({ primera, entradas }: RegistroGuardado): void {
    this.primera = primera;
    this.entradas = structuredClone(entradas);
  }

  /** Dónde empieza la partida de ahora: justo después de su «nuevaPartida». */
  private inicio(): number {
    return this.entradas.map((e) => e.tipo).lastIndexOf('nuevaPartida') + 1;
  }
}

/** El registro tal como se guarda (ver Registro.exportar). */
export interface RegistroGuardado {
  primera: string;
  entradas: EntradaDiario[];
}
