import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer con las fases (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_FASE = ['fase:noche', 'fase:amanecer', 'fase:volverAtras', 'fase:limpiarGrimorio'] as const;
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
    return partida.fases.anterior() ? null : 'En la preparación no hay a dónde volver.';
  },
  'fase:limpiarGrimorio': (_juego, yo) => (yo.rol === 'narrador' ? null : 'Solo un narrador puede limpiar el grimorio.'),
};

/**
 * Los casos de uso del paso de las fases: anochecer, amanecer, volver atrás (la
 * máquina del tiempo) y limpiar el grimorio para empezar otra vez. Las reglas
 * están en la partida (models/partida/Partida y Fases). Si cambia, avisa para que
 * la sala se mande a todos.
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
   * La máquina del tiempo: vuelve a la fase anterior (del día N a la noche N, de la
   * noche N al día anterior o, de la noche 1, a la preparación). Ver Partida.volverAtras.
   */
  volverAtras(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'fase:volverAtras', () => (this.juego.partida.volverAtras() ? null : 'No hay a dónde volver.'));
  }

  /** Borra el registro de votaciones, deja las fichas como al principio y vuelve a la preparación. */
  limpiarGrimorio(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'fase:limpiarGrimorio', () => {
      this.juego.partida.limpiarGrimorio();
      return null;
    });
  }
}
