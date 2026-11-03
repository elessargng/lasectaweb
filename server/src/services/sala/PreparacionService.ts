import type { CambiosAjustes } from '../../models/partida/Configuracion';
import { NPC_BOOTLEGGER, NPC_SILENCIO, NPC_STORMCATCHER } from '../../models/partida/personajesEspeciales';
import { GuionInvalidoError } from '../../models/guiones/errores';
import { leerDataUrl } from '../../models/imagenes';
import { FONDO_SALA } from '../../models/sala/imagenes';
import type { Participante } from '../../models/sala/Participantes';
import type { SalaDeJuego } from '../../models/SalaDeJuego';
import type { ImagenesSala } from './ImagenesSala';
import type { ImagenesBiblioteca, ServicioGuiones } from './puertos';
import { UsosSala, type Permiso, type ResultadoUso } from './UsosSala';

/** Lo que se puede hacer al preparar la partida (son también los nombres que recibe el cliente para pintar sus botones). */
export const USOS_PREPARACION = [
  'preparacion:configurar',
  'preparacion:privados',
  'preparacion:guion',
  'preparacion:fondo',
  'preparacion:npc',
  'preparacion:bootlegger',
  'preparacion:stormcatcher',
  'preparacion:silencio',
  'preparacion:asignarPersonajes',
  'preparacion:entregarFichas',
] as const;
type UsoPreparacion = (typeof USOS_PREPARACION)[number];

/** El fondo de la sala que se pide: el de por defecto, una imagen subida (data URL) o una pública de la Biblioteca. */
export type PeticionFondo = { predeterminado: true } | { imagen: unknown } | { biblioteca: string };

/** Lo que usa la preparación de fuera: los guiones y las imágenes. */
export interface DependenciasPreparacion {
  guiones: ServicioGuiones;
  /** Las imágenes de la Biblioteca (para elegir un fondo de la sala). */
  imagenesBiblioteca: ImagenesBiblioteca;
  imagenes: ImagenesSala;
}

/** Solo un narrador (si no, `noPuede`). */
const soloNarrador =
  (noPuede: string): Permiso =>
  (_juego, yo) =>
    yo.rol === 'narrador' ? null : noPuede;

/** Un narrador, con un guion elegido (si no es narrador, `noPuede`). */
const conGuion =
  (noPuede: string): Permiso =>
  ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return noPuede;
    return partida.guion.actual() ? null : 'Antes hay que elegir un guion.';
  };

/** Quién puede hacer cada cosa al preparar la partida y, si no, por qué. */
const PERMISOS: Record<UsoPreparacion, Permiso> = {
  'preparacion:configurar': soloNarrador('Solo un narrador puede cambiar los ajustes de la partida.'),
  'preparacion:privados': soloNarrador('Solo un narrador abre o cierra los privados.'),
  'preparacion:guion': soloNarrador('Solo un narrador puede cambiar el guion.'),
  'preparacion:fondo': soloNarrador('Solo un narrador puede cambiar el fondo de la sala.'),
  'preparacion:npc': conGuion('Solo un narrador pone NPCs en juego.'),
  'preparacion:bootlegger': ({ partida }, yo) =>
    yo.rol === 'narrador' && partida.npcs.activo(NPC_BOOTLEGGER) ? null : 'Solo un narrador, con el Bootlegger en juego, escribe sus reglas.',
  'preparacion:stormcatcher': ({ partida }, yo) =>
    yo.rol === 'narrador' && partida.npcs.activo(NPC_STORMCATCHER) ? null : 'Solo un narrador, con el Storm Catcher en juego, nombra su personaje.',
  // Solo con el Bibliotecario del Infierno en juego
  'preparacion:silencio': ({ partida }, yo) => {
    if (yo.rol !== 'narrador') return 'Solo un narrador pide silencio.';
    return partida.npcs.npcs().includes(NPC_SILENCIO) ? null : 'Solo se pide silencio con el Bibliotecario del Infierno en juego.';
  },
  // Solo en la preparación
  'preparacion:asignarPersonajes': (juego, yo) => {
    const noPuede = conGuion('Solo un narrador puede repartir los personajes.')(juego, yo);
    if (noPuede) return noPuede;
    return juego.partida.fases.actual().momento === 'preparacion' ? null : 'Los personajes solo se asignan en la preparación.';
  },
  'preparacion:entregarFichas': ({ partida }, yo) =>
    yo.rol === 'narrador' && partida.entregas.fichasRetenidas() ? null : 'No hay personajes por entregar.',
};

/**
 * Los casos de uso de la preparación de la partida: los ajustes, el guion, el fondo,
 * los NPCs (y lo suyo: el Bootlegger, el Storm Catcher, el silencio), los privados
 * y repartir y entregar los personajes (la bolsa: ver BolsaService). Las reglas están
 * en la partida (models/partida/Partida, Configuracion, Npcs). Si cambia, avisa para
 * que la sala se mande a todos.
 */
export class PreparacionService {
  private readonly usos: UsosSala<UsoPreparacion>;

