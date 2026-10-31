import { randomUUID } from 'crypto';
import type {
  SalaAlineamiento,
  SalaAsiento,
  SalaEleccionDespertar,
  SalaEnvioDespertar,
  SalaFichaEnviada,
} from '../../contrato/sala';
import type { AsientoDiario, HechoDiario } from '../../contrato/diario';
import type { GuionResuelto } from '../../types/guiones';
import type { Participante } from '../sala/Participantes';
import type { Sala } from '../sala/Sala';
import { AccesoGrimorio } from './AccesoGrimorio';
import { Configuracion } from './Configuracion';
import { DespertarGuiado } from './DespertarGuiado';
import { Despertares } from './Despertares';
import { Entregas } from './Entregas';
import { type Diario, type EventoPartida, type FotoAsiento, type OyentePartida } from './eventos';
import { Faroles } from './Faroles';
import { Fases } from './Fases';
import { Grimorio, identidadDe } from './Grimorio';
import { Guion } from './Guion';
import { habilidadesDelGuion } from './habilidades';
import { Nominaciones } from './Nominaciones';
import { Npcs } from './Npcs';
import { NPC_GARDENER } from './personajesEspeciales';
import { Reglas } from './reglas';
import type { ContextoReglas, RegistroAlNominar } from './reglas/ReglaPersonaje';
import { cuidadorLilmonsta, DEMONIO_LILMONSTA, esbirrosLilmonsta, recordatorioLilmonsta } from './reglas/lilMonsta';
import { voudonVivo } from './reglas/voudon';
import { RelojSala } from './RelojSala';
import { Reparto } from './Reparto';
import { Revelacion } from './Revelacion';
import { Senalamientos } from './Senalamientos';

