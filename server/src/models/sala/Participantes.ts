import { randomUUID } from 'crypto';
import { type IdNarradorVirtual } from '../compartido/narradorVirtual';
import { SALA_ESTILOS_MANO, SALA_PARTIDAS_NOVATO, usuarioDe, type Persona, type FormaMano, type Rol } from '../compartido/participante';

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

/** Quién se conecta, según el token o el nombre de invitado. */
export interface SalaLlegada {
  /** Con la que entra (null: invitado), con las partidas que ha jugado (null si no se sabe). */
  cuenta: { usuarioId: string; partidasJugadas: number | null } | null;
  /** Su nombre de usuario, o el nombre con el que entra el invitado. */
  nombreBase: string;
  /** Nombre que prefiere mostrar en la sala (vacío: el base). */
  alias: string;
  /** El que lleva si no elige otro: el de su cuenta en la web (null si no tiene) o, si es invitado, el logo. */
  avatarPorDefecto: string | null;
  /** El que eligió para la sala (ver `SALA_AVATARES`); null: el por defecto. */
  avatarElegido: string | null;
}

/** Con menos de SALA_PARTIDAS_NOVATO partidas (si no se sabe cuántas, no). */
const esNovato = (partidas: number | null) => partidas !== null && partidas < SALA_PARTIDAS_NOVATO;

/** Quién es el que llega: un usuario con su cuenta o un invitado. */
const personaDe = ({ cuenta }: SalaLlegada): Persona =>
  cuenta ? { tipo: 'usuario', usuarioId: cuenta.usuarioId, novato: esNovato(cuenta.partidasJugadas) } : { tipo: 'invitado' };

/** Si el que llega es la persona de una entrada: el mismo usuario, o los dos invitados. */
const esLaMisma = (persona: Persona, llegada: SalaLlegada) =>
  llegada.cuenta ? usuarioDe(persona) === llegada.cuenta.usuarioId : persona.tipo === 'invitado';

/**
 * Un participante, como lo lleva la sala. Su acceso al grimorio no está aquí: es
 * de la partida (ver AccesoGrimorio).
 */
export interface Participante {
  /** Identificador dentro de la sala (no es el id de usuario de la web). */
  id: string;
  nombre: string;
  persona: Persona;
  /** Ruta del avatar que lleva (el de su cuenta, el elegido para la sala o el logo), o null. */
  avatar: string | null;
  rol: Rol;
  /** false mientras se espera a que vuelva tras perder la conexión. */
  conectado: boolean;
  /** Jugador con la mano levantada. Al dejar de ser jugador, vuelve a false. */
  manoLevantada: boolean;
  /** Con la mano levantada, levanta las dos (la Banshee): su voto cuenta doble. Siempre false con la mano bajada. */
  dosManos: boolean;
  /** La forma de su mano al levantarla; se conserva aunque la baje. */
  formaMano: FormaMano;
  /** Cómo se ve su mano (su «skin», ver SALA_ESTILOS_MANO): la elige cada uno. */
  estiloMano: string;
  /** Ha quitado el sonido: no oye a los demás. */
  sinSonido: boolean;
}

/** Un participante ha cambiado de papel. */
export type OyenteRol = (participanteId: string) => void;
/** Un narrador ha sacado a alguien de la sala (con su recuerdo, ver recuerdoDe). */
export type OyenteExpulsion = (participanteId: string, recuerdo: string) => void;

interface Entrada {
  participante: Participante;
  nombreBase: string;
  avatarPorDefecto: string | null;
  /** Conexión activa, o null mientras se espera a que vuelva. */
  socketId: string | null;
  expulsion: NodeJS.Timeout | null;
  /** Por lo que se le reconoce si sale y vuelve a entrar (ver recuerdoDe). */
  recuerdo: string;
}

/** Un narrador virtual no tiene conexión, pero está siempre (no se desconecta). */
const esVirtual = (e: Entrada) => e.participante.persona.tipo === 'virtual';

/**
 * Quién está en la sala: las conexiones, los papeles (narrador, jugador,
 * visitante) y las manos. No sabe de la plaza ni de la partida; por eso no
 * comprueba permisos.
 *
 * Cada navegador trae un id de cliente propio y secreto (la «clave»); así, si se
 * recarga la página o se corta la conexión un momento, vuelve con el mismo papel
 * en lugar de entrar de nuevo como visitante. La clave nunca se manda a los demás:
 * en la lista cada uno tiene otro id, público.
 */
export class Participantes {
  private entradas = new Map<string, Entrada>();
  private oyentesRol: OyenteRol[] = [];
  private oyentesExpulsion: OyenteExpulsion[] = [];

  /** Se apunta a los cambios de papel. */
  alCambiarRol(oyente: OyenteRol): void {
    this.oyentesRol.push(oyente);
  }

  /** Se apunta a las expulsiones (ver expulsar). */
  alExpulsar(oyente: OyenteExpulsion): void {
    this.oyentesExpulsion.push(oyente);
  }

