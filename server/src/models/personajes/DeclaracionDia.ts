import type { ContextoEtapa } from '../narradorVirtual/etapas/Etapa';
import type { Ganador } from '../narradorVirtual/final/comprobarFinal';
import type { Participante } from '../sala/Participantes';
import type { SalaDeJuego } from '../SalaDeJuego';

/**
 * Lo que pasa al hacer una declaración: el error, o lo que se contesta a quien la
 * hace (`valor`) y cómo se cuenta a la plaza (`contar`: acaba en el ganador, si con
 * eso se acaba la partida).
 */
export type ResultadoDeclaracion = { error: string } | { valor?: string; contar?: () => Promise<Ganador | null> };

/**
 * Una declaración del día con narrador virtual: un jugador dice ser un personaje
 * (lo sea o no) y usa su habilidad, en público o preguntando al narrador. Cada
 * personaje que la tiene la trae en su archivo y está en la lista de index.ts: ni
 * el servicio del narrador virtual ni los eventos de la sala saben de ninguno.
 */
export interface DeclaracionDia {
  /** Su nombre: el evento es `declarar:<id>` y así se apunta en Declaraciones. */
  id: string;
  /** El personaje que se dice ser: solo se puede declarar si el guion lo trae. */
  personaje: string;
  /** Se cuenta en voz alta a la plaza: hasta que acaba de contarse, no se hace otra pública. */
  publica: boolean;
  /** Si ese participante puede hacerla ahora (solo lee la sala). */
  puede(juego: SalaDeJuego, yo: Participante): boolean;
  /** Por qué no puede. */
  noPuede(juego: SalaDeJuego, yo: Participante): string;
  /** La hace (ya comprobado que puede): valida los datos, decide qué pasa y cómo se cuenta. */
  declarar(ctx: ContextoEtapa, yo: string, datos: unknown): Promise<ResultadoDeclaracion>;
}

/** Por qué no puede hacerla ahora ese participante (su personaje no está en el guion, o lo que diga ella), o null si puede. */
export function noPuedeDeclarar(declaracion: DeclaracionDia, juego: SalaDeJuego, yo: Participante): string | null {
  if (!juego.partida.guion.trae(declaracion.personaje)) return 'Ese personaje no está en este guion.';
  return declaracion.puede(juego, yo) ? null : declaracion.noPuede(juego, yo);
}

/**
 * El jugador que elige quien declara (datos: { jugadorId }), o el error: tiene que
 * existir y no ser el suyo (`aSiMismo`, lo que se le dice si lo es).
 */
export function otroJugador(juego: SalaDeJuego, yo: string, datos: unknown, aSiMismo: string): { error: string } | { jugadorId: string } {
  const jugadorId = (datos as { jugadorId?: unknown } | null)?.jugadorId;
  if (typeof jugadorId !== 'string' || !juego.sala.jugador(jugadorId)) return { error: 'Ese asiento ya no existe.' };
  if (juego.partida.jugadorDe(yo)?.id === jugadorId) return { error: aSiMismo };
  return { jugadorId };
}
