import type { DesenlaceDespertar } from '../compartido/despertar';
import type { Jugador } from '../partida/Jugador';
import type { Posibles } from './Percepcion';

/** De dónde viene lo que le hacen a un jugador: un demonio, la ejecución u otra habilidad. */
export type Origen = 'demonio' | 'ejecucion' | 'habilidad';

/** Lo que le hacen. */
export type Efecto = 'matar' | 'envenenar' | 'emborrachar';

/** Lo que alguien (su personaje, si lo hay) intenta hacerle a un jugador. */
export interface Accion {
  origen: Origen;
  personaje: string | null;
  efecto: Efecto;
  /** Ya viene rebotada de otro (el Alcalde): no vuelve a rebotar. */
  rebote?: boolean;
}

/** Un recordatorio que se pone porque alguien gasta su habilidad al salvarse (el «No Ability» del Bufón). */
export interface Gasta {
  asiento: string;
  personaje: string;
  texto: string;
}

/** A quién le llega al final (null: a nadie) y, si alguien gasta su habilidad, su recordatorio. */
export interface Desenlace {
  a: Jugador | null;
  gasta?: Gasta;
}

/**
 * Un jugador como objetivo de lo que le hacen: a quién le llega al final, sin
 * mirar quién lo hace ni quién lo protege. La base (objetivoReal) dice que a él;
 * quien protege, se salva o desvía (el Monje, el Soldado, el Alcalde) lo cambia con
 * su regla (ReglaPersonaje.alterarObjetivo). Con varios desenlaces, elige el
 * narrador; el primero es el que tocaría sin él. Se pide con ContextoReglas.objetivo.
 */
export interface Objetivo {
  recibe(accion: Accion): Posibles<Desenlace>;
}

/** Sin nadie que lo cambie: le llega a él. */
export const objetivoReal = (jugador: Jugador): Objetivo => ({ recibe: () => [{ a: jugador }] });

/** No le llega a nadie. */
export const A_NADIE: Posibles<Desenlace> = [{ a: null }];

/** Los desenlaces, sin repetir (se queda el primero). */
export function sinRepetir(desenlaces: readonly Desenlace[]): Posibles<Desenlace> {
  const clave = (d: Desenlace) => `${d.a?.id ?? ''}|${d.gasta ? `${d.gasta.asiento}:${d.gasta.personaje}:${d.gasta.texto}` : ''}`;
  return desenlaces.filter((d, i) => desenlaces.findIndex((o) => clave(o) === clave(d)) === i);
}

/** Cómo se cuenta un desenlace al narrador: quién muere (por su asiento) y quien gasta su habilidad. */
export const desenlaceDespertar = (d: Desenlace): DesenlaceDespertar => ({ muere: d.a?.id ?? null, ...(d.gasta ? { gasta: d.gasta } : {}) });