/** Lo que la partida necesita saber de fuera de la sala. */
export interface EntornoPartida {
  /** Hay un narrador virtual llevando la partida (él decide cuándo anochece tras ejecutar). */
  hayNarradorVirtual(): boolean;
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
  /** Lo que se hace con los jugadores de la mesa, los apuntes del narrador y la calavera (ver Grimorio). */
  readonly grimorio = new Grimorio({
    jugadores: () => this.sala.jugadores(),
    personaje: (id) => this.guion.personaje(id),
    noche: () => this.fases.actual().momento === 'noche',
    anotar: (hecho) => this.anotar(hecho),
    asientoDiario: (asientoId) => this.asientoDiario(asientoId),
  });
  /** Lo que las reglas de los personajes pueden consultar de la partida. */
  private readonly contextoReglas: ContextoReglas = {
    mesa: () => this.mesa(),
    identidad: (asiento) => identidadDe(asiento),
    alineamiento: (asiento) => this.grimorio.alineamiento(asiento),
    personaje: (id) => this.guion.personaje(id),
  };
  /** Las reglas de los personajes (ver reglas/). */
  private readonly reglas = new Reglas(this.contextoReglas);
  /** Las nominaciones y votaciones del día (y quién tiene la palabra). */
  readonly nominaciones = new Nominaciones({
    mesa: () => this.mesa(),
    buscar: (id) => this.sala.participantes.buscar(id),
    bajarManos: () => this.sala.participantes.bajarManos(),
    cuentaDe: (id) => this.cuentaDe(id),
    llevaViajero: (asiento) => {
      const id = identidadDe(asiento);
      return !!id && this.guion.esViajero(id);
    },
    dia: () => this.fases.actual().numero,
    segundosPorFicha: () => this.configuracion.actual().segundosPorFicha,
    sinVoto: (id) => this.sinVoto(id),
    cambiarVoto: (asientoId, gastado) => this.grimorio.cambiarVoto(asientoId, gastado),
    votaSinGastar: (asiento) => this.reglas.votaSinGastar(asiento),
    mayoria: (vivos) => this.reglas.mayoria(vivos),
    valorDelVoto: (asiento, ocupante) => this.reglas.valorDelVoto(asiento, ocupante.dosManos),
    secreta: () => this.votacionSecreta(),
    alNominar: (desde, hasta) =>
      this.avisar({ tipo: 'nominacion', nomina: this.cuentaDelAsiento(desde), nominado: this.cuentaDelAsiento(hasta) }),
    alVotar: (cuenta) => this.avisar({ tipo: 'voto', userId: cuenta }),
    alDesvotar: (cuenta) => this.avisar({ tipo: 'desvoto', userId: cuenta }),
    alExpulsar: (asientoId) => this.grimorio.cambiarVida(asientoId, true),
    alCambiarSola: () => this.alCambiarSola(),
  });
  /** El gong y el reloj del narrador. */
  readonly reloj = new RelojSala();
  /** Los despertares de la noche. */
  readonly despertares = new Despertares(
    () => this.mesa(),
    () => this.fases.actual(),
    this.diario(),
  );
  /** El despertar guiado desde el orden de noche (ver DespertarGuiado). */
  readonly guiado = new DespertarGuiado({
    ctx: { ...this.contextoReglas, faroles: () => this.faroles.faroles() },
    habilidades: () => habilidadesDelGuion(this.guion.actual()?.edicion ?? null),
    noche: () => this.fases.actual().momento === 'noche',
    despertar: (asientoId) => this.despertares.despertar(asientoId),
    mandar: (asientoId, envio, eleccion) => this.mandarDelNarrador(asientoId, envio, { eleccion, guiado: true }),
    porEntender: (asientoId) => this.despertares.porEntender(asientoId),
    ponerRecordatorio: (asientoId, personaje, texto) => this.ponerRecordatorioDe(asientoId, personaje, texto),
    matarDeNoche: (asientoId) => this.grimorio.cambiarVida(asientoId, true),
    enviarGrimorio: (asientoId) => this.enviarGrimorioDeLaMesa(asientoId),
    cambiarPersonaje: (asientoId, personaje) => this.grimorio.cambiarPersonaje(asientoId, personaje),
  });
  /** Los faroles para el demonio (del narrador y de cada asiento). */
  readonly faroles = new Faroles(() => this.sala.jugadores(), this.diario());
  /** El final de la partida: qué bando ha ganado y qué fichas se han revelado. */
  readonly revelacion = new Revelacion(() => this.mesa());
  /** Los NPCs en juego y lo que traen (Bootlegger, Storm Catcher, silencio). */
  readonly npcs = new Npcs(() => this.guion.actual());
  /** Lo entregado a cada jugador y los grimorios enviados. */
  readonly entregas = new Entregas(() => this.mesa(), this.diario());
  /** La bolsa y el reparto de personajes. */
  readonly reparto = new Reparto({
    mesa: () => this.mesa(),
    esViajero: (id) => this.guion.esViajero(id),
    reglas: (asientos, personajes) => this.reglas.repartir(asientos, personajes),
    darPersonaje: (asientoId, personaje) => this.grimorio.repartir(asientoId, personaje),
  });
  /** El señalamiento en curso. */
  readonly senalamientos = new Senalamientos({
    mesa: () => this.mesa(),
    fase: () => this.fases.actual(),
    asientoDe: (id) => this.asientoDe(id),
    veGrimorio: (id) => this.acceso.de(id) === 'concedido',
    despertar: (asientoId) => void this.despertares.despertar(asientoId),
  });
  /** Recordatorios del orden de noche cambiados a mano (ver SalaEstado.recordatoriosNoche). */
  private recordatorios: Record<string, boolean> = {};

  /**
   * Los asientos con su ficha y sus faroles, en orden (ver Sala.asientos). Es una
   * copia para leer: las fichas se cambian en this.grimorio.
   */
  mesa(): SalaAsiento[] {
    return this.sala.jugadores().map((j) => ({
      id: j.id,
      ocupante: j.participanteId,
      ...this.grimorio.ficha(j.id),
      faroles: this.faroles.deJugador(j),
      farolEnUso: this.faroles.enUso(j),
    }));
  }

