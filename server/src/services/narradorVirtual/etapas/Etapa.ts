import type { EtapaNarradorVirtual } from '../../../contrato/sala';
import type { SalaService } from '../../SalaService';
import type { Decision, EstrategiaNarrador, PreguntaSiONo } from '../estrategias/EstrategiaNarrador';
import { instantaneaGrimorio } from '../grimorio';
import type { RecuerdosNarrador } from '../noche/criterioDroison';
import type { FueraDeLaBolsa } from '../preparacion';
import type { Azar, MesaNarrador, Temporizador } from '../puertos';

/** Lo que piden los jugadores al narrador virtual en el día (ver las acciones `jugador:…`). */
export type AccionJugador = 'nominar' | 'defensa' | 'voto' | 'listo' | 'seguirNominando';

/** Lo que tiene cada etapa a mano para llevar la partida. */
export interface ContextoEtapa {
  /** Para leer cómo está la sala (lo que cambia se hace con `mesa`). */
  readonly sala: SalaService;
  readonly mesa: MesaNarrador;
  /** Lo que decide su estrategia, con el grimorio del momento. */
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
  /** Lo que recuerda de la partida para ser coherente (lo dado droison). */
  readonly recuerdos: RecuerdosNarrador;
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
  /** Al irse el narrador (o pasar a otra etapa): cancela lo que tuviera programado. */
  alSalir?(): void;
}

/** Las decisiones del contexto: las de la estrategia de ahora, cada una con la foto del grimorio. */
export const decisionesDe = (sala: SalaService, estrategia: () => EstrategiaNarrador): Pick<ContextoEtapa, 'decidir' | 'siONo'> => ({
  decidir: (decision) => estrategia().elegir(decision, instantaneaGrimorio(sala)),
  siONo: (pregunta) => estrategia().siONo(pregunta, instantaneaGrimorio(sala)),
});
