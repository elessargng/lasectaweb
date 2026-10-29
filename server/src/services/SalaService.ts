import { randomUUID } from 'crypto';
import {
  SalaAccesoGrimorio,
  SalaAlineamiento,
  SalaRecordatorio,
  SalaAsiento,
  SalaConfiguracion,
  SalaDistribucion,
  SalaFase,
  SalaDespertar,
  SalaFormaMano,
  SalaNominacion,
  SalaParticipante,
  SalaRegistroVotacion,
  SalaReloj,
  SalaSenalamiento,
  SalaRevelacion,
  SalaRol,
  RECORDATORIO_TEXTO,
  SalaFichaEnviada,
  SalaGrimorioEnviado,
  SalaEleccionDespertar,
  SalaEnvioDespertar,
  SalaHabilidadNoche,
  SalaNarradorVirtual,
} from '../contrato/sala';
import { GuionResuelto, PersonajeDeGuion } from '../types/guiones';
import { repartoPara } from './partida/distribucion';
import { Participantes, type SalaLlegada } from './partida/Participantes';
import { NarradorVirtualEnMemoria, type NarradorVirtualRepository } from '../repositories/NarradorVirtualRepository';
import {
  NPC_GARDENER,
} from './partida/personajesEspeciales';
import { RelojSala } from './partida/RelojSala';
import { Despertares, type HiloDespertar } from './partida/Despertares';
import { DespertarGuiado } from './partida/DespertarGuiado';
import { habilidadesDelGuion } from './partida/habilidades';
import { Nominaciones } from './partida/Nominaciones';
import { Faroles, farolesVacios } from './partida/Faroles';
import { Senalamientos } from './partida/Senalamientos';
import { Revelacion } from './partida/Revelacion';
import { Npcs } from './partida/Npcs';
import { Entregas, type FichaEntregada } from './partida/Entregas';
import { Bolsa } from './partida/Bolsa';
import { PASOS_DE_FASE_MAX, type EventoPartida, type FotoAsiento, type OyentePartida } from './partida/eventos';
import { barajar } from './partida/azar';
import { Reglas } from './partida/reglas';
import type { ContextoReglas, RegistroAlNominar } from './partida/reglas/ReglaPersonaje';
import { voudonVivo } from './partida/reglas/voudon';
import { cuidadorLilmonsta, DEMONIO_LILMONSTA, esbirrosLilmonsta, recordatorioLilmonsta } from './partida/reglas/lilMonsta';

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
  nota: null,
  farolEnUso: null,
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

/**
 * Al anunciar una muerte de noche, el «Dead» con el que la marcó quien lo mató (el
 * demonio, el Asesino…) ya no hace falta: se quita (no los de texto propio).
 */
function quitarMarcaDeMuerte(asiento: SalaAsiento): void {
  asiento.recordatorios = asiento.recordatorios.filter((r) => r.personaje === RECORDATORIO_TEXTO || !/^dead$/i.test(r.texto.trim()));
}

/**
 * Lo que un cambio de fase deja atrás y la máquina del tiempo devuelve: al
 * anochecer, la calavera y el récord de votos del día; al amanecer, los
 * despertares y el señalamiento de la noche.
 */
interface PasoDeFase {
  antes: SalaFase;
  despues: SalaFase;
  marcas?: { asiento: string; votos: number | null }[];
  maximoDelDia?: number | null;
  hilos?: HiloDespertar[];
  senalamiento?: SalaSenalamiento | null;
}

/**
 * La sala de juego, en memoria: quién está, la mesa y la partida. Se pierde al
 * reiniciar el servidor, como una sala que se vacía. Es la fachada de la sala:
 * las acciones, el chat, las conversaciones y la vista solo hablan con ella, y
 * ella reparte el trabajo entre sus partes (en services/partida/).
 */
export class SalaService {
  /** Quién está en la sala y con qué papel (ver Participantes). */
  private readonly presentes = new Participantes();

