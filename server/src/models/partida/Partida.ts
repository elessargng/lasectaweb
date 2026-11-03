import { randomUUID } from 'crypto';
import type { Azar } from './azar';
import { FICHAS_RESPUESTA_GUIADA, type EleccionDespertar, type EnvioDespertar, type MensajeDespertar } from '../compartido/despertar';
import type { FichaEnviada } from './Entregas';
import { NUM_FAROLES, type Alineamiento } from '../compartido/jugador';
import { CAUSAS_DE_ESBIRRO, CAUSAS_FIN_PARTIDA } from '../compartido/partida';
import type { AsientoDiario, HechoDiario } from '../compartido/diario';
import type { GuionResuelto } from '../guiones';
import type { Participante } from '../sala/Participantes';
import type { Sala } from '../sala/Sala';
import { AccesoGrimorio } from './AccesoGrimorio';
import { Configuracion } from './Configuracion';
import { Declaraciones } from './Declaraciones';
import { DespertarGuiado, errorDeEleccion } from './DespertarGuiado';
import { componerMensaje, type BorradorDespertar } from './mensajeDespertar';
import { Despertares } from './Despertares';
import { Entregas } from './Entregas';
import { type Diario, type EventoPartida, type FotoAsiento, type OyentePartida } from './eventos';
import { Faroles } from './Faroles';
import { Fases } from './Fases';
import { Grimorio, identidadDe } from './Grimorio';
import { Guion } from './Guion';
import { habilidadesDelGuion } from './habilidades';
import type { ContextoNoche } from './habilidades/HabilidadNocturna';
import { Nominaciones } from './Nominaciones';
import { Npcs } from './Npcs';
import { NPC_GARDENER, NPC_POPE } from './personajesEspeciales';
import { PODERES_BOLSA } from '../personajes';
import { Reglas } from '../personajes/Reglas';
import type { ContextoReglas, RegistroAlNominar } from '../personajes/ReglaPersonaje';
import { cuidadorLilmonsta, DEMONIO_LILMONSTA, esbirrosLilmonsta, recordatorioLilmonsta } from '../personajes/lilMonsta';
import { voudonVivo } from '../personajes/voudon';
import { RelojSala } from './RelojSala';
import { Bolsa } from './Bolsa';
import { Revelacion } from './Revelacion';
import { Senalamientos } from './Senalamientos';
import type { Jugador } from './Jugador';

/** Lo que la partida necesita saber de fuera de la sala. */
export interface EntornoPartida {
  /** Hay un narrador virtual llevando la partida (él decide cuándo anochece tras ejecutar). */
  hayNarradorVirtual(): boolean;
  /** El azar de la partida: el reparto, la bolsa al azar y las reglas que sortean. */
  azar: Azar;
}

/**
 * La partida que se juega en una sala: el guion, la fase, el grimorio, las
 * nominaciones, los despertares… Sus piezas están a la vista: lo que solo toca
 * una se le pide a ella. Aquí está solo lo que coordina varias (anochecer,
 * ejecutar, nominar, empezar otra partida…) y lo que hay que apuntar en el
 * diario. Lee la sala (asientos y participantes) y se entera de lo que cambia en
 * ella; la sala no sabe nada de la partida. No comprueba permisos.
 */
export class Partida {
  constructor(
    private readonly sala: Sala,
    private readonly entorno: EntornoPartida,
  ) {
    // Un asiento que se quita se lleva lo que su jugador tenía en el grimorio
    this.sala.alQuitar((jugador) => this.grimorio.olvidar(jugador));
    // El acceso al grimorio es de los visitantes: al cambiar de papel se pierde (y se vuelve a pedir)
    this.sala.participantes.alCambiarRol((id) => this.acceso.cambiar(id, 'ninguno'));
    this.sala.participantes.alExpulsar((id, recuerdo) => this.acceso.alExpulsar(id, recuerdo));
  }

