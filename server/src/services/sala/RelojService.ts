import type { RelojSala } from '../../models/partida/RelojSala';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer con el gong y el reloj (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_RELOJ = ['reloj:sonarGong', 'reloj:poner', 'reloj:terminar', 'reloj:quitar'] as const;
type UsoReloj = (typeof USOS_RELOJ)[number];

/** Solo un narrador (si no, `noPuede`) y, si se pide, con un reloj que terminar o quitar. */
const delNarrador =
  (noPuede: string, hayReloj?: (reloj: RelojSala) => boolean): Permiso =>
  ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return noPuede;
    return !hayReloj || hayReloj(partida.reloj) ? null : 'No hay ningún reloj en marcha.';
  };

/** Quién puede hacer cada cosa con el gong y el reloj y, si no, por qué. */
const PERMISOS: Record<UsoReloj, Permiso> = {
  'reloj:sonarGong': delNarrador('Solo un narrador puede sonar el gong.'),
  'reloj:poner': delNarrador('Solo un narrador puede poner el reloj.'),
  'reloj:terminar': delNarrador('Solo un narrador puede terminar el reloj.', (reloj) => reloj.relojEnMarcha()),
  'reloj:quitar': delNarrador('Solo un narrador puede quitar el reloj.', (reloj) => !!reloj.reloj()),
};

/**
 * Los casos de uso del tiempo que marca el narrador: el gong y el reloj de la
 * partida (models/partida/RelojSala, donde están las reglas). Si cambia, avisa
 * para que la sala se mande a todos.
 */
export class RelojService {
  private readonly usos: UsosSala<UsoReloj>;

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

  /** Lo que puede hacer ahora con el gong y el reloj (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_RELOJ);
  }

  /** Suena el gong: todos oyen y ven el aviso de volver a la plaza. */
  sonarGong(yoId: string): ResultadoUso {
    return this.hacer(yoId, 'reloj:sonarGong', (reloj) => reloj.sonarGong());
  }

  /** Pone el reloj: una cuenta atrás para todos con un mensaje; al acabar suena el gong. Sustituye al que hubiera. */
  poner(yoId: string, segundos: number, mensaje: string): ResultadoUso {
    return this.hacer(yoId, 'reloj:poner', (reloj) => reloj.ponerReloj(segundos, mensaje));
  }

  /** Acaba el reloj antes de tiempo: suena el gong para todos, como si se hubiera agotado. */
  terminar(yoId: string): ResultadoUso {
    return this.hacer(yoId, 'reloj:terminar', (reloj) => {
      reloj.terminarReloj();
      return null;
    });
  }

  /** Quita el reloj sin que suene (antes de que acabe, o el «¡Tiempo!» que se queda al acabar). */
  quitar(yoId: string): ResultadoUso {
    return this.hacer(yoId, 'reloj:quitar', (reloj) => {
      reloj.quitarReloj();
      return null;
    });
  }

  /** Con el reloj de la partida. */
  private hacer(yoId: string, uso: UsoReloj, accion: (reloj: RelojSala) => string | null): ResultadoUso {
    return this.usos.hacer(yoId, uso, () => accion(this.juego.partida.reloj));
  }
}