  constructor(
    /** Dónde se guarda el narrador virtual de la sala (ver NarradorVirtualService). */
    private readonly narradoresVirtuales: NarradorVirtualRepository = new NarradorVirtualEnMemoria(),
  ) {}
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
  /** Lo que las reglas de los personajes pueden consultar de la partida. */
  private readonly contextoReglas: ContextoReglas = {
    mesa: () => this.mesa,
    identidad: (asiento) => this.identidad(asiento),
    alineamiento: (asiento) => this.alineamientoEfectivo(asiento),
    personaje: (id) => this.personaje(id),
  };
  /** Las reglas de los personajes (ver reglas/). */
  private readonly reglas = new Reglas(this.contextoReglas);
  /** Las nominaciones y votaciones del día. */
  private readonly nominaciones = new Nominaciones({
    mesa: () => this.mesa,
    buscar: (id) => this.buscar(id),
    bajarManos: () => this.presentes.bajarManos(),
    cuentaDe: (id) => this.cuentaDe(id),
    llevaViajero: (asiento) => {
      const id = this.identidad(asiento);
      return !!id && this.esViajero(id);
    },
    dia: () => this.faseActual.numero,
    segundosPorFicha: () => this.ajustes.segundosPorFicha,
    sinVoto: (id) => this.sinVoto(id),
    votaSinGastar: (asiento) => this.reglas.votaSinGastar(asiento),
    mayoria: (vivos) => this.reglas.mayoria(vivos),
    valorDelVoto: (asiento, ocupante) => this.reglas.valorDelVoto(asiento, ocupante.dosManos),
    secreta: () => this.votacionSecreta(),
    alNominar: (desde, hasta) =>
      this.avisar({ tipo: 'nominacion', nomina: this.cuentaDelAsiento(desde), nominado: this.cuentaDelAsiento(hasta) }),
    alVotar: (cuenta) => this.avisar({ tipo: 'voto', userId: cuenta }),
    alDesvotar: (cuenta) => this.avisar({ tipo: 'desvoto', userId: cuenta }),
    alExpulsar: (asientoId) => this.cambiarVida(asientoId, true),
    alCambiarSola: () => this.alCambiarSola(),
  });
  /** El gong y el reloj del narrador. */
  private readonly tiempo = new RelojSala();
  /** Los despertares de la noche. */
  private readonly despertados = new Despertares(
    () => this.mesaAlDia(),
    () => this.faseActual,
  );
  /** El despertar guiado desde el orden de noche (ver DespertarGuiado). */
  private readonly guiado = new DespertarGuiado({
    ctx: { ...this.contextoReglas, faroles: () => this.faroles() },
    habilidades: () => habilidadesDelGuion(this.guionActual?.edicion ?? null),
    noche: () => this.faseActual.momento === 'noche',
    despertar: (asientoId) => this.despertar(asientoId),
    mandar: (asientoId, envio, eleccion) => this.mandarDelNarrador(asientoId, envio, { eleccion, guiado: true }),
    porEntender: (asientoId) => this.despertados.porEntender(asientoId),
    ponerRecordatorio: (asientoId, personaje, texto) => this.ponerRecordatorioDe(asientoId, personaje, texto),
    matarDeNoche: (asientoId) => this.cambiarVida(asientoId, true),
    enviarGrimorio: (asientoId) => this.enviarGrimorioDeLaMesa(asientoId),
    cambiarPersonaje: (asientoId, personaje) => this.cambiarPersonaje(asientoId, personaje),
  });
  /** Los faroles para el demonio (del narrador y de cada asiento). */
  private readonly farolesDemonio = new Faroles(() => this.mesaAlDia());
  /** El final de la partida: qué bando ha ganado y qué fichas se han revelado. */
  private readonly final = new Revelacion(() => this.mesa);
  /** Los NPCs en juego y lo que traen (Bootlegger, Storm Catcher, silencio). */
  private readonly npcsPartida = new Npcs(() => this.guionActual);
  /** Lo entregado a cada jugador y los grimorios enviados. */
  private readonly entregas = new Entregas(() => this.mesa);
  /** Los personajes para repartir. */
  private readonly bolsaPartida = new Bolsa((id) => this.esViajero(id));
  /** El señalamiento en curso. */
  private readonly senales = new Senalamientos({
    mesa: () => this.mesaAlDia(),
    fase: () => this.faseActual,
    asientoDe: (id) => this.asientoDe(id),
    despertar: (asientoId) => void this.despertar(asientoId),
  });
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
    this.bolsaPartida.vaciar();
    this.npcsPartida.alCambiarGuion();
    this.entregas.retenerFichas(false);
    this.farolesDemonio.vaciar();
  }

  /** El reparto dado por bueno a mano (ver SalaEstado.setupAceptado). */
  private setupAceptadoActual: string | null = null;

  setupAceptado(): string | null {
    return this.setupAceptadoActual;
  }

  aceptarSetup(firma: string | null): void {
    this.setupAceptadoActual = firma;
  }

  // Los NPCs y lo que traen: los lleva Npcs

  npcs(): string[] {
    return this.npcsPartida.npcs();
  }

  /** Pone en juego un NPC, o lo quita si ya estaba. No comprueba que sea del guion. */
  alternarNpc(personajeId: string): void {
    this.npcsPartida.alternar(personajeId);
    // Sin el Gardener ya no hay nada que retener: los personajes se entregan (como estén ahora)
    if (this.entregas.fichasRetenidas() && !this.npcActivo(NPC_GARDENER)) this.entregarFichas();
  }

  npcActivo(id: string): boolean {
    return this.npcsPartida.activo(id);
  }

  bootlegger(): string[] {
    return this.npcsPartida.bootlegger();
  }

  escribirBootlegger(reglas: string[] | null): void {
    this.npcsPartida.escribirBootlegger(reglas);
  }

  rolStormcatcher(): string | null {
    return this.npcsPartida.rolStormcatcher();
  }

  nombrarStormcatcher(personajeId: string | null): void {
    this.npcsPartida.nombrarStormcatcher(personajeId);
  }

  silencio(): boolean {
    return this.npcsPartida.silencio();
  }

  pedirSilencio(activo: boolean): void {
    this.npcsPartida.pedirSilencio(activo);
  }

  // Lo entregado a los jugadores y los grimorios enviados: lo lleva Entregas

  entregarFichas(): void {
    this.entregas.entregarFichas();
  }

  comunicarFicha(asientoId: string, personajes: string[], alineamiento: SalaAlineamiento | null): void {
    this.entregas.comunicarFicha(asientoId, personajes, alineamiento);
  }

  fichaEntregada(asientoId: string): FichaEntregada {
    return this.entregas.fichaEntregada(asientoId);
  }

  fichasRetenidas(): boolean {
    return this.entregas.fichasRetenidas();
  }

  retenerFichas(retenidas: boolean): void {
    this.entregas.retenerFichas(retenidas);
  }

  enviarGrimorio(asientoId: string, fichas: SalaFichaEnviada[], faroles: string[] = []): void {
    this.entregas.enviarGrimorio(asientoId, fichas, faroles);
  }

  grimorioRecibidoPor(participanteId: string): SalaGrimorioEnviado | null {
    return this.entregas.grimorioRecibidoPor(participanteId);
  }

  // Los faroles: los lleva Faroles

  faroles(): (string | null)[] {
    return this.farolesDemonio.faroles();
  }

  ponerFarol(posicion: number, personajeId: string | null): void {
    this.farolesDemonio.ponerFarol(posicion, personajeId);
  }

  ponerFarolAsiento(asientoId: string, posicion: number, personajeId: string | null): void {
    this.farolesDemonio.ponerFarolAsiento(asientoId, posicion, personajeId);
  }

  copiarFaroles(asientoId: string, personajes: string[]): void {
    this.farolesDemonio.copiarFaroles(asientoId, personajes);
  }

  /** El farol que dice usar el jugador de un asiento (uno de los suyos), o null. Devuelve el error, si lo hay. */
  usarFarol(asientoId: string, personajeId: string | null): string | null {
    return this.farolesDemonio.usarFarol(asientoId, personajeId);
  }

  /** El asiento en el que se sienta un participante, o null. */
  asientoDe(participanteId: string): SalaAsiento | null {
    return this.mesaAlDia().find((a) => a.ocupante === participanteId) ?? null;
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

  // La bolsa: la lleva Bolsa

  bolsa(): string[] {
    return this.bolsaPartida.bolsa();
  }

  alternarEnBolsa(personajeId: string): void {
    this.bolsaPartida.alternar(personajeId);
  }

  ponerEnBolsa(personajeId: string, cantidad: number): void {
    this.bolsaPartida.poner(personajeId, cantidad);
  }

  reemplazarBolsa(personajes: string[]): void {
    this.bolsaPartida.reemplazar(personajes);
  }

  vaciarBolsa(): void {
    this.bolsaPartida.vaciar();
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
    return !!id && this.esViajero(id) && !this.bolsaPartida.contiene(id);
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

  /**
   * El reparto de la partida: los jugadores (asientos, sin los viajeros: los
   * puestos a mano y los de la bolsa) y cuántos de cada tipo (ver repartoPara).
   */
  distribucion(): SalaDistribucion {
    const viajeros = this.mesa.filter((a) => this.llevaViajero(a)).length + this.bolsaPartida.viajeros();
    const jugadores = Math.max(0, this.mesa.length - viajeros);
    const reparto = repartoPara(jugadores);
    // Los muertos con sudario (público; la muerte pendiente aún no cuenta). Un viajero
    // de la bolsa aún sin repartir está vivo
    const muertos = this.mesa.filter((a) => a.muerto);
    const viajerosMuertos = muertos.filter((a) => {
      const id = this.identidad(a);
      return !!id && this.esViajero(id);
    }).length;
    return {
      jugadores,
      jugadoresVivos: Math.max(0, jugadores - (muertos.length - viajerosMuertos)),
      viajeros,
      viajerosVivos: Math.max(0, viajeros - viajerosMuertos),
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
   * Las reglas pueden cambiar el reparto (el Revolutionary: ver reglas/revolucionario.ts).
   */
  repartirBolsa(): void {
    const asientos = this.mesa.filter((a) => !this.llevaViajero(a));
    const personajes = this.reglas.repartir(asientos, barajar(this.bolsaPartida.bolsa()));
    asientos.forEach((a, i) => {
      a.personaje = personajes[i] ?? null;
      a.alineamiento = null;
      // Un reparto nuevo: quién era cada uno (los «Is The …» del anterior) ya no vale
      a.recordatorios = a.recordatorios.filter((r) => !esIdentidad(r));
      this.identidadAutomatica(a);
    });
  }

  /**
   * Se llama cuando la sala cambia sola, sin que nadie pida nada (la votación
   * avanza con el tiempo): quien la usa manda el estado a todos.
   */
  alCambiarSola: () => void = () => {};

  /** Quienes escuchan lo que pasa en la partida (ver eventos.ts). */
  private oyentes: OyentePartida[] = [];

  /**
   * Para enterarse de lo que pasa en la partida (las estadísticas, por ejemplo).
   * Hay que suscribirse desde el principio. Devuelve cómo dejar de escuchar.
   */
  suscribir(oyente: OyentePartida): () => void {
    this.oyentes.push(oyente);
    return () => {
      this.oyentes = this.oyentes.filter((o) => o !== oyente);
    };
  }

  private avisar(evento: EventoPartida): void {
    for (const oyente of this.oyentes) oyente(evento);
  }

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

  /** Cómo está ahora la mesa, asiento a asiento (para quien escucha la partida). */
  private fotoDeLaMesa(): FotoAsiento[] {
    return this.mesaAlDia().map((a, i) => {
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
    // De noche no se nomina: la palabra vuelve a ser de todos
    this.palabraDe = null;
    const { momento, numero, reinicios } = this.faseActual;
    // Para poder volver (lo que se quita al anochecer)
    const paso: PasoDeFase = {
      antes: { ...this.faseActual },
      despues: this.faseActual,
      marcas: this.mesa.filter((a) => a.marcado).map((a) => ({ asiento: a.id, votos: a.votosMarca })),
      maximoDelDia: this.nominaciones.recordDelDia(),
    };
    this.avisar({
      tipo: 'anochece',
      desdePreparacion: momento === 'preparacion',
      mesa: this.fotoDeLaMesa(),
      conCalavera: this.mesa.filter((a) => a.marcado).flatMap((a) => this.cuentaDe(a.ocupante) ?? []),
    });
    this.faseActual = { momento: 'noche', numero: momento === 'preparacion' ? 1 : numero + 1, reinicios };
    // Otra noche: el despertar guiado empieza de cero
    this.guiado.olvidar();
    // Lo que se señaló de día no sigue de noche (lo verían otros); el reloj tampoco
    this.senales.terminar();
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
      hilos: this.despertados.instantanea(),
      senalamiento: this.senales.instantanea(),
    };
    this.faseActual = { ...this.faseActual, momento: 'dia' };
    this.avisar({ tipo: 'amanece', mesa: this.fotoDeLaMesa() });
    this.despertados.cerrarTodos();
    // Lo de la noche no se ve de día (y el reloj se quita)
    this.senales.terminar();
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
   * votos; a la noche, sus despertares (con lo que se dijeron) y su señalamiento
   * (y quien escucha la partida deshace lo de ese cambio). Lo demás de la partida (muertes, fichas,
   * recordatorios) se queda como está. Se cierra la nominación abierta. No comprueba permisos.
   */
  volverAtras(): boolean {
    const anterior = this.faseAnterior();
    if (!anterior) return false;
    const igual = (a: SalaFase, b: SalaFase) => a.momento === b.momento && a.numero === b.numero && a.reinicios === b.reinicios;
    const ultimo = this.pasosDeFase[this.pasosDeFase.length - 1];
    const paso = ultimo && igual(ultimo.despues, this.faseActual) && igual(ultimo.antes, anterior) ? this.pasosDeFase.pop()! : null;
    this.cerrarNominacion();
    this.senales.terminar();
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
      if (paso?.senalamiento) this.senales.restaurar(paso.senalamiento);
    }
    this.avisar({ tipo: 'vueltaAtras', deshace: !!paso, aPreparacion: anterior.momento === 'preparacion' });
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

  enviarDespertar(asientoId: string, mensaje: Parameters<Despertares['enviar']>[1]): void {
    this.despertados.enviar(asientoId, mensaje);
  }

  /**
   * Manda algo del narrador a un asiento despierto (`guiado`: desde el despertar guiado);
   * con «Tú eres», su ficha pasa a ser la que se le dice.
   */
  mandarDelNarrador(
    asientoId: string,
    envio: SalaEnvioDespertar,
    { eleccion, guiado = false }: { eleccion?: SalaEleccionDespertar; guiado?: boolean } = {},
  ): void {
    this.enviarDespertar(asientoId, { ...envio, autor: 'narrador', guiado, ...(eleccion ? { eleccion } : {}) });
    if (envio.tarjeta === 'tuEres') this.comunicarFicha(asientoId, envio.personajes, envio.alineamiento);
  }

  // El despertar guiado: lo lleva DespertarGuiado

  habilidadesNoche(): SalaHabilidadNoche[] {
    return this.guiado.habilidadesNoche();
  }

  despertarHabilidad(personaje: string): string | null {
    return this.guiado.despertar(personaje);
  }

  eleccionPendiente(asientoId: string): SalaEleccionDespertar | null {
    return this.guiado.eleccionPendiente(asientoId);
  }

  respuestaGuiada(asientoId: string): boolean {
    return this.despertados.respuestaGuiada(asientoId);
  }

  alElegirHabilidad(asientoId: string, elegidos: string[]): void {
    this.guiado.alElegir(asientoId, elegidos);
  }

  /** El jugador de un asiento ha contestado «Entendido» en su despertar: le llega lo siguiente de su cola (ver DespertarGuiado). */
  alEntenderHabilidad(asientoId: string): void {
    this.guiado.alEntender(asientoId);
  }

  resolverHabilidad(personaje: string, envio: SalaEnvioDespertar): string | null {
    return this.guiado.resolver(personaje, envio);
  }

  nuevoImp(): string | null {
    return this.guiado.nuevoImp();
  }

  elegirNuevoImp(asientoId: string): string | null {
    return this.guiado.elegirNuevoImp(asientoId);
  }

  /** Pone un recordatorio de un personaje por su texto (en el original), único en la mesa (ver recordatorioQueSobra). */
  private ponerRecordatorioDe(asientoId: string, personajeId: string, texto: string): void {
    const textos = this.personaje(personajeId)?.recordatorios ?? [];
    const indice = textos.findIndex((t) => t.toLowerCase() === texto.toLowerCase());
    if (indice < 0) return;
    const sobra = this.recordatorioQueSobra(asientoId, personajeId, indice);
    if (sobra) this.quitarRecordatorio(sobra.asientoId, sobra.recordatorioId);
    this.ponerRecordatorio(asientoId, { personaje: personajeId, indice, texto: textos[indice] });
  }

  /** Envía a quien se sienta en un asiento el grimorio tal como está (el Espía); a un asiento libre, nada. */
  private enviarGrimorioDeLaMesa(asientoId: string): void {
    if (!this.mesaAlDia().find((a) => a.id === asientoId)?.ocupante) return;
    const fichas: SalaFichaEnviada[] = this.mesa.map((a) => ({
      asientoId: a.id,
      personaje: a.personaje,
      alineamiento: a.alineamiento,
      muerto: a.muerto,
      recordatorios: a.recordatorios.map((r) => ({ ...r, id: randomUUID() })),
    }));
    this.enviarGrimorio(asientoId, fichas);
  }

  /**
   * Deja la partida como al principio, en la preparación: sin registro de
   * votaciones, todas las fichas vivas, sin personaje y sin calavera, la bolsa
   * vacía, sin nominación y nadie con acceso al grimorio (las peticiones
   * pendientes siguen). Los jugadores siguen en sus asientos.
   */
  limpiarGrimorio(): void {
    this.cerrarNominacion();
    this.senales.terminar();
    this.tiempo.quitarReloj();
    this.pasosDeFase = [];
    this.avisar({ tipo: 'nuevaPartida' });
    this.npcsPartida.nuevaPartida();
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
      a.nota = null;
    }
    this.bolsaPartida.vaciar();
    this.entregas.olvidar();
    this.farolesDemonio.vaciar();
    this.setupAceptadoActual = null;
    this.final.olvidar();
    this.presentes.olvidarGrimorios();
    this.despertados.cerrarTodos();
    this.guiado.olvidar();
    this.recordatorios = {};
    this.faseActual = { momento: 'preparacion', numero: 0, reinicios: this.faseActual.reinicios + 1 };
  }

  /** Las votaciones son secretas (el Organ Grinder, ver reglas/organGrinder.ts). */
  votacionSecreta(): boolean {
    return this.reglas.votacionSecreta();
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

  /**
   * Abre la nominación. Lo que pase al nominar lo dicen las reglas (ver
   * ReglaPersonaje.alNominar): con la Virgen, su recordatorio y, si toca, la
   * ejecución al momento de quien nomina (se cierra la nominación). Si depende de
   * cómo registra quien nomina (el Espía) y `registro` no lo dice, no se nomina:
   * se devuelve la pregunta, para volver a nominar con la respuesta (y nadie ve
   * nada hasta entonces). Devuelve la ejecución (ver ejecutar) o null. No comprueba permisos.
   */
  nominar(
    desde: string,
    hasta: string,
    registro: RegistroAlNominar = {},
  ): { pregunta: 'comoAldeano' } | { anochece: boolean; final: boolean } | null {
    const nominador = this.mesa.find((a) => a.id === desde);
    const nominado = this.mesa.find((a) => a.id === hasta);
    // Pedir la expulsión de un viajero no es nominar
    const efectos = nominador && nominado && !this.llevaViajero(nominado) ? this.reglas.alNominar(nominador, nominado, registro) : null;
    if (efectos && 'pregunta' in efectos) return efectos;
    this.nominaciones.nominar(desde, hasta);
    if (!efectos) return null;
    for (const r of efectos.recordatorios) this.ponerRecordatorioDe(hasta, r.personaje, r.texto);
    if (!efectos.ejecutaAlNominador) return null;
    this.cerrarNominacion();
    return this.ejecutar(desde);
  }

  cerrarNominacion(): void {
    this.nominaciones.cerrarNominacion();
  }

  hayVotacion(): boolean {
    return this.nominaciones.hayVotacion();
  }

  votacionEnMarcha(): boolean {
    return this.nominaciones.votacionEnMarcha();
  }

  reiniciarVotacion(): void {
    this.nominaciones.reiniciarVotacion();
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
   * Cada recordatorio de un personaje es único: el que hay que quitar al poner
   * otro igual en un asiento. Si el personaje tiene varios con el mismo texto,
   * solo cuando ya están todos en la mesa. Antes uno de otro asiento que uno de
   * este. null: no hay que quitar ninguno.
   */
  recordatorioQueSobra(asientoId: string, personajeId: string, indice: number): { asientoId: string; recordatorioId: string } | null {
    const textos = this.personaje(personajeId)?.recordatorios ?? [];
    const texto = textos[indice];
    if (texto === undefined) return null;
    const iguales = new Set(textos.flatMap((t, i) => (t === texto ? [i] : [])));
    const puestos = this.mesa.flatMap((a) =>
      a.recordatorios.filter((r) => r.personaje === personajeId && iguales.has(r.indice)).map((r) => ({ asientoId: a.id, recordatorioId: r.id })),
    );
    if (puestos.length < iguales.size) return null;
    return puestos.find((p) => p.asientoId !== asientoId) ?? puestos[0];
  }

  /**
   * Escribe la nota de un asiento (sustituye la que hubiera); con null, la borra.
   * Devuelve false si el asiento no existe. No comprueba permisos.
   */
  escribirNota(asientoId: string, texto: string | null): boolean {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return false;
    asiento.nota = texto;
    return true;
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

  // El señalamiento: lo lleva Senalamientos

  senalamiento(): SalaSenalamiento | null {
    return this.senales.senalamiento();
  }

  veSenalamiento(participante: SalaParticipante): boolean {
    return this.senales.veSenalamiento(participante);
  }

  /**
   * Mientras hay un señalamiento (también congelado, hasta que el narrador lo quite),
   * quien lo ve no levanta la mano: las manos de señalar van en las fichas. De noche,
   * quien no lo ve sigue igual (así no sabe que lo hay).
   */
  manosBloqueadas(participante: SalaParticipante): boolean {
    return this.veSenalamiento(participante);
  }

  /** Empieza un señalamiento (ver Senalamientos.empezar); quien lo ve baja la mano. No comprueba permisos. */
  empezarSenalamiento(datos: Parameters<Senalamientos['empezar']>[0]): void {
    this.senales.empezar(datos);
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
    const error = this.senales.senalar(participanteId, objetivo);
    if (!error && objetivo !== null && this.senales.senalamiento()?.tipo === 'lilmonsta') this.resolverLilmonsta();
    return error;
  }

  /** Lil' Monsta: si todos los esbirros sentados señalan al mismo, ese lo cuida (ver reglas/lilMonsta.ts). */
  private resolverLilmonsta(): void {
    const s = this.senales.senalamiento();
    const cuidador = s && cuidadorLilmonsta(this.contextoReglas, s);
    if (!cuidador) return;
    this.senales.congelar();
    // Su «Is The Demon» pasa al que lo cuida (solo hay uno)
    const r = recordatorioLilmonsta(this.contextoReglas);
    if (!r) return;
    for (const a of this.mesa) {
      a.recordatorios = a.recordatorios.filter((x) => !(x.personaje === DEMONIO_LILMONSTA && x.indice === r.indice));
    }
    this.ponerRecordatorio(cuidador, { personaje: DEMONIO_LILMONSTA, indice: r.indice, texto: r.texto });
  }

  /** Quita el señalamiento. No comprueba permisos. */
  terminarSenalamiento(): void {
    this.senales.terminar();
  }

  /** Se puede empezar Lil' Monsta: los asientos de los esbirros vivos, o null (ver reglas/lilMonsta.ts). */
  esbirrosLilmonsta(): string[] | null {
    return esbirrosLilmonsta(this.contextoReglas, {
      noche: this.faseActual.momento === 'noche',
      enElGuion: !!this.guionActual?.personajes.some((p) => p.id === DEMONIO_LILMONSTA),
      esbirrosQueTocan: this.distribucion().esbirros,
    });
  }

  // La revelación del grimorio: la lleva Revelacion

  revelacion(): SalaRevelacion | null {
    return this.final.revelacion();
  }

  revelarFicha(asientoId: string): void {
    this.final.revelarFicha(asientoId);
  }

  revelarTodas(): void {
    this.final.revelarTodas();
  }

  /**
   * Empieza a revelar el grimorio: ha ganado ese bando (y lo que haya pasado, ver
   * CAUSAS_FIN_PARTIDA) y todas las fichas se dan la vuelta.
   */
  empezarRevelacion(ganador: SalaAlineamiento, causas: string[] = [], esbirros: Record<string, string> = {}): void {
    this.cerrarNominacion();
    this.final.empezar(ganador, causas);
    // Se acaba la partida. Las causas de esbirro (la Doncel cazada), de la cuenta del
    // esbirro que eligió el narrador
    this.avisar({
      tipo: 'partidaTerminada',
      ganador,
      causas: causas.map((id) => {
        const asiento = esbirros[id];
        if (!asiento) return { id };
        return { id, userId: this.cuentaDe(this.mesa.find((a) => a.id === asiento)?.ocupante ?? null) };
      }),
      mesa: this.fotoDeLaMesa(),
      narradores: this.presentes.narradores().map((p) => ({ userId: this.cuentaDe(p.id), nombre: p.nombre })),
      npcs: this.npcs(),
      votaciones: this.votaciones(),
      guion: this.guionActual?.nombre ?? null,
      edicion: this.guionActual?.edicion ?? null,
      dias: this.faseActual.numero,
    });
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
    if (muerto && asiento.muertePendiente) quitarMarcaDeMuerte(asiento);
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
   * Ejecuta al de un asiento (el que lleva la calavera): muere como al matarlo y
   * se le ponen los recordatorios de los personajes que funcionan con las
   * ejecuciones (ver Reglas). Luego anochece, salvo si una regla lo impide (el
   * Carnicero vivo: puede haber otra ejecución) o si quedan solo dos
   * jugadores vivos (`final`): entonces decide el narrador si se va a la noche o
   * se revela el grimorio. Devuelve si ha anochecido y si quedan dos, o null si
   * el asiento no existe. No comprueba permisos.
   */
  ejecutar(asientoId: string): { anochece: boolean; final: boolean } | null {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento) return null;
    // Los recordatorios de los personajes que funcionan con las ejecuciones (ver Reglas)
    for (const { personaje, texto, unico } of this.reglas.recordatoriosAlEjecutar(asiento)) {
      const indice = this.personaje(personaje)?.recordatorios.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1;
      if (indice < 0) continue;
      const delPersonaje = (r: SalaRecordatorio) => r.personaje === personaje && r.indice === indice;
      if (unico) for (const a of this.mesa) a.recordatorios = a.recordatorios.filter((r) => !delPersonaje(r));
      asiento.recordatorios.push({ id: randomUUID(), personaje, indice, texto: this.personaje(personaje)!.recordatorios[indice] });
    }
    this.avisar({ tipo: 'ejecucion', userId: this.cuentaDe(asiento.ocupante) });
    this.cambiarVida(asiento.id, true);
    // Los vivos que quedan: los asientos (también los libres, que cuentan como jugadores)
    // sin muerte, sin contar a los viajeros
    const vivos = this.mesa.filter((a) => !a.muerto && !a.muertePendiente && !this.llevaViajero(a)).length;
    const final = vivos <= 2;
    const anochece = !final && this.reglas.anocheceTrasEjecutar();
    if (anochece) this.irANoche();
    return { anochece, final };
  }

  /**
   * Hace efectiva una muerte pendiente (el narrador la anuncia): ya la ven todos, y
   * se le quita el «Dead» de quien lo mató (ya no hace falta). No comprueba permisos.
   */
  confirmarMuerte(asientoId: string): boolean {
    const asiento = this.mesa.find((a) => a.id === asientoId);
    if (!asiento?.muertePendiente) return false;
    quitarMarcaDeMuerte(asiento);
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
    return this.mesaAlDia().map((a) => ({ ...a, faroles: this.farolesDemonio.deAsiento(a), farolEnUso: this.farolesDemonio.enUso(a) }));
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
   * recordatorios, la nota; y lo que va por asiento: lo entregado, los faroles, el
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
          nota: s.nota,
        },
      ]),
    );
    for (const [desde, hasta] of destino) {
      const asiento = this.mesa.find((s) => s.id === hasta);
      const ficha = fichas.get(desde);
      if (asiento && ficha) Object.assign(asiento, ficha);
    }
    this.entregas.remapear(a);
    this.farolesDemonio.remapear(a);
    this.despertados.remapear(a);
    this.guiado.remapear(a);
    this.final.remapear(a);
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

  /** No puede votar: no está sentado, o las reglas dicen que no (ver Reglas.puedeVotar). */
  sinVoto(participanteId: string): boolean {
    const asiento = this.asientoDe(participanteId);
    if (!asiento) return true;
    // En la expulsión de un viajero vota cualquiera (los muertos, sin gastar su voto)
    if (this.nominaciones.esExpulsion()) return false;
    return !this.reglas.puedeVotar(asiento);
  }

  /**
   * Los jugadores solo pueden conversar en privado con sus vecinos (la Institutriz
   * viva). Se llama así por ella, que es quien lo pide (ver reglas/institutriz.ts).
   */
  institutrizViva(): boolean {
    return this.reglas.soloVecinos();
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

  /** El Voudon está vivo en la mesa (ver reglas/voudon.ts). */
  voudonVivo(): boolean {
    return voudonVivo(this.contextoReglas);
  }

  /** Puede votar con las dos manos (dos votos): la Banshee con su habilidad (ver reglas/banshee.ts). */
  puedeVotarDoble(participanteId: string): boolean {
    const asiento = this.mesa.find((a) => a.ocupante === participanteId);
    return !!asiento && this.reglas.votaDoble(asiento);
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

  /** El narrador virtual de la sala, si lo hay (y su participante sigue en ella). */
  narradorVirtual(): SalaNarradorVirtual | null {
    const narrador = this.narradoresVirtuales.actual();
    return narrador && this.buscar(narrador.participante) ? narrador : null;
  }

  /** Entra un narrador virtual (ver Participantes.anadirVirtual) y se guarda quién lo añadió. Devuelve su participante. */
  anadirNarradorVirtual(
    datos: Pick<SalaNarradorVirtual, 'id' | 'creador' | 'guion' | 'jugadores'>,
    nombre: string,
    avatar: string,
  ): string {
    const participante = this.presentes.anadirVirtual(nombre, avatar, datos.id);
    this.narradoresVirtuales.guardar({
      ...datos,
      participante,
      etapa: 'esperandoJugadores',
      frase: null,
      turno: null,
      listos: [],
      exterminadores: [],
    });
    return participante;
  }

  /** Cambia lo que lleva el narrador virtual de la partida (su etapa, su frase, el día…). No comprueba permisos. */
  actualizarNarradorVirtual(cambios: Partial<Omit<SalaNarradorVirtual, 'id' | 'participante' | 'creador' | 'guion' | 'jugadores'>>): void {
    this.narradoresVirtuales.actualizar(cambios);
  }

  /** Otro narrador virtual sigue la partida del que hay (Jarvis deja a «Tonto y tú»): con su id y su nombre. */
  relevarNarradorVirtual(id: SalaNarradorVirtual['id'], nombre: string): void {
    const narrador = this.narradoresVirtuales.actual();
    if (!narrador) return;
    this.narradoresVirtuales.guardar({ ...narrador, id });
    this.presentes.relevarVirtual(narrador.participante, nombre, id);
  }

  /** Se va el narrador virtual (su participante sale de la sala): la palabra y los privados vuelven a ser de todos. */
  quitarNarradorVirtual(): void {
    const narrador = this.narradoresVirtuales.actual();
    if (narrador) this.presentes.expulsar(narrador.participante);
    this.narradoresVirtuales.borrar();
    this.palabraDe = null;
    this.privadosAbiertos = true;
  }

  /** Quien tiene la palabra en la mesa (los demás jugadores callan), o null: hablan todos. */
  palabra(): string | null {
    return this.palabraDe;
  }

  /** Da la palabra a uno (o, con null, a todos). No comprueba permisos. */
  darPalabra(participanteId: string | null): void {
    this.palabraDe = participanteId;
  }

  /** Si se puede conversar en privado (el narrador virtual lo cierra fuera de los privados). */
  privadosPermitidos(): boolean {
    return this.privadosAbiertos;
  }

  /** Abre o cierra las conversaciones privadas (cerrarlas termina las que haya). No comprueba permisos. */
  permitirPrivados(abiertos: boolean): void {
    this.privadosAbiertos = abiertos;
  }

  private palabraDe: string | null = null;
  private privadosAbiertos = true;

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