  /** El guion de la partida y sus personajes. */
  readonly guion = new Guion();
  /** Los ajustes de la partida y si se puede conversar en privado. */
  readonly configuracion = new Configuracion();
  /** La fase de la partida y la máquina del tiempo. */
  readonly fases = new Fases();
  /** Quién ha pedido ver el grimorio y a quién se le ha concedido. */
  readonly acceso = new AccesoGrimorio((id) => this.sala.participantes.recuerdoDe(id));
  /** Lo que se hace con los jugadores de la plaza, los apuntes del narrador y la calavera (ver Grimorio). */
  readonly grimorio = new Grimorio({
    jugadores: () => this.sala.jugadores(),
    personaje: (id) => this.guion.personaje(id),
    noche: () => this.fases.actual().momento === 'noche',
    anotar: (hecho) => this.anotar(hecho),
    asientoDiario: (jugadorId) => this.asientoDiario(jugadorId),
  });
  /** Lo que las reglas de los personajes pueden consultar de la partida. */
  private readonly contextoReglas: ContextoReglas = {
    plaza: () => this.plaza(),
    identidad: (jugador) => identidadDe(jugador),
    alineamiento: (jugador) => this.grimorio.alineamiento(jugador),
    personaje: (id) => this.guion.personaje(id),
    personajesDelGuion: () => this.guion.actual()?.personajes ?? [],
    percepcion: (jugador) => this.reglas.percepcion(jugador),
    objetivo: (jugador) => this.reglas.objetivo(jugador),
    droison: (jugador) => this.reglas.droison(jugador),
    azar: this.entorno.azar,
  };
  /** Las reglas de los personajes (ver models/personajes); el final de la partida también les pregunta. */
  readonly reglas = new Reglas(this.contextoReglas);
  /** Las nominaciones y votaciones del día (y quién tiene la palabra). */
  readonly nominaciones = new Nominaciones({
    plaza: () => this.plaza(),
    buscar: (id) => this.sala.participantes.buscar(id),
    bajarManos: () => this.sala.participantes.bajarManos(),
    cuentaDe: (id) => this.cuentaDe(id),
    llevaViajero: (jugador) => {
      const id = identidadDe(jugador);
      return !!id && this.guion.esViajero(id);
    },
    dia: () => this.fases.actual().numero,
    segundosPorFicha: () => this.configuracion.actual().segundosPorFicha,
    sinVoto: (id) => this.sinVoto(id),
    cambiarVoto: (jugadorId, gastado) => this.grimorio.cambiarVoto(jugadorId, gastado),
    votaSinGastar: (jugador) => this.reglas.votaSinGastar(jugador),
    mayoria: (vivos) => this.reglas.mayoria(vivos),
    valorDelVoto: (jugador, ocupante) => this.reglas.valorDelVoto(jugador, ocupante.dosManos),
    secreta: () => this.votacionSecreta(),
    alNominar: (desde, hasta) =>
      this.avisar({ tipo: 'nominacion', nomina: this.cuentaDelAsiento(desde), nominado: this.cuentaDelAsiento(hasta) }),
    alVotar: (cuenta) => this.avisar({ tipo: 'voto', userId: cuenta }),
    alDesvotar: (cuenta) => this.avisar({ tipo: 'desvoto', userId: cuenta }),
    alExpulsar: (jugadorId) => this.grimorio.cambiarVida(jugadorId, true),
    alCambiarSola: () => this.alCambiarSola(),
  });
  /** El gong y el reloj del narrador. */
  readonly reloj = new RelojSala();
  /** Los despertares de la noche. */
  readonly despertares = new Despertares(
    () => this.plaza(),
    () => this.fases.actual(),
    this.diario(),
  );
  /** El despertar guiado desde el orden de noche (ver DespertarGuiado). */
  readonly guiado = new DespertarGuiado({
    ctx: this.contextoNoche(),
    habilidades: () => habilidadesDelGuion(this.guion.actual()?.edicion ?? null),
    noche: () => this.fases.actual().momento === 'noche',
    despertar: (jugadorId) => this.despertares.despertar(jugadorId),
    mandar: (jugadorId, envio, eleccion) => this.mandarDelNarrador(jugadorId, envio, { eleccion, guiado: true }),
    porEntender: (jugadorId) => this.despertares.porEntender(jugadorId),
    ponerRecordatorio: (jugadorId, personaje, texto) => this.ponerRecordatorioDe(jugadorId, personaje, texto),
    matarDeNoche: (jugadorId) => this.grimorio.cambiarVida(jugadorId, true),
    enviarGrimorio: (jugadorId) => this.enviarGrimorioDeLaPlaza(jugadorId),
    cambiarPersonaje: (jugadorId, personaje) => this.grimorio.cambiarPersonaje(jugadorId, personaje),
  });
  /** Los faroles para el demonio (del narrador y de cada asiento). */
  readonly faroles = new Faroles(() => this.sala.jugadores(), this.diario(), (id) => this.guion.personaje(id));
  /** El final de la partida: qué bando ha ganado y qué fichas se han revelado. */
  readonly revelacion = new Revelacion(() => this.plaza());
  /** Los NPCs en juego y lo que traen (Bootlegger, Storm Catcher, silencio). */
  readonly npcs = new Npcs(() => this.guion.actual());
  /** Lo entregado a cada jugador y los grimorios enviados. */
  readonly entregas = new Entregas(() => this.plaza(), this.diario());
  /** La bolsa: sus fichas, sus reglas y el reparto de personajes. */
  readonly bolsa = new Bolsa({
    plaza: () => this.plaza(),
    esViajero: (id) => this.guion.esViajero(id),
    personaje: (id) => this.guion.personaje(id),
    personajes: () => this.guion.actual()?.personajes ?? [],
    npcs: () => this.npcs.npcs(),
    poderDe: (id) => PODERES_BOLSA.get(id),
    popeEnJuego: () => this.npcs.activo(NPC_POPE),
    reglas: (jugadores, personajes) => this.reglas.repartir(jugadores, personajes),
    darPersonaje: (jugadorId, personaje) => this.grimorio.repartir(jugadorId, personaje),
    azar: this.entorno.azar,
  });
  /** El señalamiento en curso. */
  readonly senalamientos = new Senalamientos({
    plaza: () => this.plaza(),
    fase: () => this.fases.actual(),
    jugadorDe: (id) => this.jugadorDe(id),
    veGrimorio: (id) => this.acceso.de(id) === 'concedido',
    despertar: (jugadorId) => void this.despertares.despertar(jugadorId),
  });
  /** Las declaraciones del día: quién ha disparado como Exterminador, quién puede declararse Patoso… */
  readonly declaraciones = new Declaraciones();
  /** Recordatorios del orden de noche cambiados a mano (ver SalaDto.recordatoriosNoche). */
  private recordatorios: Record<string, boolean> = {};

