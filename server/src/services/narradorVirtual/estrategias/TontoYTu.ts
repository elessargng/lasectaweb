import { barajar } from '../../../contrato/bolsaAleatoria';
import type { Azar } from '../puertos';
import type { EstrategiaNarrador } from './EstrategiaNarrador';

/** Lo que espera en cada paso de la noche: entre estos ms. */
const ESPERA_PASO = { min: 2000, max: 6000 };
/** Las veces que un rol de información droison recibe la de verdad (las demás, una falsa al azar). */
export const VERDAD_DROISON = 0.1;

/** «Tonto y tú»: elige siempre al azar entre lo que se puede. */
export class TontoYTu implements EstrategiaNarrador {
  constructor(private readonly sorteo: Azar = Math.random) {}

  azar(): number {
    return this.sorteo();
  }

  elegirUno<T>(opciones: readonly T[]): T {
    if (opciones.length === 0) throw new Error('No hay nada entre lo que elegir.');
    return opciones[Math.floor(this.sorteo() * opciones.length)];
  }

  barajar<T>(opciones: readonly T[]): T[] {
    return barajar(opciones, this.sorteo);
  }

  /**
   * Prefiere aldeanos, con un forastero como mucho: entre los aldeanos libres y uno
   * solo de los forasteros libres (al azar), van saliendo de uno en uno. Con 5
   * aldeanos y 2 forasteros, se sacan 3 de 6.
   */
  elegirFaroles(aldeanos: readonly string[], forasteros: readonly string[], cuantos: number): string[] {
    const bolsa = [...aldeanos, ...(forasteros.length ? [this.elegirUno(forasteros)] : [])];
    return this.barajar(bolsa).slice(0, cuantos);
  }

  esperaPaso(): number {
    return ESPERA_PASO.min + Math.floor(this.sorteo() * (ESPERA_PASO.max - ESPERA_PASO.min));
  }

  droisonDaLaVerdad(): boolean {
    return this.sorteo() < VERDAD_DROISON;
  }
}