  /** El asiento (con su ficha) en el que se sienta un participante, o null. */
  asientoDe(participanteId: string): SalaAsiento | null {
    return this.mesa().find((a) => a.ocupante === participanteId) ?? null;
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
    this.reparto.bolsa.vaciar();
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
   * Apunta algo que se ha hecho en la partida, para su diario (ver contrato/diario).
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
    return { anotar: (hecho) => this.anotar(hecho), asiento: (asientoId) => this.asientoDiario(asientoId) };
  }

  /** Un asiento para el diario: su número y quien se sienta ahora. */
  asientoDiario(asientoId: string): AsientoDiario {
    const mesa = this.mesa();
    const i = mesa.findIndex((a) => a.id === asientoId);
    const ocupante = mesa[i]?.ocupante;
    return { numero: i + 1, nombre: ocupante ? (this.sala.participantes.buscar(ocupante)?.nombre ?? null) : null };
  }

  /** El id de usuario de un participante con cuenta, o null (invitado, o ya no está). */
  private cuentaDe(participanteId: string | null): string | null {
    return this.sala.participantes.cuentaDe(participanteId);
  }

  private cuentaDelAsiento(asientoId: string): string | null {
    return this.cuentaDe(this.mesa().find((a) => a.id === asientoId)?.ocupante ?? null);
  }