  /** Lo que consultan las habilidades de noche: lo de las reglas y los faroles del demonio. */
  contextoNoche(): ContextoNoche {
    return { ...this.contextoReglas, faroles: () => this.faroles.faroles() };
  }

  /**
   * Los jugadores de la plaza, en orden (ver Sala.jugadores). Se cambian con
   * this.grimorio, no a mano.
   */
  plaza(): readonly Jugador[] {
    return this.sala.jugadores();
  }

  /** El jugador al que juega un participante, o null. */
  jugadorDe(participanteId: string): Jugador | null {
    return this.sala.jugadorDe(participanteId);
  }

  /**
   * Cambia el guion de la sala. Es otra partida: antes se limpia el grimorio
   * (fichas, bolsa, faroles, registro, fase…, ver limpiarGrimorio).
   */
  cambiarGuion(guion: GuionResuelto): void {
    this.limpiarGrimorio();
    this.guion.cambiar(guion);
    // La bolsa, los faroles y los NPCs eran de los personajes del otro guion. Los
    // legendarios y lóricos que trae el guion, en juego desde el principio
    this.bolsa.vaciar();
    this.npcs.alCambiarGuion();
    this.entregas.retenerFichas(false);
    this.faroles.vaciar();
  }

  /** Pone en juego un NPC, o lo quita si ya estaba. No comprueba que sea del guion. */
  alternarNpc(personajeId: string): void {
    this.npcs.alternar(personajeId);
    // Sin el Gardener ya no hay nada que retener: los personajes se entregan (como estén ahora)
    if (this.entregas.fichasRetenidas() && !this.npcs.activo(NPC_GARDENER)) this.entregas.entregarFichas();
  }

  /**
   * Se llama cuando la partida cambia sola, sin que nadie pida nada (la votación
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

  /**
   * Apunta algo que se ha hecho en la partida, para su diario (ver models/compartido/diario).
   * En la preparación solo cuentan los faroles; revelado el grimorio, ya nada.
   */
  anotar(hecho: HechoDiario): void {
    const { momento, numero } = this.fases.actual();
    if (this.revelacion.revelacion()) return;
    if (momento === 'preparacion' && !['farol', 'copiaFaroles', 'usaFarol'].includes(hecho.tipo)) return;
    this.avisar({ tipo: 'diario', entrada: { ...hecho, fase: { momento, numero }, hora: Date.now() } });
  }

  /** El diario, para las piezas que apuntan lo que se hace con ellas. */
  private diario(): Diario {
    return { anotar: (hecho) => this.anotar(hecho), asiento: (jugadorId) => this.asientoDiario(jugadorId) };
  }

  /** Un asiento para el diario: su número y quien se sienta ahora. */
  asientoDiario(jugadorId: string): AsientoDiario {
    const plaza = this.plaza();
    const i = plaza.findIndex((a) => a.id === jugadorId);
    const ocupante = plaza[i]?.participanteId;
    return { numero: i + 1, nombre: ocupante ? (this.sala.participantes.buscar(ocupante)?.nombre ?? null) : null };
  }

  /** El id de usuario de un participante con cuenta, o null (invitado, o ya no está). */
  private cuentaDe(participanteId: string | null): string | null {
    return this.sala.participantes.cuentaDe(participanteId);
  }

  private cuentaDelAsiento(jugadorId: string): string | null {
    return this.cuentaDe(this.plaza().find((a) => a.id === jugadorId)?.participanteId ?? null);
  }

  /** Cómo está ahora la plaza, asiento a asiento (para quien escucha la partida). */
  private fotoDeLaPlaza(): FotoAsiento[] {
    return this.plaza().map((a, i) => {
      const personaje = identidadDe(a);
      return {
        numero: i + 1,
        nombre: a.participanteId ? (this.sala.participantes.buscar(a.participanteId)?.nombre ?? null) : null,
        userId: this.cuentaDe(a.participanteId),
        personaje,
        ficha: a.personaje && a.personaje !== personaje ? a.personaje : null,
        alineamiento: this.grimorio.alineamiento(a),
        muerto: a.muerto,
      };
    });
  }

  /**
   * Anochece (desde la preparación, la noche 1; desde un día, la siguiente
   * noche): se cierra la nominación abierta y se quitan la calavera y el récord
   * de votos del día.
   */
  irANoche(): void {
    const calavera = this.grimorio.calavera();
    const marcadas = this.plaza().filter((a) => a.id === calavera?.jugadorId);
    this.avisar({
      tipo: 'anochece',
      desdePreparacion: this.fases.actual().momento === 'preparacion',
      plaza: this.fotoDeLaPlaza(),
      conCalavera: marcadas.flatMap((a) => this.cuentaDe(a.participanteId) ?? []),
    });
    // Para poder volver: lo que se quita al anochecer
    this.fases.anochecer({
      marcas: calavera ? [{ asiento: calavera.jugadorId, votos: calavera.votos }] : [],
      maximoDelDia: this.nominaciones.recordDelDia(),
    });
    // Otra noche: el despertar guiado empieza de cero
    this.guiado.olvidar();
    // Lo que se señaló de día no sigue de noche (lo verían otros); el reloj tampoco
    this.senalamientos.terminar();
    this.reloj.quitarReloj();
    this.nominaciones.cerrarNominacion();
    this.grimorio.desmarcar();
    this.nominaciones.ponerRecordDelDia(null);
  }

