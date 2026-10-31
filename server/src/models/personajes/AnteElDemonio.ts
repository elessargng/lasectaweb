import type { Posibles } from './Percepcion';

/** Lo que un demonio le hace a quien elige. */
export type EfectoDemonio = 'matar' | 'envenenar' | 'emborrachar';

/** Un demonio (su personaje) que intenta algo sobre un jugador. */
export interface AtaqueDemonio {
  demonio: string;
  efecto: EfectoDemonio;
}

/**
 * Cómo acaba: le afecta, se salva o (si es matar) la muerte rebota a otro, a
 * quien elige el narrador.
 */
export type Desenlace = 'afecta' | 'seSalva' | 'rebota';

/**
 * Lo que le pasa a un jugador cuando un demonio lo ataca, sin mirar quién lo
 * ataca ni quién lo protege. La base (anteElDemonioReal) dice que le afecta; quien
 * protege o desvía (el Monje, el Soldado, el Alcalde) la cambia con su regla
 * (ReglaPersonaje.alterarAnteElDemonio). Con varios desenlaces, elige el narrador;
 * el primero es el que tocaría sin él. Se pide con ContextoReglas.anteElDemonio.
 */
export interface AnteElDemonio {
  atacado(ataque: AtaqueDemonio): Posibles<Desenlace>;
}

/** Sin nadie que lo proteja: le afecta. */
export const anteElDemonioReal = (): AnteElDemonio => ({ atacado: () => ['afecta'] });

/** A salvo de cualquier demonio y de todo lo que haga. */
export const aSalvo = (): AnteElDemonio => ({ atacado: () => ['seSalva'] });