  /**
   * Por lo que se reconoce a un participante si sale y vuelve a entrar: su cuenta
   * o, si es invitado, su navegador. Es secreto (lleva la clave): no se manda a nadie.
   * null si no está.
   */
  recuerdoDe(participanteId: string): string | null {
    return [...this.entradas.values()].find((e) => e.participante.id === participanteId)?.recuerdo ?? null;
  }

  /** El id de usuario de un participante con cuenta, o null (invitado, o ya no está). */
  cuentaDe(participanteId: string | null): string | null {
    const persona = participanteId ? this.buscar(participanteId)?.persona : undefined;
    return persona ? usuarioDe(persona) : null;
  }

  /** Los narradores que están en la sala. */
  narradores(): Participante[] {
    return [...this.entradas.values()].filter((e) => e.participante.rol === 'narrador').map((e) => e.participante);
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

    if (llegada.cuenta) {
      const deLaCuenta = [...this.entradas.entries()].find(([, e]) => esLaMisma(e.participante.persona, llegada));
      if (deLaCuenta) {
        const [clave, entrada] = deLaCuenta;
        const expulsar = viva(entrada) ? entrada.socketId : null;
        this.retomar(entrada, socketId, llegada);
        return { clave, id: entrada.participante.id, expulsar };
      }
    }

    const previa = clienteId ? this.entradas.get(clienteId) : undefined;
    const libre = !!previa && !viva(previa);
    if (previa && libre && esLaMisma(previa.participante.persona, llegada)) {
      this.retomar(previa, socketId, llegada);
      return { clave: clienteId!, id: previa.participante.id, expulsar: null };
    }

    // Entra como uno nuevo. Si su id de cliente lo tiene otra conexión viva
    // (pestaña duplicada de un invitado), con otra clave; si lo ocupaba una
    // entrada sin conexión de otra persona, la sustituye.
    if (previa && libre && previa.expulsion) clearTimeout(previa.expulsion);
    const clave = clienteId && (!previa || libre) ? clienteId : socketId;
    const id = randomUUID();
    const recuerdo = llegada.cuenta ? `u:${llegada.cuenta.usuarioId}` : `cliente:${clave}`;
    this.entradas.set(clave, {
      participante: {
        id,
        nombre: llegada.alias || llegada.nombreBase,
        persona: personaDe(llegada),
        avatar: llegada.avatarElegido ?? llegada.avatarPorDefecto,
        rol: 'visitante',
        conectado: true,
        manoLevantada: false,
        dosManos: false,
        formaMano: 'palma',
        estiloMano: 'defecto',
        sinSonido: false,
      },
      nombreBase: llegada.nombreBase,
      avatarPorDefecto: llegada.avatarPorDefecto,
      socketId,
      expulsion: null,
      recuerdo,
    });
    return { clave, id, expulsar: null };
  }

  /**
   * Entra un narrador virtual: un participante narrador sin conexión (no es una
   * persona, no se desconecta). Sale con `expulsar`. Devuelve su id.
   */
  anadirVirtual(nombre: string, avatar: string, virtual: IdNarradorVirtual): string {
    const id = randomUUID();
    const clave = `virtual:${id}`;
    this.entradas.set(clave, {
      participante: {
        id,
        nombre,
        persona: { tipo: 'virtual', narrador: virtual },
        avatar,
        rol: 'narrador',
        conectado: true,
        manoLevantada: false,
        dosManos: false,
        formaMano: 'palma',
        estiloMano: 'defecto',
        sinSonido: false,
      },
      nombreBase: nombre,
      avatarPorDefecto: avatar,
      socketId: null,
      expulsion: null,
      recuerdo: clave,
    });
    return id;
  }

  /** Otro narrador virtual toma el relevo del que hay: el mismo participante, con su nombre y su avatar. */
  relevarVirtual(participanteId: string, nombre: string, avatar: string, virtual: IdNarradorVirtual): void {
    for (const entrada of this.entradas.values()) {
      if (!esVirtual(entrada) || entrada.participante.id !== participanteId) continue;
      entrada.participante.nombre = nombre;
      entrada.participante.avatar = avatar;
      entrada.avatarPorDefecto = avatar;
      entrada.participante.persona = { tipo: 'virtual', narrador: virtual };
      entrada.nombreBase = nombre;
    }
  }

  /** La conexión nueva se queda con la entrada: mismo participante y papel. */
  private retomar(entrada: Entrada, socketId: string, llegada: SalaLlegada): void {
    if (entrada.expulsion) clearTimeout(entrada.expulsion);
    entrada.expulsion = null;
    entrada.socketId = socketId;
    entrada.avatarPorDefecto = llegada.avatarPorDefecto;
    entrada.participante.avatar = llegada.avatarElegido ?? llegada.avatarPorDefecto;
    entrada.participante.nombre = llegada.alias || llegada.nombreBase;
    entrada.participante.persona = personaDe(llegada);
  }