  /**
   * Amanece: el día de la misma noche. Los despertares de la noche se acaban: no
   * se ven de día y la noche siguiente empieza sin ellos.
   */
  amanecer(): void {
    this.fases.amanecer({ hilos: this.despertares.instantanea(), senalamiento: this.senalamientos.instantanea() });
    this.avisar({ tipo: 'amanece', plaza: this.fotoDeLaPlaza() });
    this.despertares.cerrarTodos();
    // Lo de la noche no se ve de día (y el reloj se quita)
    this.senalamientos.terminar();
    this.reloj.quitarReloj();
  }

  /**
   * La máquina del tiempo del narrador: vuelve a la fase anterior (ver Fases.anterior),
   * por si se pasó de fase antes de tiempo. Si fue este mismo cambio el que se
   * hizo, devuelve lo que se quitó: al volver al día, la calavera y el récord de
   * votos; a la noche, sus despertares (con lo que se dijeron) y su señalamiento
   * (y quien escucha la partida deshace lo de ese cambio). Lo demás de la partida (muertes, fichas,
   * recordatorios) se queda como está. Se cierra la nominación abierta.
   */
  volverAtras(): boolean {
    if (!this.fases.anterior()) return false;
    this.nominaciones.cerrarNominacion();
    this.senalamientos.terminar();
    this.reloj.quitarReloj();
    const { fase: anterior, recuerdo: paso } = this.fases.volver()!;
    if (anterior.momento === 'dia') {
      // Al día: sin los despertares de la noche (como al amanecer) y, si se puede, con su calavera
      this.despertares.cerrarTodos();
      this.nominaciones.ponerRecordDelDia(paso?.maximoDelDia ?? null);
      for (const m of paso?.marcas ?? []) this.grimorio.marcar(m.asiento, true, m.votos);
    } else if (anterior.momento === 'noche') {
      this.grimorio.desmarcar();
      this.nominaciones.ponerRecordDelDia(null);
      if (paso?.hilos) this.despertares.restaurar(paso.hilos);
      if (paso?.senalamiento) this.senalamientos.restaurar(paso.senalamiento);
    }
    this.avisar({ tipo: 'vueltaAtras', deshace: !!paso, aPreparacion: anterior.momento === 'preparacion' });
    return true;
  }

  recordatoriosNoche(): Record<string, boolean> {
    return { ...this.recordatorios };
  }

  /**
   * Pone (true) o quita (false) a mano la ficha recordatorio de una fila del orden
   * de noche: un personaje del guion, 'esbirros' o 'demonios'. Devuelve el error, si lo hay.
   */
  cambiarRecordatorio(id: string, activo: boolean): string | null {
    if (id !== 'esbirros' && id !== 'demonios' && !this.guion.personaje(id)) return 'Ese personaje no está en el guion.';
    this.recordatorios[id] = activo;
    return null;
  }

  /**
   * Un mensaje en un despertar (ver componerMensaje). El narrador manda una ficha o
   * una tarjeta a los de esos asientos (a uno, en su despertar; a varios, de noche,
   * despertando a los que aún no lo están); `virtual`: lo manda el narrador virtual.
   * El jugador (participanteId), solo fichas al narrador, en el suyo. Si su habilidad
   * le ha pedido que elija (el despertar guiado), solo contesta con a quiénes elige;
   * por un asiento libre (cuenta como un jugador) elige el narrador. Devuelve el error, si lo hay.
   */
  enviarAlDespertar(
    de: { narrador: string[]; virtual: boolean } | { jugador: string },
    borrador: BorradorDespertar,
  ): string | null {
    const narra = 'narrador' in de;
    const jugadorIds = narra ? de.narrador : [this.despertares.asientoDespiertoDe(de.jugador)].filter((id): id is string => !!id);
    if (!jugadorIds.length || jugadorIds.some((id) => !this.sala.jugador(id))) return 'Ese despertar ya no está abierto.';
    // A uno solo, en su despertar; a varios, también a los que aún no están despiertos (de noche)
    const despiertaMas = jugadorIds.length > 1 && this.fases.actual().momento === 'noche';
    if (!despiertaMas && jugadorIds.some((id) => !this.despertares.hayDespertar(id))) return 'Ese despertar ya no está abierto.';
    const mensaje = this.componerMensaje(borrador, narra);
    if ('error' in mensaje) return mensaje.error;
    const destinos = jugadorIds.map((jugadorId) => {
      const libre = !this.plaza().find((a) => a.id === jugadorId)?.participanteId;
      const pide = !narra || libre ? this.guiado.eleccionPendiente(jugadorId) : null;
      return { jugadorId, pide, eligiendo: !!pide && (!narra || mensaje.ficha === 'jugador') };
    });
    for (const { jugadorId, pide, eligiendo } of destinos) {
      if (pide && eligiendo) {
        const error = errorDeEleccion(pide, mensaje, jugadorId);
        if (error) return error;
      }
      // A lo demás del despertar guiado, el jugador solo contesta «Entendido» o con un texto
      if (!narra && !pide && this.despertares.respuestaGuiada(jugadorId) && !(mensaje.ficha && FICHAS_RESPUESTA_GUIADA.includes(mensaje.ficha))) {
        return 'Contesta «Entendido» o escribe un mensaje al narrador.';
      }
    }
    for (const { jugadorId, eligiendo } of destinos) {
      if (!this.despertares.hayDespertar(jugadorId)) this.despertares.despertar(jugadorId);
      // «Tú eres»: su ficha pasa a ser la que se le dice (con alineamiento, solo si se le dice)
      // Lo que escribe el narrador virtual en un despertar guiado (que diga «Entendido»)
      // lo sigue siendo: el jugador sigue contestando solo «Entendido» o un texto
      if (narra) this.mandarDelNarrador(jugadorId, mensaje, { guiado: de.virtual && this.despertares.respuestaGuiada(jugadorId) });
      else this.despertares.enviar(jugadorId, { ...mensaje, autor: jugadorId });
      if (eligiendo) this.guiado.alElegir(jugadorId, mensaje.jugadores);
      // Entendido lo anterior (lo dice el jugador, o el narrador a lo que eligió): le llega lo siguiente de su cola
      if (mensaje.ficha === 'entendido') this.guiado.alEntender(jugadorId);
    }
    return null;
  }

