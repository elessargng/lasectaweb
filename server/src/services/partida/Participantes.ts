import { randomUUID } from 'crypto';
import {
  SALA_PARTIDAS_NOVATO,
  type SalaAccesoGrimorio,
  type SalaFormaMano,
  type SalaParticipante,
  type SalaRol,
} from '../../contrato/sala';
import { esAvatarSalaGuardado } from '../../utils/salaAvatarStorage';

/** Margen para volver tras una desconexión (recarga, red caída) sin perder el papel. */
export const SALA_GRACIA_MS = 20_000;

export const SALA_NOMBRE_MAX = 24;

/** Quita espacios de sobra y recorta; cadena vacía si no queda nombre. */
export function limpiarNombreSala(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor.replace(/\s+/g, ' ').trim().slice(0, SALA_NOMBRE_MAX);
}

/**
 * Avatares que cualquiera puede elegir para la sala, además del de su cuenta.
 * Son los predefinidos de la web (client/public); el cliente tiene la misma lista.
 */
export const SALA_AVATARES = [
  '/logo-2.png',
  '/avatar.png',
  '/avatars/wizard.png',
  '/avatars/sorceress.png',
  '/avatars/rogue.png',
  '/avatars/noble.png',
];

/** El que llevan los invitados mientras no elijan otro: el logo de La Secta. */
export const SALA_AVATAR_INVITADO = '/logo-2.png';

/**
 * El avatar elegido si es uno de los permitidos (predefinido, o una imagen
 * propia subida a la sala); si no, null (el por defecto).
 */
export function limpiarAvatarSala(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  return SALA_AVATARES.includes(valor) || esAvatarSalaGuardado(valor) ? valor : null;
}

/** Con cuenta y menos de SALA_PARTIDAS_NOVATO partidas (si no se sabe cuántas, no). */
const esNovato = (llegada: SalaLlegada) => llegada.partidasJugadas !== null && llegada.partidasJugadas < SALA_PARTIDAS_NOVATO;

/** Quién se conecta, según el token o el nombre de invitado. */
export interface SalaLlegada {
  /** Quién es de verdad: `u:<id de usuario>` con cuenta, `invitado` sin ella. */
  identidad: string;
  /** Su nombre de usuario, o el nombre con el que entra el invitado. */
  nombreBase: string;
  /** Nombre que prefiere mostrar en la sala (vacío: el base). */
  alias: string;
  conCuenta: boolean;
  /** El que lleva si no elige otro: el de su cuenta en la web (null si no tiene) o, si es invitado, el logo. */
  avatarPorDefecto: string | null;
  /** El que eligió para la sala (ver `SALA_AVATARES`); null: el por defecto. */
  avatarElegido: string | null;
  /** Con cuenta, las partidas que ha jugado (null si no se sabe, o invitado). */
  partidasJugadas: number | null;
}

interface Entrada {
  participante: SalaParticipante;
  identidad: string;
  nombreBase: string;
  avatarPorDefecto: string | null;
  /** Conexión activa, o null mientras se espera a que vuelva. */
  socketId: string | null;
  expulsion: NodeJS.Timeout | null;
  /**
   * Por lo que se le reconoce si sale y vuelve a entrar (para devolverle el
   * acceso al grimorio): su cuenta o, si es invitado, su navegador.
   */
  recuerdo: string;
}

/**
 * Quién está en la sala: las conexiones, los papeles (narrador, jugador,
 * visitante), el acceso al grimorio y las manos. No sabe de la mesa ni de la
 * partida (eso es de SalaService); por eso no comprueba permisos.
 *
 * Cada navegador trae un id de cliente propio y secreto (la «clave»); así, si se
 * recarga la página o se corta la conexión un momento, vuelve con el mismo papel
 * en lugar de entrar de nuevo como visitante. La clave nunca se manda a los demás:
 * en la lista cada uno tiene otro id, público.
 */
export class Participantes {
  private entradas = new Map<string, Entrada>();
  /** A quién se ha dejado ver el grimorio (por su `recuerdo`), para devolvérselo si sale y vuelve. */
  private conGrimorio = new Set<string>();

