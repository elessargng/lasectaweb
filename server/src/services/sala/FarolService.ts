import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer con los faroles (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_FAROLES = ['faroles:preparar', 'faroles:poner', 'faroles:usar', 'faroles:copiar'] as const;
type UsoFaroles = (typeof USOS_FAROLES)[number];

/** Un jugador sentado, con un guion elegido (si no, `noPuede`). */
const sentado =
  (noPuede: string): Permiso =>
  ({ partida }, yo) =>
    yo.rol === 'jugador' && partida.jugadorDe(yo.id) && partida.guion.actual() ? null : noPuede;

/** Quién puede hacer cada cosa con los faroles y, si no, por qué. */
const PERMISOS: Record<UsoFaroles, Permiso> = {
  'faroles:preparar': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador prepara los faroles.';
    return partida.guion.actual() ? null : 'Antes hay que elegir un guion.';
  },
  'faroles:poner': sentado('Solo un jugador sentado se pone faroles.'),
  'faroles:usar': sentado('Solo un jugador sentado usa faroles.'),
  'faroles:copiar': ({ partida }, yo) =>
    yo.rol === 'jugador' && partida.despertares.asientoDespiertoDe(yo.id) ? null : 'No tienes ningún despertar abierto.',
};

/**
 * Los casos de uso de los faroles: los que el narrador prepara para el demonio y
 * los que se pone cada jugador. Las reglas están en models/partida/Faroles (y en la
 * partida, copiar los que ha enseñado el narrador). Si cambia, avisa para que la
 * sala se mande a todos.
 */
export class FarolService {
  private readonly usos: UsosSala<UsoFaroles>;

  constructor(
    private readonly juego: SalaDeJuego,
    /** La sala ha cambiado: se manda a todos. */
    alCambiar: () => void,
  ) {
    this.usos = new UsosSala(juego, PERMISOS, alCambiar);
  }

  /** El participante de una sesión (su id), o null si ya no está en la sala. */
  quienEs(clave: string): string | null {
    return this.usos.quienEs(clave);
  }

  /** Lo que puede hacer ahora con los faroles (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_FAROLES);
  }

  /** El narrador pone un personaje del guion en una casilla de los faroles del demonio (null: la vacía). */
  preparar(yoId: string, posicion: number, personajeId: string | null): ResultadoUso {
    return this.usos.hacer(yoId, 'faroles:preparar', () => this.juego.partida.faroles.ponerFarol(posicion, personajeId));
  }

  /** Un jugador se pone (o se quita) un farol en una de sus casillas, tenga grimorio o no. */
  poner(yoId: string, posicion: number, personajeId: string | null): ResultadoUso {
    return this.usos.hacer(yoId, 'faroles:poner', () =>
      this.enSuAsiento(yoId, (jugadorId) => this.juego.partida.faroles.ponerFarolAsiento(jugadorId, posicion, personajeId)),
    );
  }

  /** Un jugador dice cuál de sus faroles está usando (o ninguno), para que lo sepa el narrador. */
  usar(yoId: string, personajeId: string | null): ResultadoUso {
    return this.usos.hacer(yoId, 'faroles:usar', () =>
      this.enSuAsiento(yoId, (jugadorId) => this.juego.partida.faroles.usarFarol(jugadorId, personajeId)),
    );
  }

  /** El jugador despierto copia en sus faroles los personajes que el narrador le ha enseñado. */
  copiar(yoId: string, personajes: readonly string[]): ResultadoUso {
    return this.usos.hacer(yoId, 'faroles:copiar', () => this.juego.partida.copiarFaroles(yoId, personajes));
  }

  /** Con el asiento en el que se sienta. */
  private enSuAsiento(yoId: string, hacer: (jugadorId: string) => string | null): string | null {
    const jugador = this.juego.partida.jugadorDe(yoId);
    return jugador ? hacer(jugador.id) : 'Ya no estás sentado.';
  }
}