  /**
   * El despertar guiado, revisado: el narrador manda lo que ha decidido (una de las
   * opciones, o cambiada) al de una fila que había que revisar. Devuelve el error, si lo hay.
   */
  resolverHabilidad(personajeId: string, borrador: BorradorDespertar): string | null {
    const mensaje = this.componerMensaje(borrador, true);
    return 'error' in mensaje ? mensaje.error : this.guiado.resolver(personajeId, mensaje);
  }

  /** El Imp se ha elegido a sí mismo: el nuevo es el de ese asiento. Devuelve el error, si lo hay. */
  elegirNuevoImp(jugadorId: string): string | null {
    return this.sala.jugador(jugadorId) ? this.guiado.elegirNuevoImp(jugadorId) : 'Ese asiento ya no existe.';
  }

  /** El mensaje de un despertar, limpio (ver componerMensaje); con tarjetas, si lo manda el narrador. */
  private componerMensaje(borrador: BorradorDespertar, conTarjetas: boolean) {
    return componerMensaje(borrador, conTarjetas, { hayAsiento: (id) => !!this.sala.jugador(id), personaje: (id) => this.guion.personaje(id) });
  }

  /**
   * Manda algo del narrador a un asiento despierto (`guiado`: desde el despertar guiado);
   * con «Tú eres», su ficha pasa a ser la que se le dice.
   */
  mandarDelNarrador(
    jugadorId: string,
    envio: EnvioDespertar,
    { eleccion, guiado = false }: { eleccion?: EleccionDespertar; guiado?: boolean } = {},
  ): void {
    this.despertares.enviar(jugadorId, { ...envio, autor: 'narrador', guiado, ...(eleccion ? { eleccion } : {}) });
    if (envio.tarjeta === 'tuEres') this.entregas.comunicarFicha(jugadorId, envio.personajes, envio.alineamiento);
  }

  /** Pone un recordatorio de un personaje por su texto (en el original), único en la plaza (ver recordatorioQueSobra). */
  private ponerRecordatorioDe(jugadorId: string, personajeId: string, texto: string): void {
    const textos = this.guion.personaje(personajeId)?.recordatorios ?? [];
    const indice = textos.findIndex((t) => t.toLowerCase() === texto.toLowerCase());
    if (indice < 0) return;
    const sobra = this.grimorio.recordatorioQueSobra(jugadorId, personajeId, indice);
    if (sobra) this.grimorio.quitarRecordatorio(sobra.jugadorId, sobra.recordatorioId);
    this.grimorio.ponerRecordatorio(jugadorId, { personaje: personajeId, indice, texto: textos[indice] });
  }

  /** Envía a quien se sienta en un asiento el grimorio tal como está (el Espía); a un asiento libre, nada. */
  private enviarGrimorioDeLaPlaza(jugadorId: string): void {
    const plaza = this.plaza();
    if (!plaza.find((a) => a.id === jugadorId)?.participanteId) return;
    const fichas: FichaEnviada[] = plaza.map((a) => ({
      jugadorId: a.id,
      personaje: a.personaje,
      alineamiento: a.alineamiento,
      muerto: a.muerto,
      recordatorios: a.recordatorios.map((r) => ({ ...r, id: randomUUID() })),
    }));
    this.entregas.enviarGrimorio(jugadorId, fichas);
  }

  /**
   * Deja la partida como al principio, en la preparación: sin registro de
   * votaciones, todas las fichas vivas, sin personaje y sin calavera, la bolsa
   * vacía, sin nominación y nadie con acceso al grimorio (las peticiones
   * pendientes siguen). Los jugadores siguen en sus asientos.
   */
  limpiarGrimorio(): void {
    this.nominaciones.cerrarNominacion();
    this.senalamientos.terminar();
    this.reloj.quitarReloj();
    this.avisar({ tipo: 'nuevaPartida' });
    this.npcs.nuevaPartida();
    this.nominaciones.olvidarTodo();
    this.grimorio.limpiar();
    this.bolsa.olvidar();
    this.entregas.olvidar();
    this.faroles.vaciar();
    this.revelacion.olvidar();
    this.acceso.nuevaPartida();
    this.despertares.cerrarTodos();
    this.guiado.olvidar();
    this.declaraciones.olvidar();
    this.recordatorios = {};
    this.fases.nuevaPartida();
  }

  /** Las votaciones son secretas (el Organ Grinder, ver personajes/organGrinder.ts). */
  votacionSecreta(): boolean {
    return this.reglas.votacionSecreta();
  }