  /** El id de usuario de un participante con cuenta, o null (invitado, o ya no está). */
  cuentaDe(participanteId: string | null): string | null {
    if (!participanteId) return null;
    const identidad = [...this.entradas.values()].find((e) => e.participante.id === participanteId)?.identidad;
    return identidad?.startsWith('u:') ? identidad.slice(2) : null;
  }

  /** Los narradores que están en la sala. */
  narradores(): SalaParticipante[] {
    return [...this.entradas.values()].filter((e) => e.participante.rol === 'narrador').map((e) => e.participante);
  }

  /**
   * Otra partida: quien veía el grimorio deja de verlo (y puede volver a sentarse),
   * también quien había salido de la sala.
   */
  olvidarGrimorios(): void {
    for (const { participante } of this.entradas.values()) {
      if (participante.accesoGrimorio === 'concedido') participante.accesoGrimorio = 'ninguno';
    }
    this.conGrimorio.clear();
  }

  /**
   * Alguien se conecta. Devuelve su clave en la sala y, si la tenía otra
   * conexión viva de su misma cuenta, el socket que hay que expulsar.
   *
   * - Con cuenta: es una sola persona. Si ya está en la sala (otra pestaña, otro
   *   dispositivo o una reconexión), la conexión nueva retoma su sitio y su papel.
   * - Invitado: solo retoma su sitio si vuelve con el mismo id de cliente tras
   *   perder la conexión; si no, entra como uno nuevo.
   */
  conectar(
    socketId: string,
    clienteId: string | null,
    llegada: SalaLlegada,
    /** Si una conexión sigue abierta; una entrada con una conexión muerta se puede recuperar. */
    conexionViva: (socketId: string) => boolean,
  ): { clave: string; id: string; expulsar: string | null } {
    const viva = (e: Entrada) => e.socketId !== null && conexionViva(e.socketId);

    if (llegada.conCuenta) {
      const deLaCuenta = [...this.entradas.entries()].find(([, e]) => e.identidad === llegada.identidad);
      if (deLaCuenta) {
        const [clave, entrada] = deLaCuenta;
        const expulsar = viva(entrada) ? entrada.socketId : null;
        this.retomar(entrada, socketId, llegada);
        return { clave, id: entrada.participante.id, expulsar };
      }
    }

    const previa = clienteId ? this.entradas.get(clienteId) : undefined;
    const libre = !!previa && !viva(previa);
    if (previa && libre && previa.identidad === llegada.identidad) {
      this.retomar(previa, socketId, llegada);
      return { clave: clienteId!, id: previa.participante.id, expulsar: null };
    }

    // Entra como uno nuevo. Si su id de cliente lo tiene otra conexión viva
    // (pestaña duplicada de un invitado), con otra clave; si lo ocupaba una
    // entrada sin conexión de otra persona, la sustituye.
    if (previa && libre && previa.expulsion) clearTimeout(previa.expulsion);
    const clave = clienteId && (!previa || libre) ? clienteId : socketId;
    const id = randomUUID();
    const recuerdo = llegada.conCuenta ? llegada.identidad : `cliente:${clave}`;
    this.entradas.set(clave, {
      participante: {
        id,
        nombre: llegada.alias || llegada.nombreBase,
        conCuenta: llegada.conCuenta,
        usuarioId: llegada.identidad.startsWith('u:') ? llegada.identidad.slice(2) : null,
        novato: esNovato(llegada),
        avatar: llegada.avatarElegido ?? llegada.avatarPorDefecto,
        rol: 'visitante',
        conectado: true,
        manoLevantada: false,
        dosManos: false,
        // Si ya lo vio y salió de la sala, lo recupera (vuelve como visitante)
        accesoGrimorio: this.conGrimorio.has(recuerdo) ? 'concedido' : 'ninguno',
        formaMano: 'palma',
        estiloMano: 'defecto',
        sinSonido: false,
      },
      identidad: llegada.identidad,
      nombreBase: llegada.nombreBase,
      avatarPorDefecto: llegada.avatarPorDefecto,
      socketId,
      expulsion: null,
      recuerdo,
    });
    return { clave, id, expulsar: null };
  }

