import { randomUUID } from 'crypto';
import { SalaAsiento, SalaParticipante, SalaRol } from '../types/sala';

/** Margen para volver tras una desconexión (recarga, red caída) sin perder el papel. */
export const SALA_GRACIA_MS = 20_000;

export const SALA_NOMBRE_MAX = 24;

/** Asientos de la mesa: con cuántos empieza la sala y cuántos puede tener. */
export const SALA_ASIENTOS = { inicial: 7, min: 0, max: 20 };

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

/** El avatar elegido si es uno de los permitidos; si no, null (el de su cuenta, o ninguno). */
export function limpiarAvatarSala(valor: unknown): string | null {
  return typeof valor === 'string' && SALA_AVATARES.includes(valor) ? valor : null;
}

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
}

interface Entrada {
  participante: SalaParticipante;
  identidad: string;
  nombreBase: string;
  avatarPorDefecto: string | null;
  /** Conexión activa, o null mientras se espera a que vuelva. */
  socketId: string | null;
  expulsion: NodeJS.Timeout | null;
}

/**
 * Estado de la sala de juego, en memoria: quién está y con qué papel. Se pierde
 * al reiniciar el servidor, como una sala que se vacía.
 *
 * Cada navegador trae un id de cliente propio y secreto (la «clave»); así, si se
 * recarga la página o se corta la conexión un momento, vuelve con el mismo papel
 * en lugar de entrar de nuevo como visitante. La clave nunca se manda a los demás:
 * en la lista cada uno tiene otro id, público.
 */
export class SalaService {
  private entradas = new Map<string, Entrada>();
  private mesa: SalaAsiento[] = Array.from({ length: SALA_ASIENTOS.inicial }, () => ({
    id: randomUUID(),
    ocupante: null,
  }));

  /**
   * Un asiento solo está ocupado por alguien que sigue en la sala y es jugador.
   * Se aplica al leer la mesa, así se libera sola cuando el jugador sale, se le
   * acaba la espera de reconexión o cambia de papel.
   */
  private mesaAlDia(): SalaAsiento[] {
    for (const asiento of this.mesa) {
      if (asiento.ocupante && this.buscar(asiento.ocupante)?.rol !== 'jugador') asiento.ocupante = null;
    }
    return this.mesa;
  }

  /** Los asientos, en orden (el primero a las 12, como las agujas del reloj). */
  asientos(): SalaAsiento[] {
    return this.mesaAlDia().map((a) => ({ ...a }));
  }

  /** Añade un asiento al final del círculo. No comprueba el máximo ni permisos. */
  anadirAsiento(): void {
    this.mesa.push({ id: randomUUID(), ocupante: null });
  }

  /** Quita el último asiento del círculo; quien estuviera sentado vuelve a visitante. */
  quitarAsiento(): void {
    const quitado = this.mesa.pop();
    if (quitado?.ocupante) this.cambiarRol(quitado.ocupante, 'visitante');
  }

  /** Sienta a alguien en un asiento libre y pasa a jugador. Devuelve el error, si lo hay. */
  sentar(id: string, asientoId: string): string | null {
    const asiento = this.mesaAlDia().find((a) => a.id === asientoId);
    if (!asiento) return 'Ese asiento ya no existe.';
    if (asiento.ocupante) return 'Ese asiento ya está ocupado.';
    asiento.ocupante = id;
    this.cambiarRol(id, 'jugador');
    return null;
  }

  /** Se levanta de su asiento y vuelve a visitante. */
  levantar(id: string): void {
    for (const asiento of this.mesa) if (asiento.ocupante === id) asiento.ocupante = null;
    this.cambiarRol(id, 'visitante');
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
    this.entradas.set(clave, {
      participante: {
        id,
        nombre: llegada.alias || llegada.nombreBase,
        conCuenta: llegada.conCuenta,
        avatar: llegada.avatarElegido ?? llegada.avatarPorDefecto,
        rol: 'visitante',
        conectado: true,
      },
      identidad: llegada.identidad,
      nombreBase: llegada.nombreBase,
      avatarPorDefecto: llegada.avatarPorDefecto,
      socketId,
      expulsion: null,
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
  }

  /** Se va a propósito: sale de la sala sin esperar. */
  salir(clave: string, socketId: string): void {
    const entrada = this.entradas.get(clave);
    if (!entrada || entrada.socketId !== socketId) return;
    this.entradas.delete(clave);
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
    if (participante) participante.rol = rol;
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