  /**
   * Abre la nominación. Lo que pase al nominar lo dicen las reglas (ver
   * ReglaPersonaje.alNominar): con la Virgen, su recordatorio y, si toca, la
   * ejecución al momento de quien nomina (se cierra la nominación). Si depende de
   * cómo registra quien nomina (el Espía) y `registro` no lo dice, no se nomina:
   * se devuelve la pregunta, para volver a nominar con la respuesta (y nadie ve
   * nada hasta entonces). Devuelve la ejecución (ver ejecutar) o null; si algún
   * asiento ya no está, el error.
   */
  nominar(
    desde: string,
    hasta: string,
    registro: RegistroAlNominar = {},
  ): { error: string } | { pregunta: 'comoAldeano' } | { anochece: boolean; final: boolean } | null {
    const plaza = this.plaza();
    const nominador = plaza.find((a) => a.id === desde);
    const nominado = plaza.find((a) => a.id === hasta);
    if (!nominador || !nominado) return { error: 'Ese asiento ya no existe.' };
    // Pedir la expulsión de un viajero no es nominar
    const efectos = nominador && nominado && !this.bolsa.llevaViajero(nominado) ? this.reglas.alNominar(nominador, nominado, registro) : null;
    if (efectos && 'pregunta' in efectos) return efectos;
    this.nominaciones.nominar(desde, hasta);
    if (!efectos) return null;
    for (const r of efectos.recordatorios) this.ponerRecordatorioDe(hasta, r.personaje, r.texto);
    if (!efectos.ejecutaAlNominador) return null;
    this.nominaciones.cerrarNominacion();
    return this.ejecutar(desde);
  }

  /** En la nominación, da la palabra a un participante (los demás jugadores callan) o, con null, a todos. Devuelve el error, si lo hay. */
  darPalabra(participanteId: string | null): string | null {
    if (participanteId !== null && !this.sala.participantes.buscar(participanteId)) return 'Esa persona ya no está en la sala.';
    return this.nominaciones.darPalabra(participanteId);
  }

  /**
   * Pone o quita la calavera a la ficha de un asiento (solo una puede llevarla) y,
   * si `cerrarNominacion`, cierra la nominación. Si se marca al nominado de una
   * nominación ya votada, se guardan sus votos (el narrador los ve, para saber si
   * otra votación empata). Devuelve el error, si lo hay.
   */
  marcar(jugadorId: string, marcado: boolean, cerrarNominacion: boolean): string | null {
    if (!this.sala.jugador(jugadorId)) return 'Ese asiento ya no existe.';
    const n = this.nominaciones.nominacion();
    const votos = n?.votacion?.terminada && n.hasta === jugadorId ? n.votacion.votos : null;
    this.grimorio.marcar(jugadorId, marcado, votos);
    if (cerrarNominacion) this.nominaciones.cerrarNominacion();
    return null;
  }

  /** Quita la calavera a quien la lleve y, como marcar, cierra la nominación. */
  desmarcar(): void {
    this.grimorio.desmarcar();
    this.nominaciones.cerrarNominacion();
  }

  /**
   * Mientras hay un señalamiento (también congelado, hasta que el narrador lo quite),
   * quien lo ve no levanta la mano: las manos de señalar van en las fichas. De noche,
   * quien no lo ve sigue igual (así no sabe que lo hay).
   */
  manosBloqueadas(participante: Participante): boolean {
    return this.senalamientos.veSenalamiento(participante);
  }

  /** Empieza un señalamiento (ver Senalamientos.empezar); quien lo ve baja la mano. Devuelve el error, si lo hay. */
  empezarSenalamiento(datos: Parameters<Senalamientos['empezar']>[0]): string | null {
    const error = this.senalamientos.empezar(datos);
    if (error) return error;
    // Quien lo ve baja la mano (no se puede levantar mientras dure)
    for (const participante of this.sala.participantes.participantes()) {
      if (participante.manoLevantada && this.senalamientos.veSenalamiento(participante)) {
        this.sala.participantes.levantarMano(participante.id, false);
      }
    }
    return null;
  }

  /**
   * Lil' Monsta (de noche, con él en el guion, sin demonio y con un esbirro de más):
   * despierta a los esbirros vivos y señalan, sin cuenta atrás, hasta que todos
   * eligen al mismo (ese lo cuida: ver senalar). Si no se puede, el error.
   */
  empezarLilmonsta(): string | null {
    const esbirros = this.esbirrosLilmonsta();
    if (!esbirros) return "Lil' Monsta se empieza de noche, sin demonio en la plaza y con un esbirro de más.";
    return this.empezarSenalamiento({
      tipo: 'lilmonsta',
      mensaje: "Esbirros, elegid quién cuida de Lil' Monsta",
      segundos: null,
      senaladores: esbirros,
      objetivos: esbirros,
    });
  }

  /**
   * El jugador de un asiento que señala, señala a otro (null: deja de señalar).
   * Con Lil' Monsta, cuando todos los esbirros sentados señalan al mismo, se
   * congela y ese lleva su «Is The Demon». Devuelve el error, si lo hay.
   */
  senalar(participanteId: string, objetivo: string | null): string | null {
    const error = this.senalamientos.senalar(participanteId, objetivo);
    const desde = this.jugadorDe(participanteId);
    if (!error && desde) {
      this.anotar({ tipo: 'senala', asiento: this.asientoDiario(desde.id), objetivo: objetivo === null ? null : this.asientoDiario(objetivo) });
    }
    if (!error && objetivo !== null && this.senalamientos.senalamiento()?.tipo === 'lilmonsta') this.resolverLilmonsta();
    return error;
  }

