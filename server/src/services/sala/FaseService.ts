import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer con las fases (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_FASE = ['fase:noche', 'fase:amanecer', 'fase:volverAtras', 'fase:deshacer', 'fase:limpiarGrimorio'] as const;
type UsoFase = (typeof USOS_FASE)[number];

/** Quién puede hacer cada cosa con las fases y, si no, por qué. */
const PERMISOS: Record<UsoFase, Permiso> = {
  'fase:noche': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede hacer que anochezca.';
    return partida.fases.actual().momento !== 'noche' ? null : 'Ya es de noche.';
  },
  'fase:amanecer': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede hacer que amanezca.';
    return partida.fases.actual().momento === 'noche' ? null : 'Solo amanece de noche.';
  },
  'fase:volverAtras': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede volver atrás.';
    return partida.historia.puedeVolverDeFase() ? null : 'No hay ningún cambio de fase al que volver.';
  },
  'fase:deshacer': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador puede deshacer.';
    return partida.historia.ultimo() ? null : 'No hay nada que deshacer.';
  },
  'fase:limpiarGrimorio': (_juego, yo) => (yo.rol === 'narrador' ? null : 'Solo un narrador puede limpiar el grimorio.'),
};

/**
 * Los casos de uso del paso de las fases: anochecer, amanecer, limpiar el
 * grimorio para empezar otra vez y la máquina del tiempo (deshacer lo último, o
 * volver a antes del último cambio de fase; ver Historia). Las reglas están en la
 * partida (models/partida). Si cambia, avisa para que la sala se mande a todos.
 */
export class FaseService {
  private readonly usos: UsosSala<UsoFase>;

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

  /** Lo que puede hacer ahora con las fases (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_FASE);
  }

  /**
   * Anochece: desde la preparación, la noche 1; desde un día, la noche siguiente.
   * Cierra la nominación y quita la calavera y el récord de votos del día.
   */
  irANoche(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'fase:noche', () => {
      this.juego.partida.irANoche();
      return null;
    });
  }

  /** Amanece: de la noche N al día N. */
  amanecer(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'fase:amanecer', () => {
      this.juego.partida.amanecer();
      return null;
    });
  }

  /**
   * Vuelve a la partida tal como estaba justo antes del último cambio de fase (de la
   * noche 2, al día 1 justo antes de anochecer): lo que se hizo después se deshace.
   */
  volverAtras(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'fase:volverAtras', () => (this.juego.partida.historia.volverDeFase() ? null : 'No hay ningún cambio de fase al que volver.'));
  }

  /** Deshace lo último que se hizo en la partida (lo hiciera quien lo hiciera): contesta (valor) qué se ha deshecho, su caso de uso. */
  deshacer(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'fase:deshacer', () => {
      const paso = this.juego.partida.historia.deshacer();
      return paso ? { valor: paso.uso } : 'No hay nada que deshacer.';
    });
  }

  /** Borra el registro de votaciones, deja las fichas como al principio y vuelve a la preparación. */
  limpiarGrimorio(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'fase:limpiarGrimorio', () => {
      this.juego.partida.limpiarGrimorio();
      return null;
    });
  }
}