  /** Al terminar una partida: si con las que lleva ahora sigue siendo novato (ver SALA_PARTIDAS_NOVATO). */
  cambiarPartidasJugadas(userId: string, partidas: number): void {
    for (const e of this.entradas.values()) {
      const { persona } = e.participante;
      if (persona.tipo === 'usuario' && persona.usuarioId === userId) persona.novato = esNovato(partidas);
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
    for (const oyente of this.oyentesExpulsion) oyente(id, entrada.recuerdo);
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
  participanteDe(clave: string): Participante | undefined {
    return this.entradas.get(clave)?.participante;
  }

  /** Un participante por su id público. */
  buscar(id: string): Participante | undefined {
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
      propia?.participante.persona.tipo === 'invitado' && (propia.socketId === null || !conexionViva(propia.socketId));
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
   * (ver los servicios de services/sala).
   */
  cambiarRol(id: string, rol: Rol): void {
    const participante = this.buscar(id);
    if (!participante) return;
    const cambia = participante.rol !== rol;
    participante.rol = rol;
    if (cambia) for (const oyente of this.oyentesRol) oyente(id);
    // La mano es de jugadores y narradores, y de su papel: quien cambia de papel la baja.
    if (cambia || rol === 'visitante') {
      participante.manoLevantada = false;
      participante.dosManos = false;
    }
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

  elegirFormaMano(id: string, forma: FormaMano): void {
    const participante = this.buscar(id);
    if (participante) participante.formaMano = forma;
  }

  /** Cómo se ve su mano para todos (su «skin»): uno de SALA_ESTILOS_MANO. Devuelve el error, si lo hay. */
  elegirEstiloMano(id: string, estilo: string): string | null {
    if (!SALA_ESTILOS_MANO.includes(estilo)) return 'Estilo de mano desconocido.';
    const participante = this.buscar(id);
    if (participante) participante.estiloMano = estilo;
    return null;
  }

  /**
   * Cambia el nombre con el que se le ve (limpio: ver limpiarNombreSala). Vacío, vuelve
   * al de su cuenta (los invitados no tienen). Nadie más puede llevarlo. Devuelve el error, si lo hay.
   */
  elegirNombre(id: string, pedido: string): string | null {
    const participante = this.buscar(id);
    if (!participante) return 'No estás en la sala.';
    const nombre = limpiarNombreSala(pedido) || (participante.persona.tipo === 'usuario' ? (this.nombreBase(id) ?? '') : '');
    if (!nombre) return 'Escribe un nombre.';
    if (this.nombreOcupado(nombre, id)) return `Ya hay alguien llamado ${nombre} en la sala.`;
    this.renombrar(id, nombre);
    return null;
  }

  /** Hace narrador a alguien de la sala que no lo es. Devuelve el error, si lo hay. */
  nombrarNarrador(id: string): string | null {
    const elegido = this.buscar(id);
    if (!elegido) return 'Esa persona ya no está en la sala.';
    if (elegido.rol === 'narrador') return `${elegido.nombre} ya es narrador.`;
    this.cambiarRol(elegido.id, 'narrador');
    return null;
  }

  /** Un narrador quita el papel a otro (pasa a visitante; uno mismo, no: eso es dejarlo). Devuelve el error, si lo hay. */
  quitarNarrador(yoId: string, id: string): string | null {
    const elegido = this.buscar(id);
    if (!elegido) return 'Esa persona ya no está en la sala.';
    if (elegido.id === yoId) return 'Para dejar de narrar, usa «Dejar de ser narrador».';
    if (elegido.rol !== 'narrador') return `${elegido.nombre} ya no es narrador.`;
    this.cambiarRol(elegido.id, 'visitante');
    return null;
  }

  /**
   * Un narrador saca de la sala a un jugador o visitante (a otro narrador, no: se le
   * quita el papel). La conexión que tenga, para cerrarla; o el error.
   */
  expulsarDeLaSala(id: string): { error: string } | { conexion: string | null } {
    const elegido = this.buscar(id);
    if (!elegido) return { error: 'Esa persona ya no está en la sala.' };
    if (elegido.rol === 'narrador') return { error: 'Para quitar a un narrador, usa «Expulsar narrador».' };
    return { conexion: this.expulsar(elegido.id) };
  }

  /** Los que siguen en la sala, también los que esperan reconexión, por orden de llegada. */
  participantes(): Participante[] {
    return [...this.entradas.values()].map((e) => ({ ...e.participante, conectado: e.socketId !== null || esVirtual(e) }));
  }

  /** Conexiones activas con la clave y el id de participante de cada una. */
  conexiones(): { socketId: string; clave: string; id: string }[] {
    return [...this.entradas.entries()]
      .filter(([, e]) => e.socketId !== null)
      .map(([clave, e]) => ({ socketId: e.socketId!, clave, id: e.participante.id }));
  }
}