  /** Lil' Monsta: si todos los esbirros sentados señalan al mismo, ese lo cuida (ver personajes/lilMonsta.ts). */
  private resolverLilmonsta(): void {
    const s = this.senalamientos.senalamiento();
    const cuidador = s && cuidadorLilmonsta(this.contextoReglas, s);
    if (!cuidador) return;
    this.senalamientos.congelar();
    // Su «Is The Demon» pasa al que lo cuida (solo hay uno)
    const r = recordatorioLilmonsta(this.contextoReglas);
    if (!r) return;
    this.grimorio.quitarDeTodas(DEMONIO_LILMONSTA, r.indice);
    this.grimorio.ponerRecordatorio(cuidador, { personaje: DEMONIO_LILMONSTA, indice: r.indice, texto: r.texto });
  }

  /** Se puede empezar Lil' Monsta: los asientos de los esbirros vivos, o null (ver personajes/lilMonsta.ts). */
  esbirrosLilmonsta(): string[] | null {
    return esbirrosLilmonsta(this.contextoReglas, {
      noche: this.fases.actual().momento === 'noche',
      enElGuion: !!this.guion.actual()?.personajes.some((p) => p.id === DEMONIO_LILMONSTA),
      esbirrosQueTocan: this.bolsa.distribucion().esbirros,
    });
  }

  /**
   * El jugador despierto de ese participante copia en sus faroles los personajes
   * que el narrador le ha enseñado con «Estos personajes no están en juego» (los
   * de esa tarjeta, que tiene que estar en su despertar). Devuelve el error, si lo hay.
   */
  copiarFaroles(participanteId: string, personajes: readonly string[]): string | null {
    const jugadorId = this.despertares.asientoDespiertoDe(participanteId);
    if (!jugadorId) return 'No tienes ningún despertar abierto.';
    const mismos = (m: MensajeDespertar) =>
      m.autor === 'narrador' &&
      m.tarjeta === 'noEnJuego' &&
      m.personajes.length === personajes.length &&
      m.personajes.every((id, i) => id === personajes[i]);
    const hilo = this.despertares.despertares().find((d) => d.jugador === jugadorId);
    if (!hilo?.mensajes.some(mismos)) return 'El narrador no te ha enseñado esos personajes.';
    this.faroles.copiarFaroles(jugadorId, personajes.slice(0, NUM_FAROLES));
    return null;
  }

  /**
   * Revela el grimorio, si lo que ha pasado cuadra: las causas (CAUSAS_FIN_PARTIDA)
   * son de personajes en juego (quien es de verdad cada uno) y las de esbirro (la
   * Doncel cazada) dicen qué asiento fue, uno que es esbirro de verdad. Si no, el
   * error. Ver empezarRevelacion.
   */
  revelarGrimorio(ganador: Alineamiento, causas: readonly string[], esbirros: Readonly<Record<string, string>>): string | null {
    const enJuego = new Set(this.plaza().map((a) => identidadDe(a)));
    if (causas.some((c) => !CAUSAS_FIN_PARTIDA.includes(c) || !enJuego.has(c))) return 'Hay un personaje que no está en juego.';
    const esEsbirro = (jugadorId: string | undefined) => {
      const jugador = this.plaza().find((a) => a.id === jugadorId);
      const quien = jugador ? identidadDe(jugador) : null;
      return !!quien && this.guion.personaje(quien)?.tipo === 'minion';
    };
    const deEsbirro = causas.filter((c) => CAUSAS_DE_ESBIRRO.includes(c));
    if (deEsbirro.some((c) => !esEsbirro(esbirros[c]))) return 'Elige qué esbirro descubrió a la Doncel.';
    this.empezarRevelacion(ganador, [...new Set(causas)], Object.fromEntries(deEsbirro.map((c) => [c, esbirros[c]])));
    return null;
  }

  /**
   * Empieza a revelar el grimorio: ha ganado ese bando (y lo que haya pasado, ver
   * CAUSAS_FIN_PARTIDA) y todas las fichas se dan la vuelta.
   */
  empezarRevelacion(ganador: Alineamiento, causas: string[] = [], esbirros: Record<string, string> = {}): void {
    // Se acaba todo lo que corre: la nominación (y su cuenta atrás o votación), el reloj y el señalamiento
    this.nominaciones.cerrarNominacion();
    this.reloj.quitarReloj();
    this.senalamientos.terminar();
    this.revelacion.empezar(ganador, causas);
    // Se acaba la partida. Las causas de esbirro (la Doncel cazada), de la cuenta del
    // esbirro que eligió el narrador
    this.avisar({
      tipo: 'partidaTerminada',
      ganador,
      causas: causas.map((id) => {
        const asiento = esbirros[id];
        if (!asiento) return { id };
        return { id, userId: this.cuentaDelAsiento(asiento) };
      }),
      plaza: this.fotoDeLaPlaza(),
      narradores: this.sala.participantes.narradores().map((p) => ({ userId: this.cuentaDe(p.id), nombre: p.nombre })),
      npcs: this.npcs.npcs(),
      votaciones: this.nominaciones.votaciones(),
      guion: this.guion.actual()?.nombre ?? null,
      edicion: this.guion.actual()?.edicion ?? null,
      dias: this.fases.actual().numero,
    });
  }

