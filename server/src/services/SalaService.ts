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
  SalaReloj,
  SalaSenalamiento,
  SalaRevelacion,
  SalaRol,
  NUM_FAROLES,
  RECORDATORIO_TEXTO,
  SalaFichaEnviada,
  SalaGrimorioEnviado,
} from '../contrato/sala';
import { GuionResuelto, PersonajeDeGuion } from '../types/guiones';
import { repartoPara } from './partida/distribucion';
import { Participantes, type SalaLlegada } from './partida/Participantes';
import { RelojSala } from './partida/RelojSala';
import { Despertares, type HiloDespertar } from './partida/Despertares';
import { Nominaciones } from './partida/Nominaciones';
import {
  SeguimientoPartida,
  type FotoJugador,
  type InstantaneaSeguimiento,
  type RegistroPartida,
} from './estadisticas/SeguimientoPartida';


/** Asientos de la mesa: con cuántos empieza la sala y cuántos puede tener. */
export const SALA_ASIENTOS = { inicial: 7, min: 0, max: 20 };

/** Lo que tarda la aguja de ficha en ficha al votar, en segundos (de cuarto en cuarto). */
export const SALA_SEGUNDOS_POR_FICHA = { min: 0.25, max: 2, paso: 0.25, defecto: 1 };

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

/** Una copia de la lista barajada al azar (Fisher-Yates). */
const barajar = <T>(lista: readonly T[]): T[] => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

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
/** Revolutionary: los dos asientos con su recordatorio reciben, al repartir la bolsa, personajes del mismo alineamiento. */
export const NPC_REVOLUTIONARY = 'revolutionary';
/** El Carnicero (viajero): vivo, tras la primera ejecución se puede nominar otra vez (no anochece). */
export const VIAJERO_BUTCHER = 'butcher';
/** Lil' Monsta: cada noche los esbirros eligen (señalando) quién lo cuida; ese lleva su «Is The Demon». */
export const DEMONIO_LILMONSTA = 'lilmonsta';
/** Organ Grinder: vivo y sin su «Drunk», las votaciones son secretas (ver SalaNominacion.privada). */
export const ESBIRRO_ORGAN_GRINDER = 'organgrinder';

/**
 * Los recordatorios que se ponen solos en la ficha del ejecutado si su personaje
 * está en juego y vivo: su texto en el original (en el catálogo). `unico`: solo
 * hay uno en la mesa (se quita de donde estuviera); `soloBueno`: solo si el
 * ejecutado es bueno.
 */
const RECORDATORIOS_EJECUCION: { personaje: string; texto: string; unico: boolean; soloBueno?: boolean }[] = [
  // Tiene la habilidad del último ejecutado
  { personaje: 'cannibal', texto: 'Lunch', unico: true },
  // Esta noche sabe qué personaje fue ejecutado hoy
  { personaje: 'undertaker', texto: 'Die Today', unico: true },
  // Si se ejecuta a más de un bueno, gana el mal
  { personaje: 'leviathan', texto: 'Good Player Executed', unico: false, soloBueno: true },
];

/** Las casillas de farol, todas vacías. */

export const farolesVacios = (): (string | null)[] => Array.from({ length: NUM_FAROLES }, () => null);


/** La nominación tal como se guarda: los votos que hacen falta se calculan al pedirla. */
/**
 * Lo que un cambio de fase deja atrás y la máquina del tiempo devuelve: al
 * anochecer, la calavera y el récord de votos del día; al amanecer, los
 * despertares y el señalamiento de la noche. Y lo apuntado para las estadísticas.
 */
interface PasoDeFase {
  antes: SalaFase;
  despues: SalaFase;
  seguimiento: InstantaneaSeguimiento;
  marcas?: { asiento: string; votos: number | null }[];
  maximoDelDia?: number | null;
  hilos?: HiloDespertar[];
  senalamiento?: SalaSenalamiento | null;
}

/** Cuántos cambios de fase se recuerdan para volver atrás. */
const PASOS_DE_FASE_MAX = 20;