  /** La conexión nueva se queda con la entrada: mismo participante y papel. */
  private retomar(entrada: Entrada, socketId: string, llegada: SalaLlegada): void {
    if (entrada.expulsion) clearTimeout(entrada.expulsion);
    entrada.expulsion = null;
    entrada.socketId = socketId;
    entrada.avatarPorDefecto = llegada.avatarPorDefecto;
    entrada.participante.avatar = llegada.avatarElegido ?? llegada.avatarPorDefecto;
    entrada.participante.nombre = llegada.alias || llegada.nombreBase;
    entrada.participante.novato = esNovato(llegada);
  }

  /** Al terminar una partida: si con las que lleva ahora sigue siendo novato (ver SALA_PARTIDAS_NOVATO). */
  cambiarPartidasJugadas(userId: string, partidas: number): void {
    for (const e of this.entradas.values()) {
      if (e.identidad === `u:${userId}`) e.participante.novato = partidas < SALA_PARTIDAS_NOVATO;
    }
  }

  /** Se va a propósito: sale de la sala sin esperar. */
  salir(clave: string, socketId: string): void {
    const entrada = this.entradas.get(clave);
    if (!entrada || entrada.socketId !== socketId) return;
    this.entradas.delete(clave);
  }

  /**
   * Saca a alguien de la sala (lo expulsa un narrador). Devuelve su conexión
   * activa, si la tiene, para cerrarla.
   */
  expulsar(id: string): string | null {
    const encontrada = [...this.entradas.entries()].find(([, e]) => e.participante.id === id);
    if (!encontrada) return null;
    const [clave, entrada] = encontrada;
    if (entrada.expulsion) clearTimeout(entrada.expulsion);
    this.entradas.delete(clave);
    // Expulsado por un narrador: si vuelve, no recupera el grimorio
    this.conGrimorio.delete(entrada.recuerdo);
    return entrada.socketId;
  }

  /** Se cortó la conexión: se le guarda el sitio un rato y luego `alExpulsar`. */
  desconectar(clave: string, socketId: string, alExpulsar: () => void): void {
    const entrada = this.entradas.get(clave);
    if (!entrada || entrada.socketId !== socketId) return;
    entrada.socketId = null;
    entrada.expulsion = setTimeout(() => {
      this.entradas.delete(clave);
      alExpulsar();
    }, SALA_GRACIA_MS);
  }

  /** El participante de esta conexión, o undefined si ya no está. */
  participanteDe(clave: string): SalaParticipante | undefined {
    return this.entradas.get(clave)?.participante;
  }

  /** Un participante por su id público. */
  buscar(id: string): SalaParticipante | undefined {
    return [...this.entradas.values()].find((e) => e.participante.id === id)?.participante;
  }

  /** Su nombre de usuario (o de entrada, si es invitado), sin alias. */
  nombreBase(id: string): string | undefined {
    return [...this.entradas.values()].find((e) => e.participante.id === id)?.nombreBase;
  }

  /** Si otro participante ya se muestra con ese nombre (sin distinguir mayúsculas). */
  nombreOcupado(nombre: string, salvoId: string): boolean {
    const buscado = nombre.toLocaleLowerCase('es');
    return [...this.entradas.values()].some(
      (e) => e.participante.id !== salvoId && e.participante.nombre.toLocaleLowerCase('es') === buscado,
    );
  }

  /**
   * Si un invitado puede entrar con ese nombre: no, si ya lo usa otro. Si vuelve
   * a su propia entrada (mismo id de cliente) tras perder la conexión, siempre.
   */
  nombreLibreParaInvitado(nombre: string, clienteId: string | null, conexionViva: (socketId: string) => boolean): boolean {
    const propia = clienteId ? this.entradas.get(clienteId) : undefined;
    const vuelve =
      propia?.identidad === 'invitado' && (propia.socketId === null || !conexionViva(propia.socketId));
    if (vuelve) return true;
    const buscado = nombre.toLocaleLowerCase('es');
    return ![...this.entradas.values()].some((e) => e.participante.nombre.toLocaleLowerCase('es') === buscado);
  }