  constructor(
    private readonly juego: SalaDeJuego,
    /** La sala ha cambiado: se manda a todos. */
    alCambiar: () => void,
    private readonly deps: DependenciasPreparacion,
  ) {
    this.usos = new UsosSala(juego, PERMISOS, alCambiar);
  }

  /** El participante de una sesión (su id), o null si ya no está en la sala. */
  quienEs(clave: string): string | null {
    return this.usos.quienEs(clave);
  }

  /** Lo que puede hacer ahora al preparar la partida (para que el cliente pinte sus botones). */
  permitidas(yo: Participante): string[] {
    return this.usos.permitidos(yo, USOS_PREPARACION);
  }

  /** Los ajustes de la partida (Preferencias > Partida). La cuenta atrás no se configura: siempre es de 3 a 0. */
  configurar(yoId: string, cambios: CambiosAjustes): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:configurar', () => this.juego.partida.configurar(cambios));
  }

  /** Abre o cierra las conversaciones privadas (al cerrarlas se terminan). */
  privados(yoId: string, abiertos: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:privados', () => {
      this.juego.partida.configuracion.permitirPrivados(abiertos);
      return null;
    });
  }

  /** Carga un guion en la sala: uno por defecto o uno importado de un JSON (lo interpreta y resuelve GuionService). */
  async guion(yoId: string, peticion: { predeterminado: string } | { json: unknown; archivo?: string }): Promise<ResultadoUso> {
    return this.usos.hacerAsincrono(yoId, 'preparacion:guion', async () => {
      try {
        const guion =
          'predeterminado' in peticion
            ? await this.deps.guiones.guionPredeterminado(peticion.predeterminado)
            : await this.deps.guiones.importar(peticion.json, peticion.archivo);
        this.juego.partida.cambiarGuion(guion);
        return null;
      } catch (e) {
        // Un guion inválido trae un mensaje para quien lo carga; cualquier otro fallo, no.
        if (e instanceof GuionInvalidoError) return e.message;
        console.error('[Sala] Error al cargar un guion:', e);
        return 'No se pudo cargar el guion. Inténtalo de nuevo.';
      }
    });
  }

  /**
   * Cambia el fondo de la sala (para todos); contesta (valor) dónde ha quedado. De la
   * Biblioteca solo vale lo público, aunque el narrador tenga cuenta: lo que pide
   * registro no se puede poner a la vista de toda la partida (se copia).
   */
  async fondo(yoId: string, peticion: PeticionFondo): Promise<ResultadoUso> {
    return this.usos.hacerAsincrono(yoId, 'preparacion:fondo', async () => {
      const { configuracion } = this.juego.partida;
      if ('predeterminado' in peticion) {
        configuracion.cambiar({ fondo: null });
        return null;
      }
      let bytes: Buffer;
      if ('imagen' in peticion) {
        const leido = leerDataUrl(peticion.imagen);
        if (!leido) return FONDO_SALA.noValida;
        bytes = leido.datos;
      } else {
        try {
          bytes = await this.deps.imagenesBiblioteca.leerPublica(peticion.biblioteca);
        } catch (e) {
          return e instanceof Error ? e.message : 'No se ha podido leer la imagen.';
        }
      }
      const guardado = this.deps.imagenes.guardarFondo(bytes);
      if ('error' in guardado) return guardado.error;
      configuracion.cambiar({ fondo: guardado.ruta });
      return { valor: guardado.ruta };
    });
  }

  /** Pone en juego un NPC (un legendario o un lórico), o lo quita si ya estaba. Lo ven todos. */
  npc(yoId: string, personajeId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:npc', () => this.juego.partida.alternarNpc(personajeId));
  }

  /** Las reglas del Bootlegger (una por elemento); null vuelve a las del guion. */
  bootlegger(yoId: string, reglas: readonly string[] | null): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:bootlegger', () => {
      this.juego.partida.npcs.escribirBootlegger(reglas);
      return null;
    });
  }

  /** El personaje bueno que nombra el Storm Catcher, o null. */
  stormcatcher(yoId: string, personajeId: string | null): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:stormcatcher', () => this.juego.partida.nombrarStormcatcher(personajeId));
  }

  /** Pide silencio a todos (o lo levanta): los jugadores no pueden emitir su micrófono. */
  silencio(yoId: string, activo: boolean): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:silencio', () => {
      this.juego.partida.npcs.pedirSilencio(activo);
      return null;
    });
  }

  /** Reparte al azar los personajes de la bolsa entre los asientos que no llevan viajero. */
  asignarPersonajes(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:asignarPersonajes', () => this.juego.partida.repartirPersonajes());
  }

  /** Con el Gardener: entrega a los jugadores los personajes ya repartidos (como estén ahora en las fichas). */
  entregarFichas(yoId: string): ResultadoUso {
    return this.usos.hacer(yoId, 'preparacion:entregarFichas', () => {
      this.juego.partida.entregas.entregarFichas();
      return null;
    });
  }
}
