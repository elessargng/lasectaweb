import {
  GUIONES_NARRADOR_VIRTUAL,
  JUGADORES_NARRADOR_VIRTUAL,
  NARRADORES_VIRTUALES,
  type EtapaNarradorVirtual,
  type GuionNarradorVirtual,
  type IdNarradorVirtual,
} from '../compartido/narradorVirtual';
import type { TurnoNominacion } from '../compartido/partida';
import type { Partida } from '../partida/Partida';
import type { Sala } from '../sala/Sala';

/** Lo que lleva el narrador virtual de la partida: quién es, por dónde va y lo que recuerda del día. */
export interface EstadoNarradorVirtual {
  id: IdNarradorVirtual;
  /** Su participante (con `rol: 'narrador'` y persona virtual). */
  participante: string;
  /** Quien lo añadió: el único que puede quitarlo. */
  creador: string;
  guion: GuionNarradorVirtual;
  jugadores: number;
  etapa: EtapaNarradorVirtual;
  /** Lo último que ha dicho (se oye con la voz y sale escrito junto a su cuadro). */
  frase: string | null;
  /** En una nominación, quién tiene la palabra (acusación, defensa, votación); null sin nominación. */
  turno: TurnoNominacion | null;
  /** Los jugadores listos para pasar a la noche (quien ya ha nominado lo está siempre). */
  listos: string[];
}

/** Lo que se elige al añadir un narrador virtual. */
export interface OpcionesNarradorVirtual {
  narrador: IdNarradorVirtual;
  guion: GuionNarradorVirtual;
  jugadores: number;
}

/**
 * Lo que se pide al añadir un narrador virtual, si vale: uno que ya se puede elegir
 * (NARRADORES_VIRTUALES), un guion que sabe narrar (GUIONES_NARRADOR_VIRTUAL) y los
 * jugadores que admiten el narrador virtual (JUGADORES_NARRADOR_VIRTUAL) y ese guion.
 * Si no, el error.
 */
export function opcionesNarradorVirtual(pedido: { narrador: string; guion: string; jugadores: number }): { error: string } | OpcionesNarradorVirtual {
  const { narrador, guion, jugadores } = pedido;
  const elegido = NARRADORES_VIRTUALES.find((n) => n.id === narrador && n.disponible);
  if (!elegido) return { error: 'Ese narrador virtual aún no está disponible.' };
  const delGuion = GUIONES_NARRADOR_VIRTUAL.find((g) => g.id === guion);
  if (!delGuion) return { error: 'Ese guion aún no se puede jugar con narrador virtual.' };
  const { min, max } = JUGADORES_NARRADOR_VIRTUAL;
  if (!Number.isInteger(jugadores) || jugadores < min || jugadores > max) return { error: `Tiene que haber de ${min} a ${max} jugadores.` };
  if (jugadores < delGuion.jugadores.min || jugadores > delGuion.jugadores.max) {
    return { error: `${delGuion.nombre} es para ${delGuion.jugadores.min} a ${delGuion.jugadores.max} jugadores.` };
  }
  return { narrador: elegido.id, guion: delGuion.id, jugadores };
}

/**
 * El narrador virtual de la sala: su participante es uno más de la sala (ver
 * Participantes.anadirVirtual) y lo que lleva de la partida (su etapa, su frase,
 * quién está listo…) lo guarda él, en memoria como la sala. Al irse, la palabra y
 * los privados vuelven a ser de todos. No comprueba permisos.
 */
export class NarradorVirtual {
  private estado: EstadoNarradorVirtual | null = null;

  constructor(
    private readonly sala: Sala,
    private readonly partida: Partida,
  ) {}

  /** El narrador virtual de la sala, si lo hay (y su participante sigue en ella): una copia. */
  actual(): EstadoNarradorVirtual | null {
    const narrador = this.estado;
    return narrador && this.sala.participantes.buscar(narrador.participante) ? { ...narrador } : null;
  }

  /** Entra un narrador virtual y se guarda quién lo añadió. Devuelve su participante. */
  anadir(datos: Pick<EstadoNarradorVirtual, 'id' | 'creador' | 'guion' | 'jugadores'>, nombre: string, avatar: string): string {
    const participante = this.sala.participantes.anadirVirtual(nombre, avatar, datos.id);
    this.estado = {
      ...datos,
      participante,
      etapa: 'esperandoJugadores',
      frase: null,
      turno: null,
      listos: [],
    };
    return participante;
  }

  /** Cambia lo que lleva de la partida (su etapa, su frase, el día…); sin narrador, nada. */
  actualizar(cambios: Partial<Omit<EstadoNarradorVirtual, 'id' | 'participante' | 'creador' | 'guion' | 'jugadores'>>): void {
    if (this.estado) this.estado = { ...this.estado, ...cambios };
  }

  /** Otro narrador virtual sigue la partida del que hay (Jarvis deja a «Tonto y tú»): con su id, su nombre y su avatar. */
  relevar(id: EstadoNarradorVirtual['id'], nombre: string, avatar: string): void {
    const narrador = this.estado;
    if (!narrador) return;
    this.estado = { ...narrador, id };
    this.sala.participantes.relevarVirtual(narrador.participante, nombre, avatar, id);
  }

  /** Se va (su participante sale de la sala): la palabra y los privados vuelven a ser de todos. */
  quitar(): void {
    const narrador = this.estado;
    if (narrador) this.sala.participantes.expulsar(narrador.participante);
    this.estado = null;
    this.partida.nominaciones.darPalabra(null);
    this.partida.configuracion.permitirPrivados(true);
  }
}