  /** `elegido` null: vuelve al por defecto (el de su cuenta, o el logo si es invitado). */
  cambiarAvatar(id: string, elegido: string | null): void {
    const entrada = [...this.entradas.values()].find((e) => e.participante.id === id);
    if (entrada) entrada.participante.avatar = elegido ?? entrada.avatarPorDefecto;
  }

  renombrar(id: string, nombre: string): void {
    const participante = this.buscar(id);
    if (participante) participante.nombre = nombre;
  }

  hayNarrador(): boolean {
    return [...this.entradas.values()].some((e) => e.participante.rol === 'narrador');
  }

  /**
   * Cambia el papel de alguien. No comprueba permisos: eso lo hace quien lo pide
   * (ver `salaAcciones`).
   */
  cambiarRol(id: string, rol: SalaRol): void {
    const participante = this.buscar(id);
    if (!participante) return;
    // El acceso al grimorio es de los visitantes: al cambiar de papel se pierde (y se vuelve a pedir).
    if (participante.rol !== rol && participante.accesoGrimorio !== 'ninguno') this.cambiarAccesoGrimorio(id, 'ninguno');
    const cambia = participante.rol !== rol;
    participante.rol = rol;
    // La mano es de jugadores y narradores, y de su papel: quien cambia de papel la baja.
    if (cambia || rol === 'visitante') {
      participante.manoLevantada = false;
      participante.dosManos = false;
    }
  }

  /**
   * Cambia el acceso de un participante al grimorio del narrador. Concedido, se
   * recuerda aunque salga de la sala. No comprueba permisos.
   */
  cambiarAccesoGrimorio(id: string, acceso: SalaAccesoGrimorio): void {
    const entrada = [...this.entradas.values()].find((e) => e.participante.id === id);
    if (!entrada) return;
    entrada.participante.accesoGrimorio = acceso;
    if (acceso === 'concedido') this.conGrimorio.add(entrada.recuerdo);
    else this.conGrimorio.delete(entrada.recuerdo);
  }

  /** Quita o pone el sonido de un participante (si oye a los demás). */
  cambiarSonido(id: string, sinSonido: boolean): void {
    const participante = this.buscar(id);
    if (participante) participante.sinSonido = sinSonido;
  }

  /** Levanta (una o, con `dos`, las dos) o baja la mano de un jugador. No comprueba permisos. */
  levantarMano(id: string, levantada: boolean, dos = false): void {
    const participante = this.buscar(id);
    if (!participante) return;
    participante.manoLevantada = levantada;
    participante.dosManos = levantada && dos;
  }

  /** Baja la mano de todos (al empezar una nominación o reiniciar su votación). */
  bajarManos(): void {
    for (const { participante } of this.entradas.values()) {
      participante.manoLevantada = false;
      participante.dosManos = false;
    }
  }

  elegirFormaMano(id: string, forma: SalaFormaMano): void {
    const participante = this.buscar(id);
    if (participante) participante.formaMano = forma;
  }

  /** Cómo se ve su mano para todos (su «skin»). No comprueba que el estilo exista. */
  elegirEstiloMano(id: string, estilo: string): void {
    const participante = this.buscar(id);
    if (participante) participante.estiloMano = estilo;
  }

  /** Los que siguen en la sala, también los que esperan reconexión, por orden de llegada. */
  participantes(): SalaParticipante[] {
    return [...this.entradas.values()].map((e) => ({ ...e.participante, conectado: e.socketId !== null }));
  }

  /** Conexiones activas con la clave y el id de participante de cada una. */
  conexiones(): { socketId: string; clave: string; id: string }[] {
    return [...this.entradas.entries()]
      .filter(([, e]) => e.socketId !== null)
      .map(([clave, e]) => ({ socketId: e.socketId!, clave, id: e.participante.id }));
  }
}