  /** Cómo está ahora la mesa, asiento a asiento (para quien escucha la partida). */
  private fotoDeLaMesa(): FotoAsiento[] {
    return this.mesa().map((a, i) => {
      const personaje = identidadDe(a);
      return {
        numero: i + 1,
        nombre: a.ocupante ? (this.sala.participantes.buscar(a.ocupante)?.nombre ?? null) : null,
        userId: this.cuentaDe(a.ocupante),
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
    const marcadas = this.mesa().filter((a) => a.marcado);
    this.avisar({
      tipo: 'anochece',
      desdePreparacion: this.fases.actual().momento === 'preparacion',
      mesa: this.fotoDeLaMesa(),
      conCalavera: marcadas.flatMap((a) => this.cuentaDe(a.ocupante) ?? []),
    });
    // Para poder volver: lo que se quita al anochecer
    this.fases.anochecer({
      marcas: marcadas.map((a) => ({ asiento: a.id, votos: a.votosMarca })),
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
    this.avisar({ tipo: 'amanece', mesa: this.fotoDeLaMesa() });
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

  /** Pone (true) o quita (false) a mano la ficha recordatorio de una fila del orden de noche. */
  cambiarRecordatorio(id: string, activo: boolean): void {
    this.recordatorios[id] = activo;
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
    this.despertares.enviar(asientoId, { ...envio, autor: 'narrador', guiado, ...(eleccion ? { eleccion } : {}) });
    if (envio.tarjeta === 'tuEres') this.entregas.comunicarFicha(asientoId, envio.personajes, envio.alineamiento);
  }

  /** Pone un recordatorio de un personaje por su texto (en el original), único en la mesa (ver recordatorioQueSobra). */
  private ponerRecordatorioDe(asientoId: string, personajeId: string, texto: string): void {
    const textos = this.guion.personaje(personajeId)?.recordatorios ?? [];
    const indice = textos.findIndex((t) => t.toLowerCase() === texto.toLowerCase());
    if (indice < 0) return;
    const sobra = this.grimorio.recordatorioQueSobra(asientoId, personajeId, indice);
    if (sobra) this.grimorio.quitarRecordatorio(sobra.jugadorId, sobra.recordatorioId);
    this.grimorio.ponerRecordatorio(asientoId, { personaje: personajeId, indice, texto: textos[indice] });
  }

  /** Envía a quien se sienta en un asiento el grimorio tal como está (el Espía); a un asiento libre, nada. */
  private enviarGrimorioDeLaMesa(asientoId: string): void {
    const mesa = this.mesa();
    if (!mesa.find((a) => a.id === asientoId)?.ocupante) return;
    const fichas: SalaFichaEnviada[] = mesa.map((a) => ({
      asientoId: a.id,
      personaje: a.personaje,
      alineamiento: a.alineamiento,
      muerto: a.muerto,
      recordatorios: a.recordatorios.map((r) => ({ ...r, id: randomUUID() })),
    }));
    this.entregas.enviarGrimorio(asientoId, fichas);
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
    this.reparto.olvidar();
    this.entregas.olvidar();
    this.faroles.vaciar();
    this.revelacion.olvidar();
    this.acceso.nuevaPartida();
    this.despertares.cerrarTodos();
    this.guiado.olvidar();
    this.recordatorios = {};
    this.fases.nuevaPartida();
  }

  /** Las votaciones son secretas (el Organ Grinder, ver reglas/organGrinder.ts). */
  votacionSecreta(): boolean {
    return this.reglas.votacionSecreta();
  }

  /**
   * Abre la nominación. Lo que pase al nominar lo dicen las reglas (ver
   * ReglaPersonaje.alNominar): con la Virgen, su recordatorio y, si toca, la
   * ejecución al momento de quien nomina (se cierra la nominación). Si depende de
   * cómo registra quien nomina (el Espía) y `registro` no lo dice, no se nomina:
   * se devuelve la pregunta, para volver a nominar con la respuesta (y nadie ve
   * nada hasta entonces). Devuelve la ejecución (ver ejecutar) o null.
   */
  nominar(
    desde: string,
    hasta: string,
    registro: RegistroAlNominar = {},
  ): { pregunta: 'comoAldeano' } | { anochece: boolean; final: boolean } | null {
    const mesa = this.mesa();
    const nominador = mesa.find((a) => a.id === desde);
    const nominado = mesa.find((a) => a.id === hasta);
    // Pedir la expulsión de un viajero no es nominar
    const efectos = nominador && nominado && !this.reparto.llevaViajero(nominado) ? this.reglas.alNominar(nominador, nominado, registro) : null;
    if (efectos && 'pregunta' in efectos) return efectos;
    this.nominaciones.nominar(desde, hasta);
    if (!efectos) return null;
    for (const r of efectos.recordatorios) this.ponerRecordatorioDe(hasta, r.personaje, r.texto);
    if (!efectos.ejecutaAlNominador) return null;
    this.nominaciones.cerrarNominacion();
    return this.ejecutar(desde);
  }

  /**
   * Mientras hay un señalamiento (también congelado, hasta que el narrador lo quite),
   * quien lo ve no levanta la mano: las manos de señalar van en las fichas. De noche,
   * quien no lo ve sigue igual (así no sabe que lo hay).
   */
  manosBloqueadas(participante: Participante): boolean {
    return this.senalamientos.veSenalamiento(participante);
  }

  /** Empieza un señalamiento (ver Senalamientos.empezar); quien lo ve baja la mano. */
  empezarSenalamiento(datos: Parameters<Senalamientos['empezar']>[0]): void {
    this.senalamientos.empezar(datos);
    // Quien lo ve baja la mano (no se puede levantar mientras dure)
    for (const participante of this.sala.participantes.participantes()) {
      if (participante.manoLevantada && this.senalamientos.veSenalamiento(participante)) {
        this.sala.participantes.levantarMano(participante.id, false);
      }
    }
  }

  /**
   * El jugador de un asiento que señala, señala a otro (null: deja de señalar).
   * Con Lil' Monsta, cuando todos los esbirros sentados señalan al mismo, se
   * congela y ese lleva su «Is The Demon». Devuelve el error, si lo hay.
   */
  senalar(participanteId: string, objetivo: string | null): string | null {
    const error = this.senalamientos.senalar(participanteId, objetivo);
    const desde = this.asientoDe(participanteId);
    if (!error && desde) {
      this.anotar({ tipo: 'senala', asiento: this.asientoDiario(desde.id), objetivo: objetivo === null ? null : this.asientoDiario(objetivo) });
    }
    if (!error && objetivo !== null && this.senalamientos.senalamiento()?.tipo === 'lilmonsta') this.resolverLilmonsta();
    return error;
  }

  /** Lil' Monsta: si todos los esbirros sentados señalan al mismo, ese lo cuida (ver reglas/lilMonsta.ts). */
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

  /** Se puede empezar Lil' Monsta: los asientos de los esbirros vivos, o null (ver reglas/lilMonsta.ts). */
  esbirrosLilmonsta(): string[] | null {
    return esbirrosLilmonsta(this.contextoReglas, {
      noche: this.fases.actual().momento === 'noche',
      enElGuion: !!this.guion.actual()?.personajes.some((p) => p.id === DEMONIO_LILMONSTA),
      esbirrosQueTocan: this.reparto.distribucion().esbirros,
    });
  }

  /**
   * Empieza a revelar el grimorio: ha ganado ese bando (y lo que haya pasado, ver
   * CAUSAS_FIN_PARTIDA) y todas las fichas se dan la vuelta.
   */
  empezarRevelacion(ganador: SalaAlineamiento, causas: string[] = [], esbirros: Record<string, string> = {}): void {
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
      mesa: this.fotoDeLaMesa(),
      narradores: this.sala.participantes.narradores().map((p) => ({ userId: this.cuentaDe(p.id), nombre: p.nombre })),
      npcs: this.npcs.npcs(),
      votaciones: this.nominaciones.votaciones(),
      guion: this.guion.actual()?.nombre ?? null,
      edicion: this.guion.actual()?.edicion ?? null,
      dias: this.fases.actual().numero,
    });
  }

  /**
   * Ejecuta al de un asiento (el que lleva la calavera): muere como al matarlo y
   * se le ponen los recordatorios de los personajes que funcionan con las
   * ejecuciones (ver Reglas). Luego anochece, salvo si una regla lo impide (el
   * Carnicero vivo: puede haber otra ejecución) o si quedan solo dos
   * jugadores vivos (`final`): entonces decide el narrador si se va a la noche o
   * se revela el grimorio. Devuelve si ha anochecido y si quedan dos, o null si
   * el asiento no existe.
   */
  ejecutar(asientoId: string): { anochece: boolean; final: boolean } | null {
    const asiento = this.mesa().find((a) => a.id === asientoId);
    if (!asiento) return null;
    // Los recordatorios de los personajes que funcionan con las ejecuciones (ver Reglas)
    for (const { personaje, texto, unico } of this.reglas.recordatoriosAlEjecutar(asiento)) {
      const textos = this.guion.personaje(personaje)?.recordatorios;
      const indice = textos?.findIndex((t) => t.toLowerCase() === texto.toLowerCase()) ?? -1;
      if (indice < 0) continue;
      if (unico) this.grimorio.quitarDeTodas(personaje, indice);
      this.grimorio.ponerRecordatorio(asiento.id, { personaje, indice, texto: textos![indice] }, { anotar: false });
    }
    this.avisar({ tipo: 'ejecucion', userId: this.cuentaDe(asiento.ocupante) });
    this.anotar({ tipo: 'ejecucion', asiento: this.asientoDiario(asiento.id) });
    this.grimorio.cambiarVida(asiento.id, true, { anotar: false });
    // Los vivos que quedan: los asientos (también los libres, que cuentan como jugadores)
    // sin muerte, sin contar a los viajeros
    const vivos = this.mesa().filter((a) => !a.muerto && !a.muertePendiente && !this.reparto.llevaViajero(a)).length;
    const final = vivos <= 2;
    // Con narrador virtual, anochece él cuando acaba de decirlo (o revela, si se acaba la partida)
    const anochece = !final && !this.entorno.hayNarradorVirtual() && this.reglas.anocheceTrasEjecutar();
    if (anochece) this.irANoche();
    return { anochece, final };
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

  /** El Voudon está vivo en la mesa (ver reglas/voudon.ts). */
  voudonVivo(): boolean {
    return voudonVivo(this.contextoReglas);
  }

  /** Puede votar con las dos manos (dos votos): la Banshee con su habilidad (ver reglas/banshee.ts). */
  puedeVotarDoble(participanteId: string): boolean {
    const asiento = this.asientoDe(participanteId);
    return !!asiento && this.reglas.votaDoble(asiento);
  }
}