  /**
   * Ejecuta al de un asiento (el que lleva la calavera): muere como al matarlo,
   * salvo que no le llegue (ver Objetivo: el Marinero, el Bufón), y se le ponen los
   * recordatorios de los personajes que funcionan con las ejecuciones (ver Reglas). Luego anochece, salvo si una regla lo impide (el
   * Carnicero vivo: puede haber otra ejecución) o si quedan solo dos
   * jugadores vivos (`final`): entonces decide el narrador si se va a la noche o
   * se revela el grimorio. Devuelve si ha anochecido y si quedan dos, o null si
   * el asiento no existe.
   */
  ejecutar(jugadorId: string): { anochece: boolean; final: boolean } | null {
    const jugador = this.plaza().find((a) => a.id === jugadorId);
    if (!jugador) return null;
    // Los recordatorios de los personajes que funcionan con las ejecuciones (ver Reglas)
    for (const { personaje, texto, unico } of this.reglas.recordatoriosAlEjecutar(jugador)) {
      const textos = this.guion.personaje(personaje)?.recordatorios;
      const indice = textos?.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1;
      if (indice < 0) continue;
      if (unico) this.grimorio.quitarDeTodas(personaje, indice);
      this.grimorio.ponerRecordatorio(jugador.id, { personaje, indice, texto: textos![indice] }, { anotar: false });
    }
    this.avisar({ tipo: 'ejecucion', userId: this.cuentaDe(jugador.participanteId) });
    this.anotar({ tipo: 'ejecucion', asiento: this.asientoDiario(jugador.id) });
    // Ninguna regla deja elegir al ejecutar: el primer desenlace, el que toca
    const [{ a, gasta }] = this.reglas.objetivo(jugador).recibe({ origen: 'ejecucion', personaje: null, efecto: 'matar' });
    if (gasta) this.ponerRecordatorioDe(gasta.asiento, gasta.personaje, gasta.texto);
    if (a) this.grimorio.cambiarVida(a.id, true, { anotar: false });
    // Los vivos que quedan: los asientos (también los libres, que cuentan como jugadores)
    // sin muerte, sin contar a los viajeros
    const vivos = this.plaza().filter((a) => !a.muerto && !a.muertePendiente && !this.bolsa.llevaViajero(a)).length;
    const final = vivos <= 2;
    // Con narrador virtual, anochece él cuando acaba de decirlo (o revela, si se acaba la partida)
    const anochece = !final && !this.entorno.hayNarradorVirtual() && this.reglas.anocheceTrasEjecutar();
    if (anochece) this.irANoche();
    return { anochece, final };
  }

  /**
   * El narrador ejecuta al que lleva la calavera (ver ejecutar; la Virgen, en
   * cambio, ejecuta a quien la nomina sin ella). Devuelve el error, o si quedan dos vivos.
   */
  ejecutarConCalavera(jugadorId: string): { error: string } | { final: boolean } {
    const jugador = this.plaza().find((a) => a.id === jugadorId);
    if (!jugador) return { error: 'Ese asiento ya no existe.' };
    if (this.grimorio.calavera()?.jugadorId !== jugador.id) return { error: 'Solo se ejecuta a quien lleva la calavera.' };
    const { final } = this.ejecutar(jugador.id) ?? { final: false };
    return { final };
  }

  /**
   * Reparte al azar los personajes de la bolsa entre los asientos que no llevan
   * viajero (tiene que haber en la bolsa tantos como esos asientos). Con el
   * Gardener, los jugadores no los ven hasta que el narrador los entregue.
   * Devuelve el error, si lo hay.
   */
  repartirPersonajes(): string | null {
    const hacen = this.bolsa.fichasParaRepartir();
    const hay = this.bolsa.fichas().length;
    if (hacen === 0) return 'No hay asientos a los que repartir.';
    if (hay !== hacen) return `En la bolsa tiene que haber ${hacen} personajes y hay ${hay}.`;
    this.bolsa.repartir();
    if (this.npcs.activo(NPC_GARDENER)) this.entregas.retenerFichas(true);
    else this.entregas.entregarFichas();
    return null;
  }

  /** No puede votar: no está sentado, o las reglas dicen que no (ver Reglas.puedeVotar). */
  sinVoto(participanteId: string): boolean {
    const jugador = this.jugadorDe(participanteId);
    if (!jugador) return true;
    // En la expulsión de un viajero vota cualquiera (los muertos, sin gastar su voto)
    if (this.nominaciones.esExpulsion()) return false;
    return !this.reglas.puedeVotar(jugador);
  }

  /**
   * Los jugadores solo pueden conversar en privado con sus vecinos (la Institutriz
   * viva). Se llama así por ella, que es quien lo pide (ver personajes/institutriz.ts).
   */
  institutrizViva(): boolean {
    return this.reglas.soloVecinos();
  }

  /** El Voudon está vivo en la plaza (ver personajes/voudon.ts). */
  voudonVivo(): boolean {
    return voudonVivo(this.contextoReglas);
  }

  /** Puede votar con las dos manos (dos votos): la Banshee con su habilidad (ver personajes/banshee.ts). */
  puedeVotarDoble(participanteId: string): boolean {
    const jugador = this.jugadorDe(participanteId);
    return !!jugador && this.reglas.votaDoble(jugador);
  }
}
