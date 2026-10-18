import { randomInt, randomUUID } from 'crypto';
import {
  SalaAccesoGrimorio,
  SalaAlineamiento,
  SalaRecordatorio,
  SalaAsiento,
  SalaConfiguracion,
  SalaDistribucion,
  SalaFase,
  MensajeDespertar,
  SalaDespertar,
  SalaFormaMano,
  SalaNominacion,
  SalaParticipante,
  SalaRegistroVotacion,
  SalaRevelacion,
  SalaRol,
  NUM_FAROLES,
  SALA_PARTIDAS_NOVATO,
  RECORDATORIO_TEXTO,
  SalaFichaEnviada,
  SalaGrimorioEnviado,
} from '../types/sala';
import { GuionResuelto, PersonajeDeGuion } from '../types/guiones';
import { repartoPara } from './partida/distribucion';
import { esAvatarSalaGuardado } from '../utils/salaAvatarStorage';
import { SeguimientoPartida, type FotoJugador, type RegistroPartida } from './estadisticas/SeguimientoPartida';

/** Margen para volver tras una desconexión (recarga, red caída) sin perder el papel. */
export const SALA_GRACIA_MS = 20_000;

export const SALA_NOMBRE_MAX = 24;

/** Mensajes que se guardan en cada despertar (los más antiguos se descartan). */
export const SALA_MENSAJES_DESPERTAR_MAX = 300;

/** Asientos de la mesa: con cuántos empieza la sala y cuántos puede tener. */
export const SALA_ASIENTOS = { inicial: 7, min: 0, max: 20 };

/** Duración de la cuenta atrás de las nominaciones, en segundos. */
/**
 * La cuenta atrás de las nominaciones: siempre de 3 a 0, un segundo cada número
 * (4 s, lo que dura su sonido en el cliente).
 */
export const SALA_CUENTA_ATRAS_MS = 4000;

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
  muertePendiente: false,
  votoGastado: false,
  marcado: false,
  votosMarca: null,
  personaje: null,
  alineamiento: null,
  recordatorios: [],
  notas: [],
  faroles: farolesVacios(),
});

/**
 * Un recordatorio «Is The …» (el del Borracho, el Alquimista, el Filósofo, la
 * Marioneta o el Aprendiz): dice quién es de verdad el de esa ficha, aunque
 * lleve otro personaje (el que cree ser, o la habilidad que tiene).
 */
export const esRecordatorioDeIdentidad = (texto: string) => /^is the\b/i.test(texto.trim());
/** Lo mismo con un recordatorio puesto: uno con texto propio nunca lo es (lo escribe el narrador). */
const esIdentidad = (r: SalaRecordatorio) => r.personaje !== RECORDATORIO_TEXTO && esRecordatorioDeIdentidad(r.texto);

/** El NPC con el que el narrador puede pedir silencio a todos: el Bibliotecario del Infierno. */
export const NPC_SILENCIO = 'hellslibrarian';
/** Tor: los jugadores no saben su personaje (lo ven al morir). */
export const NPC_TOR = 'tor';
/** Gardener: el narrador entrega los personajes cuando quiere. */
export const NPC_GARDENER = 'gardener';
/** Bootlegger: el guion tiene reglas propias. */
export const NPC_BOOTLEGGER = 'bootlegger';
/** Pope: puede haber personajes buenos repetidos (en la bolsa). */
export const NPC_POPE = 'pope';
/** Storm Catcher: el narrador nombra un personaje bueno. */
export const NPC_STORMCATCHER = 'stormcatcher';
/** El Barquero: el último día, los muertos recuperan su voto (el narrador lo hace con un botón). */
export const NPC_FERRYMAN = 'ferryman';

/** Las casillas de farol, todas vacías. */
/** Con cuenta y menos de SALA_PARTIDAS_NOVATO partidas (si no se sabe cuántas, no). */
const esNovato = (llegada: SalaLlegada) => llegada.partidasJugadas !== null && llegada.partidasJugadas < SALA_PARTIDAS_NOVATO;

export const farolesVacios = (): (string | null)[] => Array.from({ length: NUM_FAROLES }, () => null);

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
 * Estado de la sala de juego, en memoria: quién está y con qué papel. Se pierde
 * al reiniciar el servidor, como una sala que se vacía.
 *
 * Cada navegador trae un id de cliente propio y secreto (la «clave»); así, si se
 * recarga la página o se corta la conexión un momento, vuelve con el mismo papel
 * en lugar de entrar de nuevo como visitante. La clave nunca se manda a los demás:
 * en la lista cada uno tiene otro id, público.
 */
