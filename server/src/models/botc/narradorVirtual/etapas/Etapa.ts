import type { EtapaNarradorVirtual } from '../narradores';
import type { SalaDeJuego } from '../../SalaDeJuego';
import type { Decision, EstrategiaNarrador, PreguntaSiONo } from '../estrategias/EstrategiaNarrador';
import { fotoPartida } from '../contexto/FotoPartida';
import type { FueraDeLaBolsa } from '../preparacion';
import type { Azar, Narrador, Temporizador } from '../puertos';

/** Lo que piden los jugadores al narrador virtual en el día (ver NarradorVirtualService.turno). */
export type AccionJugador = 'nominar' | 'defensa' | 'voto' | 'listo' | 'seguirNominando';

/** Lo que tiene cada etapa a mano para llevar la partida. */
export interface ContextoEtapa {
  /** Para leer cómo están la sala y la partida (lo que cambia se hace con `plaza`). */
  readonly juego: SalaDeJuego;
  readonly plaza: Narrador;
  /** Lo que decide su estrategia, con la foto de la partida del momento. */
  decidir<T>(decision: Decision<T>): Promise<T>;
  siONo(pregunta: PreguntaSiONo): Promise<boolean>;
  /** Lo que no es una decisión (las esperas, el orden al revelar): al azar. */
  readonly azar: Azar;
  readonly temporizador: Temporizador;
  /** Lo dice en voz alta (y queda escrito como su última frase). */
  decir(texto: string): void;
  /** Pasa a otra etapa. */
  pasarA(etapa: Etapa): Promise<void>;
  /** Lo que salió al llenar la bolsa pero no va en ella (el Borracho, y qué cree ser): se pone la primera noche. */
  fueraDeLaBolsa(): FueraDeLaBolsa[];
}

/**
 * Una etapa de la partida del narrador virtual (patrón Estado): qué hace al
 * entrar en ella y qué mira cada vez que cambia la sala.
 */
export interface Etapa {
  readonly id: EtapaNarradorVirtual;
  alEntrar?(ctx: ContextoEtapa): Promise<void>;
  alCambiar?(ctx: ContextoEtapa): Promise<void>;
  /** Un jugador pide algo de su turno (nominar, «Defensa», «Voto», «Listo»…). Devuelve el error, si lo hay. */
  alPedir?(ctx: ContextoEtapa, jugador: string, accion: AccionJugador, datos: unknown): Promise<string | null>;
  /**
   * Quien lo añadió acaba ya el reloj de esta etapa (los privados, la puesta en común):
   * suena el gong y se pasa a la siguiente. Devuelve el error, si no hay reloj en marcha.
   */
  terminarReloj?(ctx: ContextoEtapa): Promise<string | null>;
  /** Al irse el narrador (o pasar a otra etapa): cancela lo que tuviera programado. */
  alSalir?(): void;
}

/** Las decisiones del contexto: las de la estrategia de ahora, cada una con la foto de la partida. */
export const decisionesDe = (juego: SalaDeJuego, estrategia: () => EstrategiaNarrador): Pick<ContextoEtapa, 'decidir' | 'siONo'> => ({
  decidir: (decision) => estrategia().elegir(decision, fotoPartida(juego)),
  siONo: (pregunta) => estrategia().siONo(pregunta, fotoPartida(juego)),
});