/**
 * La sala de juego, en memoria: quién está, la mesa y la partida. Se pierde al
 * reiniciar el servidor, como una sala que se vacía. Es la fachada de la sala:
 * las acciones, el chat, las conversaciones y la vista solo hablan con ella, y
 * ella reparte el trabajo entre sus partes (en services/partida/).
 */
export class SalaService {
  /** Quién está en la sala y con qué papel (ver Participantes). */
  private readonly presentes = new Participantes();
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
    ocultarCamarasConversacion: true,
  };
  /** Las nominaciones y votaciones del día. */
  private readonly nominaciones = new Nominaciones({
    mesa: () => this.mesa,
    buscar: (id) => this.buscar(id),
    dia: () => this.faseActual.numero,
    segundosPorFicha: () => this.ajustes.segundosPorFicha,
    sinVoto: (id) => this.sinVoto(id),
    puedeVotarDoble: (id) => this.puedeVotarDoble(id),
    voudonVivo: () => this.voudonVivo(),
    valorDelVoto: (asiento, ocupante) => this.valorDelVoto(asiento, ocupante),
    secreta: () => this.votacionSecreta(),
    alNominar: (desde, hasta) => this.seguimiento.nomina(this.cuentaDelAsiento(desde), this.cuentaDelAsiento(hasta)),
    alVotar: (id) => this.seguimiento.vota(this.cuentaDe(id)),
    alCambiarSola: () => this.alCambiarSola(),
  });
  private revelacionActual: { ganador: SalaAlineamiento; causas: string[]; reveladas: string[] } | null = null;
  /** El gong y el reloj del narrador. */
  private readonly tiempo = new RelojSala();
  /** Los despertares de la noche. */
  private readonly despertados = new Despertares(
    () => this.mesaAlDia(),
    () => this.faseActual,
  );
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
   *
   * Revolutionary: si exactamente dos de esos asientos llevan su recordatorio,
   * les tocan dos personajes del mismo alineamiento (ver mismoAlineamiento).
   */
  repartirBolsa(): void {
    const asientos = this.mesa.filter((a) => !this.llevaViajero(a));
    const revolucionarios = asientos.flatMap((a, i) =>
      a.recordatorios.some((r) => r.personaje === NPC_REVOLUTIONARY) ? [i] : [],
    );
    let personajes = barajar(this.bolsaActual);
    if (revolucionarios.length === 2) {
      personajes = this.mismoAlineamiento(personajes, revolucionarios[0], revolucionarios[1]);
    }
    asientos.forEach((a, i) => {
      a.personaje = personajes[i] ?? null;
      a.alineamiento = null;
      // Un reparto nuevo: quién era cada uno (los «Is The …» del anterior) ya no vale
      a.recordatorios = a.recordatorios.filter((r) => !esIdentidad(r));
      this.identidadAutomatica(a);
    });
  }

  /**
   * Los personajes ya barajados, con dos del mismo alineamiento por su tipo en
   * las posiciones x e y (aldeanos y forasteros, buenos; esbirros y demonios,
   * malvados; los viajeros no cuentan). El par se elige al azar entre todos los
   * posibles, así que sale malvado tan a menudo como pares malvados hay. Los
   * demás siguen en su orden barajado. Sin ningún par posible, los deja igual.
   */
  private mismoAlineamiento(personajes: string[], x: number, y: number): string[] {
    const tipo = (id: string) => this.personaje(id)?.tipo;
    const buenos = personajes.filter((id) => tipo(id) === 'townsfolk' || tipo(id) === 'outsider');
    const malvados = personajes.filter((id) => tipo(id) === 'minion' || tipo(id) === 'demon');
    const pares = (n: number) => (n * (n - 1)) / 2;
    const total = pares(buenos.length) + pares(malvados.length);
    if (total === 0) return personajes;
    const grupo = randomInt(total) < pares(buenos.length) ? buenos : malvados;
    // Dos distintos del grupo, cada uno a una de las dos posiciones
    const [primero, segundo] = barajar(grupo.map((_, i) => i)).slice(0, 2);
    const elegidos = [grupo[primero], grupo[segundo]];
    const resto = [...personajes];
    for (const id of elegidos) resto.splice(resto.indexOf(id), 1);
    return personajes.map((_, i) => (i === x ? elegidos[0] : i === y ? elegidos[1] : resto.shift()!));
  }

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
    return this.presentes.cuentaDe(participanteId);
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
    return this.nominaciones.votaciones();
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
    // Para poder volver (lo que se quita al anochecer y las estadísticas como estaban)
    const paso: PasoDeFase = {
      antes: { ...this.faseActual },
      despues: this.faseActual,
      seguimiento: this.seguimiento.instantanea(),
      marcas: this.mesa.filter((a) => a.marcado).map((a) => ({ asiento: a.id, votos: a.votosMarca })),
      maximoDelDia: this.nominaciones.recordDelDia(),
    };
    if (momento === 'preparacion' || !this.seguimiento.estaEmpezada()) this.seguimiento.empezar(this.fotosDeCuentas());
    else for (const a of this.mesa.filter((x) => x.marcado)) this.seguimiento.ejecutado(this.cuentaDe(a.ocupante));
    this.faseActual = { momento: 'noche', numero: momento === 'preparacion' ? 1 : numero + 1, reinicios };
    // Lo que se señaló de día no sigue de noche (lo verían otros); el reloj tampoco
    this.senalamientoActual = null;
    this.tiempo.quitarReloj();
    this.cerrarNominacion();
    this.desmarcar();
    this.nominaciones.ponerRecordDelDia(null);
    this.recordarPaso({ ...paso, despues: { ...this.faseActual } });
  }

  /**
   * Amanece: el día de la misma noche. Los despertares de la noche se acaban: no
   * se ven de día y la noche siguiente empieza sin ellos.
   */
  amanecer(): void {
    const paso: PasoDeFase = {
      antes: { ...this.faseActual },
      despues: this.faseActual,
      seguimiento: this.seguimiento.instantanea(),
      hilos: this.despertados.instantanea(),
      senalamiento: this.senalamientoActual,
    };
    this.faseActual = { ...this.faseActual, momento: 'dia' };
    // El rol con el que empieza el día cuenta como jugado (los cambios de la noche, no)
    this.seguimiento.anotarRoles(this.fotosDeCuentas());
    this.despertados.cerrarTodos();
    // Lo de la noche no se ve de día (y el reloj se quita)
    this.senalamientoActual = null;
    this.tiempo.quitarReloj();
    this.recordarPaso({ ...paso, despues: { ...this.faseActual } });
  }

  /** Los cambios de fase hechos, para volver atrás (los más antiguos se olvidan). */
  private pasosDeFase: PasoDeFase[] = [];

  private recordarPaso(paso: PasoDeFase): void {
    this.pasosDeFase.push(paso);
    if (this.pasosDeFase.length > PASOS_DE_FASE_MAX) this.pasosDeFase.shift();
  }

  /**
   * La fase a la que se volvería con la máquina del tiempo: del día N, la noche N;
   * de la noche N, el día anterior (de la noche 1, la preparación). null en la preparación.
   */
  faseAnterior(): SalaFase | null {
    const { momento, numero, reinicios } = this.faseActual;
    if (momento === 'preparacion') return null;
    if (momento === 'dia') return { momento: 'noche', numero, reinicios };
    return numero <= 1 ? { momento: 'preparacion', numero: 0, reinicios } : { momento: 'dia', numero: numero - 1, reinicios };
  }

  /**
   * La máquina del tiempo del narrador: vuelve a la fase anterior (ver faseAnterior),
   * por si se pasó de fase antes de tiempo. Si fue este mismo cambio el que se
   * hizo, devuelve lo que se quitó: al volver al día, la calavera y el récord de
   * votos; a la noche, sus despertares (con lo que se dijeron) y su señalamiento; y
   * las estadísticas, como estaban. Lo demás de la partida (muertes, fichas,
   * recordatorios) se queda como está. Se cierra la nominación abierta. No comprueba permisos.
   */
  volverAtras(): boolean {
    const anterior = this.faseAnterior();
    if (!anterior) return false;
    const igual = (a: SalaFase, b: SalaFase) => a.momento === b.momento && a.numero === b.numero && a.reinicios === b.reinicios;
    const ultimo = this.pasosDeFase[this.pasosDeFase.length - 1];
    const paso = ultimo && igual(ultimo.despues, this.faseActual) && igual(ultimo.antes, anterior) ? this.pasosDeFase.pop()! : null;
    this.cerrarNominacion();
    this.senalamientoActual = null;
    this.tiempo.quitarReloj();
    this.faseActual = anterior;
    if (anterior.momento === 'dia') {
      // Al día: sin los despertares de la noche (como al amanecer) y, si se puede, con su calavera
      this.despertados.cerrarTodos();
      this.nominaciones.ponerRecordDelDia(paso?.maximoDelDia ?? null);
      for (const m of paso?.marcas ?? []) this.marcar(m.asiento, true, m.votos);
    } else if (anterior.momento === 'noche') {
      this.desmarcar();
      this.nominaciones.ponerRecordDelDia(null);
      if (paso?.hilos) this.despertados.restaurar(paso.hilos);
      if (paso?.senalamiento) this.senalamientoActual = paso.senalamiento;
    }
    if (paso) this.seguimiento.restaurar(paso.seguimiento);
    else if (anterior.momento === 'preparacion') this.seguimiento.reiniciar();
    return true;
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

  // Los despertares: los lleva Despertares

  despertares(): SalaDespertar[] {
    return this.despertados.despertares();
  }

  hayDespertar(asientoId: string): boolean {
    return this.despertados.hayDespertar(asientoId);
  }

  asientoDespiertoDe(participanteId: string): string | null {
    return this.despertados.asientoDespiertoDe(participanteId);
  }

  despertar(asientoId: string): string | null {
    return this.despertados.despertar(asientoId);
  }

  enviarDespertar(asientoId: string, mensaje: Omit<MensajeDespertar, 'id' | 'hora' | 'fase'>): void {
    this.despertados.enviar(asientoId, mensaje);
  }

  /**
   * Deja la partida como al principio, en la preparación: sin registro de
   * votaciones, todas las fichas vivas, sin personaje y sin calavera, la bolsa
   * vacía, sin nominación y nadie con acceso al grimorio (las peticiones
   * pendientes siguen). Los jugadores siguen en sus asientos.
   */
  limpiarGrimorio(): void {
    this.cerrarNominacion();
    this.senalamientoActual = null;
    this.tiempo.quitarReloj();
    this.pasosDeFase = [];
    this.seguimiento.reiniciar();
    // Otra partida: los NPCs del guion, en juego (si alguno se quitó, vuelve); los
    // demás que se pusieron a mano, siguen
    this.npcsActuales = [...this.npcsActuales, ...this.npcsDelGuion().filter((id) => !this.npcsActuales.includes(id))];
    this.nominaciones.olvidarTodo();
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
    this.presentes.olvidarGrimorios();
    this.despertados.cerrarTodos();
    this.recordatorios = {};
    this.faseActual = { momento: 'preparacion', numero: 0, reinicios: this.faseActual.reinicios + 1 };
  }

  /**
   * Las votaciones son secretas: el Organ Grinder está en juego (de verdad: un
   * Borracho que se cree Organ Grinder no cuenta), vivo y sin un recordatorio
   * «Drunk» en su ficha (el suyo, al elegir estar borracho, o el de otro).
   */
  votacionSecreta(): boolean {
    const og = this.mesaAlDia().find((a) => !a.muerto && this.identidad(a) === ESBIRRO_ORGAN_GRINDER);
    return !!og && !og.recordatorios.some((r) => /^drunk$/i.test(r.texto.trim()));
  }

  // Las nominaciones y votaciones: las lleva Nominaciones

  nominacion(): SalaNominacion | null {
    return this.nominaciones.nominacion();
  }

  gastadosAlVotar(): Set<string> | null {
    return this.nominaciones.gastadosAlVotar();
  }

  elegirVotosNecesarios(votos: number | null): void {
    this.nominaciones.elegirVotosNecesarios(votos);
  }

  nominar(desde: string, hasta: string): void {
    this.nominaciones.nominar(desde, hasta);
  }

  cerrarNominacion(): void {
    this.nominaciones.cerrarNominacion();
  }

  hayVotacion(): boolean {
    return this.nominaciones.hayVotacion();
  }

  iniciarCuentaAtras(ahora: number): void {
    this.nominaciones.iniciarCuentaAtras(ahora);
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

  // El gong y el reloj: los lleva RelojSala

  gong(): number | null {
    return this.tiempo.gong();
  }

  sonarGong(): void {
    this.tiempo.sonarGong();
  }

  reloj(): SalaReloj | null {
    return this.tiempo.reloj();
  }

  ponerReloj(segundos: number, mensaje: string): void {
    this.tiempo.ponerReloj(segundos, mensaje);
  }

  relojEnMarcha(): boolean {
    return this.tiempo.relojEnMarcha();
  }

  terminarReloj(): void {
    this.tiempo.terminarReloj();
  }

  quitarReloj(): void {
    this.tiempo.quitarReloj();
  }

  /** El señalamiento (ver SalaEstado.senalamiento), o null. */
  private senalamientoActual: SalaSenalamiento | null = null;

  /**
   * El señalamiento, o null. Al leerlo se pone al día: los asientos que ya no
   * existen salen, y con la cuenta atrás acabada queda congelado.
   */
  senalamiento(): SalaSenalamiento | null {
    const s = this.senalamientoActual;
    if (!s) return null;
    const ids = new Set(this.mesaAlDia().map((a) => a.id));
    s.senaladores = s.senaladores.filter((id) => ids.has(id));
    s.objetivos = s.objetivos.filter((id) => ids.has(id));
    for (const [desde, hasta] of Object.entries(s.senales)) if (!ids.has(desde) || !ids.has(hasta)) delete s.senales[desde];
    if (!s.congelado && s.fin !== null && Date.now() >= s.fin) s.congelado = true;
    return { ...s, senaladores: [...s.senaladores], objetivos: [...s.objetivos], senales: { ...s.senales } };
  }

  /**
   * Si este participante ve el señalamiento: de día, todos; de noche, los
   * narradores, los visitantes que ven el grimorio y los jugadores sentados en
   * un asiento que señala.
   */
  veSenalamiento(participante: SalaParticipante): boolean {
    const s = this.senalamientoActual;
    if (!s) return false;
    if (s.publico || participante.rol === 'narrador') return true;
    if (participante.rol === 'visitante') return participante.accesoGrimorio === 'concedido';
    const asiento = this.asientoDe(participante.id);
    return !!asiento && s.senaladores.includes(asiento.id);
  }

  /**
   * Mientras hay un señalamiento (también congelado, hasta que el narrador lo quite),
   * quien lo ve no levanta la mano: las manos de señalar van en las fichas. De noche,
   * quien no lo ve sigue igual (así no sabe que lo hay).
   */
  manosBloqueadas(participante: SalaParticipante): boolean {
    return this.veSenalamiento(participante);
  }

  /**
   * Empieza un señalamiento (sustituye al que hubiera). Sin asientos que señalan
   * o que se pueden señalar, todos. De día es público; de noche se despierta a
   * los que señalan (ver despertar). `segundos` null: sin cuenta atrás. No
   * valida los datos ni comprueba permisos.
   */
  empezarSenalamiento(datos: {
    tipo?: SalaSenalamiento['tipo'];
    mensaje: string;
    segundos: number | null;
    senaladores: string[];
    objetivos: string[];
  }): void {
    const todos = this.mesaAlDia().map((a) => a.id);
    const deLaMesa = (ids: string[]) => (ids.length ? todos.filter((id) => ids.includes(id)) : todos);
    const publico = this.faseActual.momento !== 'noche';
    const inicio = Date.now();
    this.senalamientoActual = {
      id: randomUUID(),
      tipo: datos.tipo ?? 'normal',
      mensaje: datos.mensaje,
      senaladores: deLaMesa(datos.senaladores),
      objetivos: deLaMesa(datos.objetivos),
      publico,
      inicio,
      fin: datos.segundos === null ? null : inicio + datos.segundos * 1000,
      congelado: false,
      senales: {},
    };
    if (!publico) for (const id of this.senalamientoActual.senaladores) this.despertar(id);
    // Quien lo ve baja la mano (no se puede levantar mientras dure)
    for (const participante of this.presentes.participantes()) {
      if (participante.manoLevantada && this.veSenalamiento(participante)) this.levantarMano(participante.id, false);
    }
  }

  /**
   * El jugador de un asiento que señala, señala a otro (null: deja de señalar).
   * Con Lil' Monsta, cuando todos los esbirros sentados señalan al mismo, se
   * congela y ese lleva su «Is The Demon». Devuelve el error, si lo hay.
   */
  senalar(participanteId: string, objetivo: string | null): string | null {
    const s = this.senalamiento() && this.senalamientoActual!;
    if (!s) return 'No hay ningún señalamiento.';
    if (s.congelado) return 'El señalamiento ya ha terminado.';
    const asiento = this.asientoDe(participanteId);
    if (!asiento || !s.senaladores.includes(asiento.id)) return 'No te toca señalar.';
    if (objetivo === null) {
      delete s.senales[asiento.id];
      return null;
    }
    if (!s.objetivos.includes(objetivo)) return 'Ese asiento no se puede señalar.';
    s.senales[asiento.id] = objetivo;
    if (s.tipo === 'lilmonsta') this.resolverLilmonsta(s);
    return null;
  }

  /** Lil' Monsta: si todos los esbirros sentados señalan al mismo, ese lo cuida. */
  private resolverLilmonsta(s: SalaSenalamiento): void {
    const sentados = this.mesaAlDia().filter((a) => a.ocupante && s.senaladores.includes(a.id));
    const elegidos = new Set(sentados.map((a) => s.senales[a.id]));
    if (sentados.length === 0 || elegidos.size !== 1) return;
    const [cuidador] = [...elegidos];
    if (!cuidador) return;
    s.congelado = true;
    // Su «Is The Demon» pasa al que lo cuida (solo hay uno)
    const recordatorios = this.personaje(DEMONIO_LILMONSTA)?.recordatorios ?? [];
    const indice = recordatorios.findIndex((t) => /^is the demon$/i.test(t.trim()));
    if (indice < 0) return;
    for (const a of this.mesa) {
      a.recordatorios = a.recordatorios.filter((r) => !(r.personaje === DEMONIO_LILMONSTA && r.indice === indice));
    }
    this.ponerRecordatorio(cuidador, { personaje: DEMONIO_LILMONSTA, indice, texto: recordatorios[indice] });
  }

  /** Quita el señalamiento. No comprueba permisos. */
  terminarSenalamiento(): void {
    this.senalamientoActual = null;
  }

  /**
   * Se puede empezar Lil' Monsta: es de noche, el guion lo trae, ninguna ficha
   * es un demonio y hay un esbirro más de los que tocan (el que hace de demonio).
   * Devuelve los asientos de los esbirros vivos, o null si no.
   */
  esbirrosLilmonsta(): string[] | null {
    if (this.faseActual.momento !== 'noche' || !this.guionActual?.personajes.some((p) => p.id === DEMONIO_LILMONSTA)) return null;
    const tipo = (a: SalaAsiento) => (a.personaje ? this.personaje(a.personaje)?.tipo : undefined);
    const mesa = this.mesaAlDia();
    if (mesa.some((a) => tipo(a) === 'demon')) return null;
    const esbirros = mesa.filter((a) => tipo(a) === 'minion');
    const tocan = this.distribucion().esbirros;
    if (esbirros.length === 0 || (tocan !== null && esbirros.length <= tocan)) return null;
    const vivos = esbirros.filter((a) => !a.muerto).map((a) => a.id);
    return vivos.length ? vivos : null;
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
  empezarRevelacion(ganador: SalaAlineamiento, causas: string[] = [], esbirros: Record<string, string> = {}): void {
    this.cerrarNominacion();
    this.revelacionActual = { ganador, causas, reveladas: [] };
    // Se acaba la partida: se guarda lo de cada uno (si se había empezado a jugar). Las
    // causas de esbirro (la Doncel cazada), para la cuenta del esbirro que eligió el narrador
    const deCadaUno = causas.map((id) => {
      const asiento = esbirros[id];
      if (!asiento) return { id };
      return { id, userId: this.cuentaDe(this.mesa.find((a) => a.id === asiento)?.ocupante ?? null) };
    });
    const jugadores = this.seguimiento.estaEmpezada() ? this.seguimiento.terminar(this.fotosDeCuentas(), ganador, deCadaUno) : [];
    const narradores = this.presentes
      .narradores()
      .map((p) => this.cuentaDe(p.id))
      .filter((id): id is string => !!id);
    if (jugadores.length > 0 || narradores.length > 0) {
      // La mesa entera, invitados incluidos, para el historial
      const mesa = this.mesaAlDia().map((a, i) => {
        const personaje = this.identidad(a);
        return {
          numero: i + 1,
          nombre: a.ocupante ? (this.buscar(a.ocupante)?.nombre ?? null) : null,
          userId: this.cuentaDe(a.ocupante),
          personaje,
          ficha: a.personaje && a.personaje !== personaje ? a.personaje : null,
          alineamiento: this.alineamientoEfectivo(a),
          muerto: a.muerto,
        };
      });
      const narradoresNombres = this.presentes.narradores().map((p) => p.nombre);
      this.alTerminarPartida({
        mesa,
        narradoresNombres,
        npcs: [...this.npcsActuales],
        votaciones: this.votaciones(),
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

  /**
   * Ejecuta al de un asiento (el que lleva la calavera): muere como al matarlo y,
   * por cada personaje que funciona con las ejecuciones (RECORDATORIOS_EJECUCION)
   * en juego y vivo, se le pone su recordatorio. Luego anochece, salvo con el
   * Carnicero en juego y vivo (puede haber otra ejecución) o si quedan solo dos
   * jugadores vivos (`final`): entonces decide el narrador si se va a la noche o
   * se revela el grimorio. Devuelve si ha anochecido y si quedan dos, o null si
   * el asiento no existe. No comprueba permisos.
   */
  ejecutar(asientoId: string): { anochece: boolean; final: boolean } | null {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return null;
    const bueno = this.alineamientoEfectivo(asiento) === 'bueno';
    // En juego y vivo: en la ficha (el Borracho que se cree Enterrador también) o de verdad
    const vivoEnJuego = (id: string) =>
      this.mesa.some((a) => a !== asiento && !a.muerto && (a.personaje === id || this.identidad(a) === id));
    for (const { personaje, texto, unico, soloBueno } of RECORDATORIOS_EJECUCION) {
      if ((soloBueno && !bueno) || !vivoEnJuego(personaje)) continue;
      const indice = this.personaje(personaje)?.recordatorios.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1;
      if (indice < 0) continue;
      const delPersonaje = (r: SalaRecordatorio) => r.personaje === personaje && r.indice === indice;
      if (unico) for (const a of this.mesa) a.recordatorios = a.recordatorios.filter((r) => !delPersonaje(r));
      asiento.recordatorios.push({ id: randomUUID(), personaje, indice, texto: this.personaje(personaje)!.recordatorios[indice] });
    }
    this.seguimiento.ejecutado(this.cuentaDe(asiento.ocupante));
    this.cambiarVida(asiento.id, true);
    // Los vivos que quedan: los asientos (también los libres, que cuentan como jugadores)
    // sin muerte, sin contar a los viajeros
    const vivos = this.mesa.filter((a) => !a.muerto && !a.muertePendiente && !this.llevaViajero(a)).length;
    const final = vivos <= 2;
    const anochece = !final && !this.mesa.some((a) => !a.muerto && this.identidad(a) === VIAJERO_BUTCHER);
    if (anochece) this.irANoche();
    return { anochece, final };
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
    const orden = barajar(mesa.map((_, i) => i));
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
    this.despertados.remapear(a);
    if (this.revelacionActual) this.revelacionActual.reveladas = this.revelacionActual.reveladas.map(a);
    this.nominaciones.remapear(a);
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


  // Quién está en la sala: lo lleva Participantes (ver allí lo que hace cada uno)

  conectar(socketId: string, clienteId: string | null, llegada: SalaLlegada, conexionViva: (socketId: string) => boolean) {
    return this.presentes.conectar(socketId, clienteId, llegada, conexionViva);
  }

  cambiarPartidasJugadas(userId: string, partidas: number): void {
    this.presentes.cambiarPartidasJugadas(userId, partidas);
  }

  salir(clave: string, socketId: string): void {
    this.presentes.salir(clave, socketId);
  }

  expulsar(id: string): string | null {
    return this.presentes.expulsar(id);
  }

  desconectar(clave: string, socketId: string, alExpulsar: () => void): void {
    this.presentes.desconectar(clave, socketId, alExpulsar);
  }

  participanteDe(clave: string): SalaParticipante | undefined {
    return this.presentes.participanteDe(clave);
  }

  buscar(id: string): SalaParticipante | undefined {
    return this.presentes.buscar(id);
  }

  nombreBase(id: string): string | undefined {
    return this.presentes.nombreBase(id);
  }

  nombreOcupado(nombre: string, salvoId: string): boolean {
    return this.presentes.nombreOcupado(nombre, salvoId);
  }

  nombreLibreParaInvitado(nombre: string, clienteId: string | null, conexionViva: (socketId: string) => boolean): boolean {
    return this.presentes.nombreLibreParaInvitado(nombre, clienteId, conexionViva);
  }

  cambiarAvatar(id: string, elegido: string | null): void {
    this.presentes.cambiarAvatar(id, elegido);
  }

  renombrar(id: string, nombre: string): void {
    this.presentes.renombrar(id, nombre);
  }

  hayNarrador(): boolean {
    return this.presentes.hayNarrador();
  }

  cambiarRol(id: string, rol: SalaRol): void {
    this.presentes.cambiarRol(id, rol);
  }

  cambiarAccesoGrimorio(id: string, acceso: SalaAccesoGrimorio): void {
    this.presentes.cambiarAccesoGrimorio(id, acceso);
  }

  cambiarSonido(id: string, sinSonido: boolean): void {
    this.presentes.cambiarSonido(id, sinSonido);
  }

  levantarMano(id: string, levantada: boolean, dos = false): void {
    this.presentes.levantarMano(id, levantada, dos);
  }

  elegirFormaMano(id: string, forma: SalaFormaMano): void {
    this.presentes.elegirFormaMano(id, forma);
  }

  elegirEstiloMano(id: string, estilo: string): void {
    this.presentes.elegirEstiloMano(id, estilo);
  }

  participantes(): SalaParticipante[] {
    return this.presentes.participantes();
  }

  conexiones(): { socketId: string; clave: string; id: string }[] {
    return this.presentes.conexiones();
  }
}

/** Las casillas con `personajeId` en `posicion` (fuera de cualquier otra en la que estuviera). */
function ponerEnCasilla(casillas: (string | null)[], posicion: number, personajeId: string | null): (string | null)[] {
  const nuevas = casillas.map((id) => (personajeId && id === personajeId ? null : id));
  nuevas[posicion] = personajeId;
  return nuevas;
}