/** La nominación tal como se guarda: los votos que hacen falta se calculan al pedirla. */
type NominacionInterna = Omit<SalaNominacion, 'votosNecesarios' | 'votosNecesariosPorDefecto'> & {
  /** Los votos que ha fijado el narrador; null: los de por defecto. */
  votosElegidos: number | null;
  /** Su entrada del registro, que se completa al terminar la votación. */
  registro: SalaRegistroVotacion | null;
};

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
    segundosPorFicha: SALA_SEGUNDOS_POR_FICHA.defecto,
    // Por defecto, los privados entre jugadores solo con los vecinos
    mensajes: 'vecinos',
    fondo: null,
  };
  private nominacionEnCurso: NominacionInterna | null = null;
  private revelacionActual: { ganador: SalaAlineamiento; causas: string[]; reveladas: string[] } | null = null;
  /** Hora (ms) del último gong del narrador, o null. */
  private ultimoGong: number | null = null;
  /** A quién se ha dejado ver el grimorio (por su `recuerdo`), para devolvérselo si sale y vuelve. */
  private conGrimorio = new Set<string>();
  /** Los votos de la votación de hoy que más tuvo (de las que llegaron a los necesarios), o null. */
  private maximoDelDia: number | null = null;
  private faseActual: SalaFase = { momento: 'preparacion', numero: 0, reinicios: 0 };
  private guionActual: GuionResuelto | null = null;
  /** Sube cada vez que cambia el guion, para mandarlo solo entonces. */
  private versionGuionActual = 0;

  /** El guion de la sala (ya resuelto por GuionService), o null. */
  guion(): GuionResuelto | null {
    return this.guionActual;
  }

  versionGuion(): number {
    return this.versionGuionActual;
  }

  /**
   * Cambia el guion de la sala. Es otra partida: antes se limpia el grimorio
   * (fichas, bolsa, faroles, registro, fase…, ver limpiarGrimorio). No comprueba permisos.
   */
  cambiarGuion(guion: GuionResuelto): void {
    this.limpiarGrimorio();
    this.guionActual = guion;
    this.versionGuionActual += 1;
    // La bolsa, los faroles y los NPCs eran de los personajes del otro guion. Los
    // legendarios y lóricos que trae el guion, en juego desde el principio
    this.bolsaActual = [];
    this.npcsActuales = this.npcsDelGuion();
    this.reglasBootlegger = null;
    this.rolStormcatcherActual = null;
    this.retenidas = false;
    this.farolesNarrador = farolesVacios();
    this.farolesAsientos.clear();
  }

  /**
   * Los NPCs de la partida: legendarios y lóricos que el narrador pone en juego
   * (ver SalaEstado.npcs). Siguen al limpiar el grimorio: suelen ser los mismos
   * en la partida siguiente con el mismo guion (y los del guion vuelven si se habían quitado).
   */
  private npcsActuales: string[] = [];

  /** Los legendarios y lóricos que trae el guion: en juego desde el principio de cada partida. */
  private npcsDelGuion(): string[] {
    return (this.guionActual?.personajes ?? []).filter((p) => p.tipo === 'fabled' || p.tipo === 'loric').map((p) => p.id);
  }

  /** El reparto dado por bueno a mano (ver SalaEstado.setupAceptado). */
  private setupAceptadoActual: string | null = null;

  setupAceptado(): string | null {
    return this.setupAceptadoActual;
  }

  aceptarSetup(firma: string | null): void {
    this.setupAceptadoActual = firma;
  }

  npcs(): string[] {
    return [...this.npcsActuales];
  }

  /** Pone en juego un NPC, o lo quita si ya estaba. No comprueba que sea del guion. */
  alternarNpc(personajeId: string): void {
    this.npcsActuales = this.npcsActuales.includes(personajeId)
      ? this.npcsActuales.filter((id) => id !== personajeId)
      : [...this.npcsActuales, personajeId];
    // Sin el Gardener ya no hay nada que retener: los personajes se entregan (como estén ahora)
    if (this.retenidas && !this.npcActivo(NPC_GARDENER)) this.entregarFichas();
  }

  npcActivo(id: string): boolean {
    return this.npcsActuales.includes(id);
  }

  /** Las reglas del Bootlegger que ha escrito el narrador; null: las del guion. */
  private reglasBootlegger: string[] | null = null;

  /** Las reglas del Bootlegger: las del narrador, si las ha escrito, o las del guion. */
  bootlegger(): string[] {
    return [...(this.reglasBootlegger ?? this.guionActual?.bootlegger ?? [])];
  }

  /** Cambia las reglas del Bootlegger (null: vuelven las del guion). No las valida. */
  escribirBootlegger(reglas: string[] | null): void {
    this.reglasBootlegger = reglas;
  }

  /** El personaje bueno nombrado con el Storm Catcher, o null. */
  private rolStormcatcherActual: string | null = null;

  rolStormcatcher(): string | null {
    return this.npcActivo(NPC_STORMCATCHER) ? this.rolStormcatcherActual : null;
  }

  nombrarStormcatcher(personajeId: string | null): void {
    this.rolStormcatcherActual = personajeId;
  }

  /**
   * Lo que se entregó a cada asiento (por su id) al repartir la bolsa: su personaje
   * y su alineamiento. Es lo único que ve de su ficha quien se sienta ahí; lo que el
   * narrador cambie después es del grimorio, privado, hasta el próximo reparto.
   */
  private entregadas = new Map<string, { personaje: string | null; alineamiento: SalaAlineamiento | null }>();

  /**
   * Entrega a cada jugador su ficha tal como está ahora: al repartir la bolsa o,
   * con el Gardener, cuando el narrador la entrega (con lo que haya cambiado
   * mientras tanto). No comprueba permisos.
   */
  entregarFichas(): void {
    this.entregadas = new Map(this.mesa.map((a) => [a.id, { personaje: a.personaje, alineamiento: a.alineamiento }]));
    this.retenidas = false;
  }

  /**
   * El narrador le dice a un jugador quién es («Tú eres», de noche): su ficha pasa a
   * ser esa (el personaje, si es uno solo, y el alineamiento, si se le dice). Así
   * es como se entera de un cambio: lo que el narrador cambie en el grimorio no lo ve.
   */
  comunicarFicha(asientoId: string, personajes: string[], alineamiento: SalaAlineamiento | null): void {
    const antes = this.fichaEntregada(asientoId);
    this.entregadas.set(asientoId, {
      personaje: personajes.length === 1 ? personajes[0] : antes.personaje,
      alineamiento: alineamiento ?? antes.alineamiento,
    });
  }

  /** La ficha que se entregó a un asiento en el último reparto (sin reparto, vacía). */
  fichaEntregada(asientoId: string): { personaje: string | null; alineamiento: SalaAlineamiento | null } {
    return this.entregadas.get(asientoId) ?? { personaje: null, alineamiento: null };
  }

  /**
   * Los grimorios enviados (al Espía, a la Viuda), por asiento: el último, y a
   * quién estaba sentado entonces (si se sienta otro, no lo ve).
   */
  private grimoriosEnviados = new Map<string, { ocupante: string; grimorio: SalaGrimorioEnviado }>();

  /** Envía un grimorio (sus fichas y los faroles) a quien se sienta en un asiento. No comprueba permisos ni las fichas. */
  enviarGrimorio(asientoId: string, fichas: SalaFichaEnviada[], faroles: string[] = []): void {
    const ocupante = this.mesa.find((a) => a.id === asientoId)?.ocupante;
    if (ocupante) this.grimoriosEnviados.set(asientoId, { ocupante, grimorio: { hora: Date.now(), fichas, faroles } });
  }

  /** El último grimorio enviado a un participante (si sigue en el asiento al que se envió), o null. */
  grimorioRecibidoPor(participanteId: string): SalaGrimorioEnviado | null {
    const asiento = this.mesa.find((a) => a.ocupante === participanteId);
    const enviado = asiento ? this.grimoriosEnviados.get(asiento.id) : undefined;
    return enviado && enviado.ocupante === participanteId ? enviado.grimorio : null;
  }

  /** Con el Gardener: los personajes repartidos aún no se han entregado a los jugadores. */
  private retenidas = false;

  fichasRetenidas(): boolean {
    return this.retenidas;
  }

  retenerFichas(retenidas: boolean): void {
    this.retenidas = retenidas;
  }

  /**
   * Cuántas fichas de un personaje hay en la bolsa: quita las de más o añade
   * las que falten (al final). Con el Pope puede haber más de una; no lo comprueba.
   */
  ponerEnBolsa(personajeId: string, cantidad: number): void {
    const otros = this.bolsaActual.filter((id) => id !== personajeId);
    const primera = this.bolsaActual.indexOf(personajeId);
    const suyas = Array.from({ length: cantidad }, () => personajeId);
    // Se quedan donde estaba la primera (o al final, si no estaba)
    const donde = primera < 0 ? otros.length : this.bolsaActual.slice(0, primera).filter((id) => id !== personajeId).length;
    this.bolsaActual = [...otros.slice(0, donde), ...suyas, ...otros.slice(donde)];
  }

  /**
   * El silencio que pide el narrador con el Bibliotecario del Infierno en juego
   * (ver SalaEstado.silencio). Solo vale mientras el NPC siga en juego: si se
   * quita (o cambia el guion), se acaba solo.
   */
  private silencioPedido = false;

  silencio(): boolean {
    return this.silencioPedido && this.npcsActuales.includes(NPC_SILENCIO);
  }

  pedirSilencio(activo: boolean): void {
    this.silencioPedido = activo;
  }

  /** Los faroles que el narrador prepara para el demonio (ver SalaEstado.faroles). */
  private farolesNarrador: (string | null)[] = farolesVacios();

  faroles(): (string | null)[] {
    return [...this.farolesNarrador];
  }

  /**
   * Pone un personaje en una casilla de farol del narrador (o la vacía, con
   * null). Si ya estaba en otra casilla, sale de ella. No comprueba el guion.
   */
  ponerFarol(posicion: number, personajeId: string | null): void {
    this.farolesNarrador = ponerEnCasilla(this.farolesNarrador, posicion, personajeId);
  }

  /**
   * Los faroles de cada asiento, con quién estaba sentado al ponerlos: si se
   * sienta otro (o se levanta), dejan de valer, como los despertares.
   */
  private farolesAsientos = new Map<string, { ocupante: string | null; faroles: (string | null)[] }>();

  /** Los faroles del asiento, si siguen siendo de quien se sienta en él. */
  private farolesDeAsiento(asiento: SalaAsiento): (string | null)[] {
    const f = this.farolesAsientos.get(asiento.id);
    return f && f.ocupante === asiento.ocupante ? [...f.faroles] : farolesVacios();
  }

  /** Pone un farol en una casilla de un asiento (o la vacía). No comprueba permisos ni el guion. */
  ponerFarolAsiento(asientoId: string, posicion: number, personajeId: string | null): void {
    const asiento = this.mesaAlDia().find((a) => a.id === asientoId);
    if (!asiento) return;
    const faroles = ponerEnCasilla(this.farolesDeAsiento(asiento), posicion, personajeId);
    this.farolesAsientos.set(asientoId, { ocupante: asiento.ocupante, faroles });
  }

  /** El asiento en el que se sienta un participante, o null. */
  asientoDe(participanteId: string): SalaAsiento | null {
    return this.mesaAlDia().find((a) => a.ocupante === participanteId) ?? null;
  }

  /** Cambia de una vez los faroles de un asiento (los que le ha enseñado el narrador). */
  copiarFaroles(asientoId: string, personajes: string[]): void {
    const asiento = this.mesaAlDia().find((a) => a.id === asientoId);
    if (!asiento) return;
    const faroles = farolesVacios().map((_, i) => personajes[i] ?? null);
    this.farolesAsientos.set(asientoId, { ocupante: asiento.ocupante, faroles });
  }

  /**
   * Un personaje de la partida: del guion o, aunque el guion no lo traiga, uno de
   * los viajeros o de los NPCs (legendarios y lóricos) del catálogo. undefined si no.
   */
  personaje(id: string): PersonajeDeGuion | undefined {
    const g = this.guionActual;
    if (!g) return undefined;
    return g.personajes.find((p) => p.id === id) ?? g.viajeros?.find((p) => p.id === id) ?? g.npcs?.find((p) => p.id === id);
  }

  /** Los personajes metidos en la bolsa, en el orden en que se metieron. */
  private bolsaActual: string[] = [];

  bolsa(): string[] {
    return [...this.bolsaActual];
  }

  /** Mete un personaje en la bolsa, o lo saca si ya estaba. No comprueba que esté en el guion. */
  alternarEnBolsa(personajeId: string): void {
    this.bolsaActual = this.bolsaActual.includes(personajeId)
      ? this.bolsaActual.filter((id) => id !== personajeId)
      : [...this.bolsaActual, personajeId];
  }

  /**
   * Cambia de una vez los aldeanos, forasteros, esbirros y demonios de la bolsa
   * (al llenarla al azar); los viajeros que hubiera se quedan. No comprueba que
   * estén en el guion.
   */
  reemplazarBolsa(personajes: string[]): void {
    this.bolsaActual = [...this.bolsaActual.filter((id) => this.esViajero(id)), ...personajes];
  }

  /** Vacía la bolsa entera (también los viajeros). No comprueba permisos. */
  vaciarBolsa(): void {
    this.bolsaActual = [];
  }

  private esViajero(id: string): boolean {
    return this.personaje(id)?.tipo === 'traveller';
  }

  /**
   * Quién es de verdad el de un asiento: el personaje de su recordatorio «Is The …»
   * (el último, si hay varios) o, sin él, el de su ficha. Es lo que cuenta para el
   * reparto; la ficha, para su habilidad (el orden de noche).
   */
  identidad(asiento: SalaAsiento): string | null {
    const r = [...asiento.recordatorios].reverse().find(esIdentidad);
    return r?.personaje ?? asiento.personaje;
  }

  /**
   * Si en un asiento hay un viajero puesto a mano (de verdad: un Aprendiz con la
   * ficha de un aldeano sigue siendo viajero): ese asiento no entra en el
   * reparto. Uno que esté en la bolsa no cuenta (salió del reparto, y al repartir
   * otra vez puede tocarle a otro).
   */
  private llevaViajero(asiento: SalaAsiento): boolean {
    const id = this.identidad(asiento);
    return !!id && this.esViajero(id) && !this.bolsaActual.includes(id);
  }

  /**
   * Al poner un viajero que lleva su propio «Is The …» (el Aprendiz), se le pone
   * solo: luego el narrador le cambia la ficha por la habilidad que gana y sigue
   * sabiéndose quién es.
   */
  private identidadAutomatica(asiento: SalaAsiento): void {
    const p = asiento.personaje ? this.personaje(asiento.personaje) : undefined;
    if (!p || p.tipo !== 'traveller') return;
    const indice = p.recordatorios.findIndex(esRecordatorioDeIdentidad);
    if (indice < 0) return;
    if (asiento.recordatorios.some((r) => r.personaje === p.id && r.indice === indice)) return;
    asiento.recordatorios.push({ id: randomUUID(), personaje: p.id, indice, texto: p.recordatorios[indice] });
  }

  /** Los viajeros metidos en la bolsa: se reparten con los demás, pero no cuentan para el reparto por tipos. */
  private viajerosEnBolsa(): number {
    return this.bolsaActual.filter((id) => this.esViajero(id)).length;
  }

  /**
   * El reparto de la partida: los jugadores (asientos, sin los viajeros: los
   * puestos a mano y los de la bolsa) y cuántos de cada tipo (ver repartoPara).
   */
  distribucion(): SalaDistribucion {
    const viajeros = this.mesa.filter((a) => this.llevaViajero(a)).length + this.viajerosEnBolsa();
    const jugadores = Math.max(0, this.mesa.length - viajeros);
    const reparto = repartoPara(jugadores);
    return {
      jugadores,
      viajeros,
      aldeanos: reparto?.aldeanos ?? null,
      forasteros: reparto?.forasteros ?? null,
      esbirros: reparto?.esbirros ?? null,
      demonios: reparto?.demonios ?? null,
    };
  }

  /** Cuántos personajes hay que meter en la bolsa: uno por asiento sin viajero puesto a mano (los de la bolsa, también). */
  fichasParaRepartir(): number {
    return this.mesa.filter((a) => !this.llevaViajero(a)).length;
  }

  /**
   * Reparte al azar los personajes de la bolsa (también sus viajeros) entre los
   * asientos que no llevan un viajero puesto a mano (tiene que haber tantos como
   * asientos; no lo comprueba). El
   * alineamiento vuelve a ser el de su tipo. La bolsa se queda como estaba.
   */
  repartirBolsa(): void {
    const personajes = [...this.bolsaActual];
    for (let i = personajes.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [personajes[i], personajes[j]] = [personajes[j], personajes[i]];
    }
    this.mesa
      .filter((a) => !this.llevaViajero(a))
      .forEach((a, i) => {
        a.personaje = personajes[i] ?? null;
        a.alineamiento = null;
        // Un reparto nuevo: quién era cada uno (los «Is The …» del anterior) ya no vale
        a.recordatorios = a.recordatorios.filter((r) => !esIdentidad(r));
        this.identidadAutomatica(a);
      });
  }
  /** Lo siguiente que toca en la nominación: el fin de la cuenta atrás o el próximo paso de la votación. */
  private temporizador: NodeJS.Timeout | null = null;
  private registro: SalaRegistroVotacion[] = [];

  /**
   * Se llama cuando la sala cambia sola, sin que nadie pida nada (la votación
   * avanza con el tiempo): quien la usa manda el estado a todos.
   */
  alCambiarSola: () => void = () => {};

  /**
   * Las estadísticas: lo que se apunta de cada jugador con cuenta durante la
   * partida (ver SeguimientoPartida) y a quién se le da al terminar, para que lo
   * guarde (al revelar el grimorio). Sin esto, no se guarda nada.
   */
  private seguimiento = new SeguimientoPartida();
  alTerminarPartida: (registro: RegistroPartida) => void = () => {};

  /** El id de usuario de un participante con cuenta, o null (invitado, o ya no está). */
  private cuentaDe(participanteId: string | null): string | null {
    if (!participanteId) return null;
    const identidad = [...this.entradas.values()].find((e) => e.participante.id === participanteId)?.identidad;
    return identidad?.startsWith('u:') ? identidad.slice(2) : null;
  }

  private cuentaDelAsiento(asientoId: string): string | null {
    return this.cuentaDe(this.mesa.find((a) => a.id === asientoId)?.ocupante ?? null);
  }

  /**
   * El alineamiento de un asiento: el que haya puesto el narrador o, si no, el del
   * tipo de quien es de verdad (aldeanos y forasteros, buenos; esbirros y
   * demonios, malvados). Un viajero sin alineamiento puesto: null.
   */
  alineamientoEfectivo(asiento: SalaAsiento): SalaAlineamiento | null {
    if (asiento.alineamiento) return asiento.alineamiento;
    const id = this.identidad(asiento);
    const tipo = id ? this.personaje(id)?.tipo : undefined;
    if (tipo === 'townsfolk' || tipo === 'outsider') return 'bueno';
    if (tipo === 'minion' || tipo === 'demon') return 'malvado';
    return null;
  }

  /** Cómo están ahora los jugadores con cuenta sentados (para las estadísticas). */
  private fotosDeCuentas(): FotoJugador[] {
    return this.mesaAlDia().flatMap((a) => {
      const userId = this.cuentaDe(a.ocupante);
      return userId ? [{ userId, personaje: this.identidad(a), alineamiento: this.alineamientoEfectivo(a), muerto: a.muerto }] : [];
    });
  }

  /** El registro de nominaciones y votaciones, en el orden en que se nominó. */
  votaciones(): SalaRegistroVotacion[] {
    return this.registro.map((v) => ({ ...v, votantes: v.votantes && [...v.votantes] }));
  }

  fase(): SalaFase {
    return { ...this.faseActual };
  }

  /**
   * Anochece (desde la preparación, la noche 1; desde un día, la siguiente
   * noche): se cierra la nominación abierta y se quitan la calavera y el récord
   * de votos del día.
   */
  irANoche(): void {
    const { momento, numero, reinicios } = this.faseActual;
    if (momento === 'preparacion' || !this.seguimiento.estaEmpezada()) this.seguimiento.empezar(this.fotosDeCuentas());
    else for (const a of this.mesa.filter((x) => x.marcado)) this.seguimiento.ejecutado(this.cuentaDe(a.ocupante));
    this.faseActual = { momento: 'noche', numero: momento === 'preparacion' ? 1 : numero + 1, reinicios };
    this.cerrarNominacion();
    this.desmarcar();
    this.maximoDelDia = null;
  }

  /**
   * Amanece: el día de la misma noche. Los despertares de la noche se acaban: no
   * se ven de día y la noche siguiente empieza sin ellos.
   */
  amanecer(): void {
    this.faseActual = { ...this.faseActual, momento: 'dia' };
    // El rol con el que empieza el día cuenta como jugado (los cambios de la noche, no)
    this.seguimiento.anotarRoles(this.fotosDeCuentas());
    this.hilos = [];
  }

  /** Recordatorios del orden de noche cambiados a mano (ver SalaEstado.recordatoriosNoche). */
  private recordatorios: Record<string, boolean> = {};

  recordatoriosNoche(): Record<string, boolean> {
    return { ...this.recordatorios };
  }

  /** Pone (true) o quita (false) a mano la ficha recordatorio de una fila del orden de noche. */
  cambiarRecordatorio(id: string, activo: boolean): void {
    this.recordatorios[id] = activo;
  }

  /**
   * Los despertares, uno por asiento, con quién estaba sentado al abrirlo (null:
   * estaba libre; un asiento libre cuenta como un jugador más). Solo los de esta
   * noche: al amanecer se borran.
   */
  private hilos: { asiento: string; ocupante: string | null; mensajes: MensajeDespertar[] }[] = [];

  /**
   * Se aplica al leer: si el jugador de un asiento se levanta, cambia de asiento,
   * alguien se sienta en el que estaba libre o el asiento se quita, ese
   * despertar se cierra (lo dicho era para otro).
   */
  private hilosAlDia() {
    const mesa = this.mesaAlDia();
    this.hilos = this.hilos.filter((h) => mesa.some((a) => a.id === h.asiento && a.ocupante === h.ocupante));
    return this.hilos;
  }

  /** Todos los despertares, en el orden en que se abrieron. */
  despertares(): SalaDespertar[] {
    return this.hilosAlDia().map((h) => ({ asiento: h.asiento, mensajes: h.mensajes.map((m) => ({ ...m })) }));
  }

  hayDespertar(asientoId: string): boolean {
    return this.hilosAlDia().some((h) => h.asiento === asientoId);
  }

  /** El asiento con despertar de este participante, o null. */
  asientoDespiertoDe(participanteId: string): string | null {
    return this.hilosAlDia().find((h) => h.ocupante === participanteId)?.asiento ?? null;
  }

  /** Abre el despertar de un asiento (si ya lo tiene, no hace nada). Devuelve el error, si lo hay. */
  despertar(asientoId: string): string | null {
    const asiento = this.mesaAlDia().find((a) => a.id === asientoId);
    if (!asiento) return 'Ese asiento ya no existe.';
    if (!this.hayDespertar(asientoId)) this.hilos.push({ asiento: asientoId, ocupante: asiento.ocupante, mensajes: [] });
    return null;
  }

  /** Guarda un mensaje en el despertar de un asiento. No valida: lo hace quien lo llama. */
  enviarDespertar(asientoId: string, mensaje: Omit<MensajeDespertar, 'id' | 'hora' | 'fase'>): void {
    const hilo = this.hilosAlDia().find((h) => h.asiento === asientoId);
    if (!hilo) return;
    const { momento, numero } = this.faseActual;
    hilo.mensajes.push({ ...mensaje, id: randomUUID(), hora: Date.now(), fase: { momento, numero } });
    if (hilo.mensajes.length > SALA_MENSAJES_DESPERTAR_MAX) hilo.mensajes.shift();
  }

  /**
   * Deja la partida como al principio, en la preparación: sin registro de
   * votaciones, todas las fichas vivas, sin personaje y sin calavera, la bolsa
   * vacía, sin nominación y nadie con acceso al grimorio (las peticiones
   * pendientes siguen). Los jugadores siguen en sus asientos.
   */
  limpiarGrimorio(): void {
    this.cerrarNominacion();
    this.seguimiento.reiniciar();
    // Otra partida: los NPCs del guion, en juego (si alguno se quitó, vuelve); los
    // demás que se pusieron a mano, siguen
    this.npcsActuales = [...this.npcsActuales, ...this.npcsDelGuion().filter((id) => !this.npcsActuales.includes(id))];
    this.registro = [];
    this.maximoDelDia = null;
    for (const a of this.mesa) {
      a.muerto = false;
      a.muertePendiente = false;
      a.votoGastado = false;
      a.marcado = false;
      a.votosMarca = null;
      a.personaje = null;
      a.alineamiento = null;
      a.recordatorios = [];
      a.notas = [];
    }
    this.bolsaActual = [];
    this.entregadas.clear();
    this.grimoriosEnviados.clear();
    this.farolesNarrador = farolesVacios();
    this.farolesAsientos.clear();
    this.setupAceptadoActual = null;
    this.silencioPedido = false;
    this.retenidas = false;
    this.rolStormcatcherActual = null;
    this.revelacionActual = null;
    // Es otra partida: quien veía el grimorio deja de verlo (y puede volver a sentarse),
    // también quien había salido de la sala
    for (const { participante } of this.entradas.values()) {
      if (participante.accesoGrimorio === 'concedido') participante.accesoGrimorio = 'ninguno';
    }
    this.conGrimorio.clear();
    this.hilos = [];
    this.recordatorios = {};
    this.faseActual = { momento: 'preparacion', numero: 0, reinicios: this.faseActual.reinicios + 1 };
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
    const n = this.nominacionVigente();
    if (!n) return;
    const i = this.mesa.findIndex((a) => a.id === n.hasta);
    const orden = this.mesa.map((_, k) => this.mesa[(i + 1 + k) % this.mesa.length].id);
    n.votacion = { orden, paso: 0, resultados: {}, votos: 0, terminada: false };
    this.alCambiarSola();
    this.temporizador = setTimeout(() => this.avanzarVotacion(), this.ajustes.segundosPorFicha * 1000);
  }

  /**
   * La aguja llega a la siguiente ficha: vota si quien se sienta ahí tiene la mano
   * levantada (y entonces se le baja). Un muerto solo vota si le queda el voto, y
   * al votar lo gasta.
   */
  private avanzarVotacion(): void {
    const n = this.nominacionVigente();
    const v = n?.votacion;
    if (!n || !v || v.terminada) return;
    const asientoId = v.orden[v.paso];
    const asiento = this.mesa.find((a) => a.id === asientoId);
    const ocupante = asiento?.ocupante ? this.buscar(asiento.ocupante) : undefined;
    // La Banshee con su habilidad, y los muertos con el Voudon vivo, votan sin gastar el
    // voto de muerto (ni les hace falta); con el Voudon, los vivos no votan (salvo él)
    const conservaVoto = (!!ocupante && this.puedeVotarDoble(ocupante.id)) || this.voudonVivo();
    const sinVoto = !ocupante || this.sinVoto(ocupante.id);
    const vota = ocupante?.rol === 'jugador' && ocupante.manoLevantada && !sinVoto;
    if (vota) {
      const valor = this.valorDelVoto(asiento!, ocupante);
      v.votos += valor;
      if (valor !== 1) v.valores = { ...v.valores, [asientoId]: valor };
      this.seguimiento.vota(this.cuentaDe(ocupante.id));
      // Voto contado: la mano baja sola.
      ocupante.manoLevantada = false;
      ocupante.dosManos = false;
      if (asiento?.muerto && !conservaVoto) asiento.votoGastado = true;
    }
    v.resultados[asientoId] = vota ? v.votos : null;
    v.paso += 1;
    if (v.paso >= v.orden.length) {
      v.terminada = true;
      this.temporizador = null;
      // Si llega a los necesarios, la siguiente tendrá que superarla (aunque empate y
      // nadie se quede con la calavera)
      if (v.votos >= (n.votosElegidos ?? this.votosNecesariosPorDefecto())) {
        this.maximoDelDia = Math.max(this.maximoDelDia ?? 0, v.votos);
      }
      // Se completa su entrada del registro (la que se hizo al nominar)
      if (n.registro) {
        n.registro.votantes = v.orden
          .filter((id) => v.resultados[id] !== null && v.resultados[id] !== undefined)
          .map((id) => {
            const o = this.mesa.find((a) => a.id === id)?.ocupante;
            const nombre = (o && this.buscar(o)?.nombre) || this.describirAsiento(id);
            const valor = v.valores?.[id];
            return valor !== undefined ? `${nombre} (${valor} votos)` : nombre;
          });
        n.registro.votos = v.votos;
      }
    } else {
      this.temporizador = setTimeout(() => this.avanzarVotacion(), this.ajustes.segundosPorFicha * 1000);
    }
    this.alCambiarSola();
  }

  /** La nominación en curso (la de verdad); se anula sola si alguno de los dos asientos ya no existe. */
  private nominacionVigente(): NominacionInterna | null {
    const n = this.nominacionEnCurso;
    const existe = (id: string) => this.mesa.some((a) => a.id === id);
    if (n && (!existe(n.desde) || !existe(n.hasta))) {
      this.nominacionEnCurso = null;
      this.pararTemporizador();
    }
    return this.nominacionEnCurso;
  }

  /** La nominación en curso (una copia), con los votos que hacen falta. */
  nominacion(): SalaNominacion | null {
    const actual = this.nominacionVigente();
    if (!actual) return null;
    const { votosElegidos: _, registro: __, ...resto } = actual;
    const votosElegidos = actual.votosElegidos;
    const porDefecto = this.votosNecesariosPorDefecto();
    return {
      ...resto,
      votacion: actual.votacion ? { ...actual.votacion, resultados: { ...actual.votacion.resultados } } : null,
      votosNecesarios: votosElegidos ?? porDefecto,
      votosNecesariosPorDefecto: porDefecto,
    };
  }

  /**
   * Los votos que hacen falta si el narrador no dice otra cosa: la mitad de las
   * fichas vivas, redondeando hacia arriba; y si ya ha habido hoy una votación
   * que llegó a los necesarios, al menos uno más que la que más tuvo. Nunca menos de 1.
   */
  private votosNecesariosPorDefecto(): number {
    const vivos = this.mesa.filter((a) => !a.muerto).length;
    // Con el Voudon vivo no hace falta la mitad: basta 1 (y superar la que más tuvo hoy)
    const mayoria = this.voudonVivo() ? 1 : Math.ceil(vivos / 2);
    return Math.max(1, mayoria, this.maximoDelDia === null ? 0 : this.maximoDelDia + 1);
  }

  /** El narrador fija los votos que hacen falta en la nominación en curso (null: los de por defecto). */
  elegirVotosNecesarios(votos: number | null): void {
    const n = this.nominacionVigente();
    if (n) n.votosElegidos = votos;
  }

  /**
   * Empieza una nominación (sustituye a la que hubiera) y la apunta en el
   * registro, con su día (si no se llega a votar, queda sin votos). Baja la mano
   * a los muertos que ya no tienen voto. No comprueba permisos.
   */
  nominar(desde: string, hasta: string): void {
    this.pararTemporizador();
    const registro: SalaRegistroVotacion = {
      hora: Date.now(),
      dia: this.faseActual.numero,
      nomina: this.describirAsiento(desde),
      nominado: this.describirAsiento(hasta),
      votantes: null,
      votos: null,
    };
    this.registro.push(registro);
    this.seguimiento.nomina(this.cuentaDelAsiento(desde), this.cuentaDelAsiento(hasta));
    this.nominacionEnCurso = { desde, hasta, cuentaAtrasFin: null, votacion: null, votosElegidos: null, registro };
    // Quien no puede votar (un muerto sin voto; con el Voudon vivo, los vivos que no son
    // él): si tenía la mano levantada, se le baja
    for (const a of this.mesa) {
      if (!a.ocupante || !this.sinVoto(a.ocupante)) continue;
      const ocupante = this.buscar(a.ocupante);
      if (ocupante) {
        ocupante.manoLevantada = false;
        ocupante.dosManos = false;
      }
    }
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
    this.nominacionEnCurso.cuentaAtrasFin = ahora + SALA_CUENTA_ATRAS_MS;
    this.temporizador = setTimeout(() => this.empezarVotacion(), SALA_CUENTA_ATRAS_MS);
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

  /**
   * Pone un personaje en la ficha de un asiento (o se lo quita, con null). El
   * alineamiento vuelve a ser el de su tipo. No comprueba permisos ni que esté en el guion.
   */
  cambiarPersonaje(asientoId: string, personaje: string | null): void {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return;
    asiento.personaje = personaje;
    asiento.alineamiento = null;
    this.identidadAutomatica(asiento);
  }

  /**
   * Intercambia el personaje y el alineamiento de dos fichas (con el Gardener, el
   * narrador decide quién tiene qué). Lo demás (muerte, calavera, recordatorios)
   * es del asiento y se queda. No comprueba permisos.
   */
  intercambiarFichas(desdeId: string, hastaId: string): void {
    const desde = this.mesa.find((a) => a.id === desdeId);
    const hasta = this.mesa.find((a) => a.id === hastaId);
    if (!desde || !hasta || desde === hasta) return;
    [desde.personaje, hasta.personaje] = [hasta.personaje, desde.personaje];
    [desde.alineamiento, hasta.alineamiento] = [hasta.alineamiento, desde.alineamiento];
  }

  /** Pone una ficha recordatorio junto a la de un asiento. No comprueba permisos. */
  ponerRecordatorio(asientoId: string, recordatorio: Omit<SalaRecordatorio, 'id'>): void {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (asiento) asiento.recordatorios.push({ id: randomUUID(), ...recordatorio });
  }

  /** Quita una ficha recordatorio. No comprueba permisos. */
  quitarRecordatorio(asientoId: string, recordatorioId: string): void {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (asiento) asiento.recordatorios = asiento.recordatorios.filter((r) => r.id !== recordatorioId);
  }

  /**
   * Escribe una nota sobre un asiento: nueva (sin `notaId`) o cambia una que ya
   * estaba. Devuelve su id, o null si no existe (el asiento o la nota). No
   * comprueba permisos ni cuántas hay.
   */
  escribirNota(asientoId: string, notaId: string | null, texto: string): string | null {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return null;
    if (notaId === null) {
      const nota = { id: randomUUID(), texto };
      asiento.notas.push(nota);
      return nota.id;
    }
    const nota = asiento.notas.find((n) => n.id === notaId);
    if (!nota) return null;
    nota.texto = texto;
    return nota.id;
  }

  /** Borra una nota de un asiento. No comprueba permisos. */
  borrarNota(asientoId: string, notaId: string): void {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (asiento) asiento.notas = asiento.notas.filter((n) => n.id !== notaId);
  }

  /** Cambia el alineamiento de la ficha de un asiento. No comprueba permisos. */
  cambiarAlineamiento(asientoId: string, alineamiento: SalaAlineamiento): void {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (asiento) asiento.alineamiento = alineamiento;
  }

  /** Hora (ms) del último gong (ver SalaEstado.gong), o null. */
  gong(): number | null {
    return this.ultimoGong;
  }

  /** Suena el gong: todos vuelven a la plaza. No comprueba permisos. */
  sonarGong(): void {
    this.ultimoGong = Date.now();
  }

  /** La revelación del grimorio en curso (o acabada), o null. */
  revelacion(): SalaRevelacion | null {
    const r = this.revelacionActual;
    if (!r) return null;
    // Solo cuentan los asientos que siguen en la mesa
    const reveladas = r.reveladas.filter((id) => this.mesa.some((a) => a.id === id));
    const terminada = this.mesa.every((a) => reveladas.includes(a.id));
    // Lo que ha pasado dice quién estaba en juego: no se cuenta hasta que todo está revelado
    return { ganador: r.ganador, causas: terminada ? [...r.causas] : [], reveladas, terminada };
  }

  /**
   * Empieza a revelar el grimorio: ha ganado ese bando (y lo que haya pasado, ver
   * CAUSAS_FIN_PARTIDA) y todas las fichas se dan la vuelta.
   */
  empezarRevelacion(ganador: SalaAlineamiento, causas: string[] = []): void {
    this.cerrarNominacion();
    this.revelacionActual = { ganador, causas, reveladas: [] };
    // Se acaba la partida: se guarda lo de cada uno (si se había empezado a jugar)
    const jugadores = this.seguimiento.estaEmpezada() ? this.seguimiento.terminar(this.fotosDeCuentas(), ganador, causas) : [];
    const narradores = [...this.entradas.values()]
      .filter((e) => e.participante.rol === 'narrador')
      .map((e) => this.cuentaDe(e.participante.id))
      .filter((id): id is string => !!id);
    if (jugadores.length > 0 || narradores.length > 0) {
      this.alTerminarPartida({
        fecha: new Date(),
        guion: this.guionActual?.nombre ?? null,
        edicion: this.guionActual?.edicion ?? null,
        ganador,
        dias: this.faseActual.numero,
        causas,
        jugadores,
        narradores,
      });
    }
  }

  /** Revela la ficha de un asiento (todos verán su personaje). */
  revelarFicha(asientoId: string): void {
    const r = this.revelacionActual;
    if (r && !r.reveladas.includes(asientoId) && this.mesa.some((a) => a.id === asientoId)) r.reveladas.push(asientoId);
  }

  /** Revela de una vez las que quedan. */
  revelarTodas(): void {
    for (const a of this.mesa) this.revelarFicha(a.id);
  }

  /**
   * Mata o revive la ficha de un asiento; al morir pierde la calavera. De noche,
   * la muerte queda pendiente (solo la ven quienes ven el grimorio) hasta que el
   * narrador la hace efectiva (confirmarMuerte). Revivir quita también la pendiente.
   * No comprueba permisos.
   */
  cambiarVida(asientoId: string, muerto: boolean): void {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return;
    if (muerto && this.faseActual.momento === 'noche' && !asiento.muerto) {
      asiento.muertePendiente = true;
      return;
    }
    // Al morir (o revivir) tiene su voto
    if (asiento.muerto !== muerto) asiento.votoGastado = false;
    asiento.muerto = muerto;
    asiento.muertePendiente = false;
    if (muerto) {
      asiento.marcado = false;
      asiento.votosMarca = null;
    }
  }

  /** Hace efectiva una muerte pendiente (el narrador la anuncia): ya la ven todos. No comprueba permisos. */
  confirmarMuerte(asientoId: string): boolean {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento?.muertePendiente) return false;
    asiento.muertePendiente = false;
    asiento.muerto = true;
    asiento.votoGastado = false;
    asiento.marcado = false;
    asiento.votosMarca = null;
    return true;
  }

  /** Quita o devuelve el voto a la ficha de un muerto. Devuelve false si no está muerta. No comprueba permisos. */
  cambiarVoto(asientoId: string, gastado: boolean): boolean {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento?.muerto) return false;
    asiento.votoGastado = gastado;
    return true;
  }

  /** El Barquero: todos los muertos recuperan su voto. Devuelve cuántos lo recuperan. No comprueba permisos. */
  devolverVotos(): number {
    const sinVoto = this.mesa.filter((a) => a.muerto && a.votoGastado);
    for (const a of sinVoto) a.votoGastado = false;
    return sinVoto.length;
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
    return this.mesaAlDia().map((a) => ({ ...a, faroles: this.farolesDeAsiento(a) }));
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
    // Fisher-Yates sobre la mesa entera: los huecos libres también se barajan. Cada
    // asiento nuevo recibe a quien estaba en el de `orden[i]`, con su ficha
    const orden = mesa.map((_, i) => i);
    for (let i = orden.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    const ocupantes = mesa.map((a) => a.ocupante);
    this.llevarFichas(new Map(orden.map((desde, i) => [mesa[desde].id, mesa[i].id])));
    mesa.forEach((a, i) => (a.ocupante = ocupantes[orden[i]]));
    return ocupantes.filter(Boolean).length;
  }

  /**
   * Lleva lo de cada ficha (personaje, alineamiento, muerte, voto, calavera,
   * recordatorios, notas; y lo que va por asiento: lo entregado, los faroles, el
   * grimorio enviado, los despertares, lo revelado, la nominación) del asiento de
   * cada clave al de su valor. Al cambiar de sitio a los jugadores, su ficha va con
   * ellos: cambian de silla, no de personaje. `destino` es una permutación de la mesa.
   */
  private llevarFichas(destino: Map<string, string>): void {
    const a = (id: string) => destino.get(id) ?? id;
    const fichas = new Map(
      this.mesa.map((s) => [
        s.id,
        {
          muerto: s.muerto,
          muertePendiente: s.muertePendiente,
          votoGastado: s.votoGastado,
          marcado: s.marcado,
          votosMarca: s.votosMarca,
          personaje: s.personaje,
          alineamiento: s.alineamiento,
          recordatorios: s.recordatorios,
          notas: s.notas,
        },
      ]),
    );
    for (const [desde, hasta] of destino) {
      const asiento = this.mesa.find((s) => s.id === hasta);
      const ficha = fichas.get(desde);
      if (asiento && ficha) Object.assign(asiento, ficha);
    }
    const remapear = <V>(m: Map<string, V>) => new Map([...m].map(([k, v]) => [a(k), v] as const));
    this.entregadas = remapear(this.entregadas);
    this.farolesAsientos = remapear(this.farolesAsientos);
    this.grimoriosEnviados = remapear(this.grimoriosEnviados);
    for (const h of this.hilos) h.asiento = a(h.asiento);
    if (this.revelacionActual) this.revelacionActual.reveladas = this.revelacionActual.reveladas.map(a);
    const n = this.nominacionEnCurso;
    if (n) {
      n.desde = a(n.desde);
      n.hasta = a(n.hasta);
      if (n.votacion) {
        n.votacion.orden = n.votacion.orden.map(a);
        n.votacion.resultados = Object.fromEntries(Object.entries(n.votacion.resultados).map(([k, v]) => [a(k), v]));
        if (n.votacion.valores) n.votacion.valores = Object.fromEntries(Object.entries(n.votacion.valores).map(([k, v]) => [a(k), v]));
      }
    }
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
    if (origen === destino) return null;
    // Cambian de silla con su ficha (su personaje, sus recordatorios…)
    this.llevarFichas(new Map([[origen.id, destino.id], [destino.id, origen.id]]));
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

  /** El jugador está muerto y ya ha gastado su voto: no puede levantar la mano. */
  sinVoto(participanteId: string): boolean {
    const asiento = this.asientoDe(participanteId);
    if (!asiento) return true;
    // Con el Voudon vivo, solo votan él y los muertos (sin voto de muerto)
    if (this.voudonVivo()) return !asiento.muerto && !this.esVoudon(asiento);
    // La Banshee con su habilidad vota sin gastar el voto de muerto
    return asiento.muerto && asiento.votoGastado && !this.puedeVotarDoble(participanteId);
  }

  /**
   * La Institutriz (Matron) está viva en la mesa (su ficha o quien es de verdad): los
   * jugadores solo pueden conversar en privado con sus vecinos.
   */
  institutrizViva(): boolean {
    return this.mesa.some((a) => !a.muerto && (a.personaje === 'matron' || this.identidad(a) === 'matron'));
  }

  /**
   * Si dos participantes son vecinos en la mesa: el asiento ocupado más cercano a
   * cada lado (los libres se saltan; vivos o muertos, da igual).
   */
  sonVecinos(unoId: string, otroId: string): boolean {
    const ocupados = this.mesa.filter((a) => a.ocupante);
    const i = ocupados.findIndex((a) => a.ocupante === unoId);
    if (i < 0 || ocupados.length < 2) return false;
    const n = ocupados.length;
    return [ocupados[(i + 1) % n].ocupante, ocupados[(i - 1 + n) % n].ocupante].includes(otroId);
  }

  /** La ficha es la del Voudon (o lo es de verdad, por su «Is The …»). */
  private esVoudon(asiento: SalaAsiento): boolean {
    return asiento.personaje === 'voudon' || this.identidad(asiento) === 'voudon';
  }

  /**
   * El Voudon está vivo en la mesa: solo votan él y los muertos, los muertos no
   * necesitan ni gastan su voto y basta con 1 voto para la calavera.
   */
  voudonVivo(): boolean {
    return this.mesa.some((a) => !a.muerto && this.esVoudon(a));
  }

  /** Levanta (una o, con `dos`, las dos) o baja la mano de un jugador. No comprueba permisos. */
  levantarMano(id: string, levantada: boolean, dos = false): void {
    const participante = this.buscar(id);
    if (!participante) return;
    participante.manoLevantada = levantada;
    participante.dosManos = levantada && dos;
  }

  /**
   * Lo que vale el voto de quien se sienta en un asiento: las dos manos de la Banshee
   * con su habilidad, ×2; con el recordatorio del Burócrata, ×3; con el del Ladrón, en
   * negativo. Se combinan (la Banshee con los dos: −6).
   */
  private valorDelVoto(asiento: SalaAsiento, ocupante: SalaParticipante): number {
    const manos = ocupante.dosManos && this.puedeVotarDoble(ocupante.id) ? 2 : 1;
    const lleva = (personaje: string) => asiento.recordatorios.some((r) => r.personaje === personaje);
    return manos * (lleva('bureaucrat') ? 3 : 1) * (lleva('thief') ? -1 : 1);
  }

  /**
   * Puede votar con las dos manos (dos votos): la Banshee muerta con su
   * recordatorio «Has Ability» en la ficha.
   */
  puedeVotarDoble(participanteId: string): boolean {
    const asiento = this.mesa.find((a) => a.ocupante === participanteId);
    return !!asiento?.muerto && asiento.recordatorios.some((r) => r.personaje === 'banshee' && /has ability/i.test(r.texto));
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

/** Las casillas con `personajeId` en `posicion` (fuera de cualquier otra en la que estuviera). */
function ponerEnCasilla(casillas: (string | null)[], posicion: number, personajeId: string | null): (string | null)[] {
  const nuevas = casillas.map((id) => (personajeId && id === personajeId ? null : id));
  nuevas[posicion] = personajeId;
  return nuevas;
}
