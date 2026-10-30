import type { SalaNarradorVirtual } from '../../contrato/sala';
import type { NarradorVirtualRepository } from '../../repositories/NarradorVirtualRepository';
import type { Partida } from '../partida/Partida';
import type { Sala } from '../sala/Sala';

/**
 * El narrador virtual de la sala: su participante es uno más de la sala (ver
 * Participantes.anadirVirtual) y lo que lleva de la partida (su etapa, su frase,
 * quién está listo…) se guarda en el repositorio. Al irse, la palabra y los
 * privados vuelven a ser de todos. No comprueba permisos.
 */
export class NarradorVirtual {
  constructor(
    /** Dónde se guarda lo que lleva el narrador virtual (ver NarradorVirtualService). */
    private readonly repositorio: NarradorVirtualRepository,
    private readonly sala: Sala,
    private readonly partida: Partida,
  ) {}

  /** El narrador virtual de la sala, si lo hay (y su participante sigue en ella). */
  actual(): SalaNarradorVirtual | null {
    const narrador = this.repositorio.actual();
    return narrador && this.sala.participantes.buscar(narrador.participante) ? narrador : null;
  }

  /** Entra un narrador virtual y se guarda quién lo añadió. Devuelve su participante. */
  anadir(datos: Pick<SalaNarradorVirtual, 'id' | 'creador' | 'guion' | 'jugadores'>, nombre: string, avatar: string): string {
    const participante = this.sala.participantes.anadirVirtual(nombre, avatar, datos.id);
    this.repositorio.guardar({
      ...datos,
      participante,
      etapa: 'esperandoJugadores',
      frase: null,
      turno: null,
      listos: [],
      exterminadores: [],
      artistas: [],
      patosos: [],
    });
    return participante;
  }

  /** Cambia lo que lleva de la partida (su etapa, su frase, el día…). */
  actualizar(cambios: Partial<Omit<SalaNarradorVirtual, 'id' | 'participante' | 'creador' | 'guion' | 'jugadores'>>): void {
    this.repositorio.actualizar(cambios);
  }

  /** Otro narrador virtual sigue la partida del que hay (Jarvis deja a «Tonto y tú»): con su id, su nombre y su avatar. */
  relevar(id: SalaNarradorVirtual['id'], nombre: string, avatar: string): void {
    const narrador = this.repositorio.actual();
    if (!narrador) return;
    this.repositorio.guardar({ ...narrador, id });
    this.sala.participantes.relevarVirtual(narrador.participante, nombre, avatar, id);
  }

  /** Se va (su participante sale de la sala): la palabra y los privados vuelven a ser de todos. */
  quitar(): void {
    const narrador = this.repositorio.actual();
    if (narrador) this.sala.participantes.expulsar(narrador.participante);
    this.repositorio.borrar();
    this.partida.nominaciones.darPalabra(null);
    this.partida.configuracion.permitirPrivados(true);
  }
}
