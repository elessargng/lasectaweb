import { randomInt, randomUUID } from 'crypto';
import {
  SalaAsiento,
  SalaConfiguracion,
  SalaFormaMano,
  SalaNominacion,
  SalaParticipante,
  SalaRegistroVotacion,
  SalaRol,
} from '../types/sala';
import { esAvatarSalaGuardado } from '../utils/salaAvatarStorage';

/** Margen para volver tras una desconexión (recarga, red caída) sin perder el papel. */
export const SALA_GRACIA_MS = 20_000;

export const SALA_NOMBRE_MAX = 24;

/** Asientos de la mesa: con cuántos empieza la sala y cuántos puede tener. */
export const SALA_ASIENTOS = { inicial: 7, min: 0, max: 20 };

/** Duración de la cuenta atrás de las nominaciones, en segundos. */
export const SALA_CUENTA_ATRAS = { min: 3, max: 120, defecto: 3 };

/** Lo que tarda la aguja de ficha en ficha al votar, en segundos (de cuarto en cuarto). */
export const SALA_SEGUNDOS_POR_FICHA = { min: 0.25, max: 2, paso: 0.25, defecto: 1 };

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

/** Un asiento recién puesto: libre, con su ficha viva y sin marca. */
const asientoNuevo = (): SalaAsiento => ({
  id: randomUUID(),
  ocupante: null,
  muerto: false,
  marcado: false,
  votosMarca: null,
});

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
  private mesa: SalaAsiento[] = Array.from({ length: SALA_ASIENTOS.inicial }, () => asientoNuevo());

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

  private ajustes: SalaConfiguracion = {
    grimorioJugadores: false,
    segundosCuentaAtras: SALA_CUENTA_ATRAS.defecto,
    segundosPorFicha: SALA_SEGUNDOS_POR_FICHA.defecto,
  };
  private nominacionEnCurso: SalaNominacion | null = null;
  /** Lo siguiente que toca en la nominación: el fin de la cuenta atrás o el próximo paso de la votación. */
  private temporizador: NodeJS.Timeout | null = null;
  private registro: SalaRegistroVotacion[] = [];

  /**
   * Se llama cuando la sala cambia sola, sin que nadie pida nada (la votación
   * avanza con el tiempo): quien la usa manda el estado a todos.
   */
  alCambiarSola: () => void = () => {};

  /** El registro de votaciones, la más reciente primero. */
  votaciones(): SalaRegistroVotacion[] {
    return this.registro.map((v) => ({ ...v, votantes: [...v.votantes] }));
  }

  private pararTemporizador(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  /** «asiento 3 (Bea)» o «asiento 3, libre», como lo verá el narrador en el registro. */
  private describirAsiento(asientoId: string): string {
    const i = this.mesa.findIndex((a) => a.id === asientoId);
    const ocupante = this.mesa[i]?.ocupante;
    const nombre = ocupante ? this.buscar(ocupante)?.nombre : undefined;
    return nombre ? `asiento ${i + 1} (${nombre})` : `asiento ${i + 1}, libre`;
  }

  /**
   * Acaba la cuenta atrás: empieza la votación. La aguja del nominado va al
   * asiento siguiente (en el sentido de las agujas del reloj) y sigue hasta él.
   */
  private empezarVotacion(): void {
    const n = this.nominacion();
    if (!n) return;
    const i = this.mesa.findIndex((a) => a.id === n.hasta);
    const orden = this.mesa.map((_, k) => this.mesa[(i + 1 + k) % this.mesa.length].id);
    n.votacion = { orden, paso: 0, resultados: {}, votos: 0, terminada: false };
    this.nominacionEnCurso = n;
    this.alCambiarSola();
    this.temporizador = setTimeout(() => this.avanzarVotacion(), this.ajustes.segundosPorFicha * 1000);
  }

  /**
   * La aguja llega a la siguiente ficha: vota si quien se sienta ahí tiene la mano
   * levantada (y entonces se le baja).
   */
  private avanzarVotacion(): void {
    const n = this.nominacion();
    const v = n?.votacion;
    if (!n || !v || v.terminada) return;
    const asientoId = v.orden[v.paso];
    const asiento = this.mesa.find((a) => a.id === asientoId);
    const ocupante = asiento?.ocupante ? this.buscar(asiento.ocupante) : undefined;
    const vota = ocupante?.rol === 'jugador' && ocupante.manoLevantada;
    if (vota) {
      v.votos += 1;
      // Voto contado: la mano baja sola.
      ocupante.manoLevantada = false;
    }
    v.resultados[asientoId] = vota ? v.votos : null;
    v.paso += 1;
    if (v.paso >= v.orden.length) {
      v.terminada = true;
      this.temporizador = null;
      this.registro.unshift({
        hora: Date.now(),
        nomina: this.describirAsiento(n.desde),
        nominado: this.describirAsiento(n.hasta),
        votantes: v.orden.filter((id) => v.resultados[id] !== null && v.resultados[id] !== undefined).map((id) => {
          const o = this.mesa.find((a) => a.id === id)?.ocupante;
          return (o && this.buscar(o)?.nombre) || this.describirAsiento(id);
        }),
        votos: v.votos,
      });
    } else {
      this.temporizador = setTimeout(() => this.avanzarVotacion(), this.ajustes.segundosPorFicha * 1000);
    }
    this.nominacionEnCurso = n;
    this.alCambiarSola();
  }

  /** La nominación en curso; se anula sola si alguno de los dos asientos ya no existe. */
  nominacion(): SalaNominacion | null {
    const n = this.nominacionEnCurso;
    const existe = (id: string) => this.mesa.some((a) => a.id === id);
    if (n && (!existe(n.desde) || !existe(n.hasta))) {
      this.nominacionEnCurso = null;
    }
    if (n && !this.nominacionEnCurso) this.pararTemporizador();
    const actual = this.nominacionEnCurso;
    return actual
      ? {
          ...actual,
          votacion: actual.votacion ? { ...actual.votacion, resultados: { ...actual.votacion.resultados } } : null,
        }
      : null;
  }

  /** Empieza una nominación (sustituye a la que hubiera). No comprueba permisos. */
  nominar(desde: string, hasta: string): void {
    this.pararTemporizador();
    this.nominacionEnCurso = { desde, hasta, cuentaAtrasFin: null, votacion: null };
  }

  cerrarNominacion(): void {
    this.pararTemporizador();
    this.nominacionEnCurso = null;
  }

  /** Si la nominación en curso está votando (o ha votado ya). */
  hayVotacion(): boolean {
    return !!this.nominacion()?.votacion;
  }

  /** Arranca (o reinicia) la cuenta atrás de la nominación en curso; al acabar, se vota. */
  iniciarCuentaAtras(ahora: number): void {
    if (!this.nominacionEnCurso) return;
    this.pararTemporizador();
    const segundos = this.ajustes.segundosCuentaAtras;
    this.nominacionEnCurso.cuentaAtrasFin = ahora + segundos * 1000;
    this.temporizador = setTimeout(() => this.empezarVotacion(), segundos * 1000);
  }

  /** Si existe ese asiento. */
  hayAsiento(id: string): boolean {
    return this.mesa.some((a) => a.id === id);
  }

  /** Pone o quita la calavera a la ficha de un asiento. Solo puede llevarla una: ponérsela se la quita a las demás. */
  marcar(asientoId: string, marcado: boolean, votos: number | null = null): void {
    if (marcado) this.desmarcar();
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return;
    asiento.marcado = marcado;
    asiento.votosMarca = marcado ? votos : null;
  }

  /** Quita la calavera a quien la lleve. */
  desmarcar(): void {
    for (const a of this.mesa) {
      a.marcado = false;
      a.votosMarca = null;
    }
  }

  /** Si alguna ficha lleva la calavera. */
  hayMarca(): boolean {
    return this.mesa.some((a) => a.marcado);
  }

  /** Mata o revive la ficha de un asiento; al morir pierde la calavera. No comprueba permisos. */
  cambiarVida(asientoId: string, muerto: boolean): void {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return;
    asiento.muerto = muerto;
    if (muerto) {
      asiento.marcado = false;
      asiento.votosMarca = null;
    }
  }

  configuracion(): SalaConfiguracion {
    return { ...this.ajustes };
  }

  /** Cambia ajustes de la partida. No comprueba permisos. */
  configurar(cambios: Partial<SalaConfiguracion>): void {
    this.ajustes = { ...this.ajustes, ...cambios };
  }

  /** Los asientos, en orden (el primero a las 12, como las agujas del reloj). */
  asientos(): SalaAsiento[] {
    return this.mesaAlDia().map((a) => ({ ...a }));
  }

  /** Añade un asiento al final del círculo. No comprueba el máximo ni permisos. */
  anadirAsiento(): void {
    this.mesa.push(asientoNuevo());
  }

  /** Quita el último asiento del círculo; quien estuviera sentado vuelve a visitante. */
  quitarAsiento(): void {
    const quitado = this.mesa.pop();
    if (quitado?.ocupante) this.cambiarRol(quitado.ocupante, 'visitante');
  }

  /**
   * Reparte al azar a quienes están sentados entre todos los asientos (también
   * los libres). Devuelve cuántos había sentados.
   */
  mezclarAsientos(): number {
    const mesa = this.mesaAlDia();
    const ocupantes = mesa.map((a) => a.ocupante);
    // Fisher-Yates sobre la mesa entera: los huecos libres también se barajan
    for (let i = ocupantes.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [ocupantes[i], ocupantes[j]] = [ocupantes[j], ocupantes[i]];
    }
    mesa.forEach((a, i) => (a.ocupante = ocupantes[i]));
    return ocupantes.filter(Boolean).length;
  }

  /**
   * Pasa a quien está en el asiento `desde` al asiento `hasta`; si ahí había
   * alguien, se intercambian. Devuelve el error, si lo hay.
   */
  moverOcupante(desde: string, hasta: string): string | null {
    const mesa = this.mesaAlDia();
    const origen = mesa.find((a) => a.id === desde);
    const destino = mesa.find((a) => a.id === hasta);
    if (!origen || !destino) return 'Ese asiento ya no existe.';
    if (!origen.ocupante) return 'Ya no hay nadie en ese asiento.';
    [origen.ocupante, destino.ocupante] = [destino.ocupante, origen.ocupante];
    return null;
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
        manoLevantada: false,
        formaMano: 'palma',
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
    participante.rol = rol;
    // La mano solo cuenta en la partida: quien deja de jugar la baja.
    if (rol !== 'jugador') participante.manoLevantada = false;
  }

  /** Levanta o baja la mano de un jugador. No comprueba permisos. */
  levantarMano(id: string, levantada: boolean): void {
    const participante = this.buscar(id);
    if (participante) participante.manoLevantada = levantada;
  }

  elegirFormaMano(id: string, forma: SalaFormaMano): void {
    const participante = this.buscar(id);
    if (participante) participante.formaMano = forma;
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
