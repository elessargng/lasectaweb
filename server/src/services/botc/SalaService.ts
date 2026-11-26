import { SalaDeJuego } from '../../models/botc/SalaDeJuego';
import { limpiarNombreSala, SALA_AVATAR_INVITADO, type Participante, type SalaLlegada } from '../../models/botc/sala/Participantes';
import { resumenPartida } from '../../models/botc/partida/proyecciones/resumenPartida';
import { temporizadorReal, type RespuestaAccion } from '../../models/botc/narradorVirtual/puertos';
import { ChatError, ChatService } from './ChatService';
import { ConversacionError, ConversacionService } from './ConversacionService';
import { VideollamadaError, VideollamadaService, type PaseVideo } from './VideollamadaService';
import { NarradorVirtualService } from './NarradorVirtualService';
import { NarradorIAService } from './NarradorIAService';
import { BolsaService } from './BolsaService';
import { RelojService } from './RelojService';
import { RevelacionService } from './RevelacionService';
import { SenalamientoService } from './SenalamientoService';
import { FarolService } from './FarolService';
import { FaseService } from './FaseService';
import { NocheService } from './NocheService';
import { DiaService } from './DiaService';
import { PreparacionService } from './PreparacionService';
import { GrimorioService } from './GrimorioService';
import { ParticipantesService } from './ParticipantesService';
import { ImagenesSala } from './ImagenesSala';
import { VERSION_PARTIDA_GUARDADA, type DependenciasSala, type DifusorSala, type PartidaGuardada } from './puertos';

/** Quien llega a la sala, antes de entrar. */
export interface PeticionLlegada {
  /** El usuario de la web (con su token ya comprobado), o null si entra como invitado. */
  usuario: { id: string; username: string } | null;
  /** El nombre con el que entra el invitado. */
  nombre?: unknown;
  /** El nombre y el avatar que prefiere mostrar, si los cambió. */
  alias?: unknown;
  avatar?: unknown;
  /** Su id de cliente, para recuperar el sitio si se reconecta. */
  clienteId: string | null;
}

/** Por qué no puede entrar: sin nombre, o con el de otro (el cliente lo devuelve a elegir otro). */
export type ErrorLlegada = 'SIN_NOMBRE' | 'NOMBRE_OCUPADO';

/** Cuánto se espera tras un cambio para guardar la partida en curso (los que llegan mientras, van juntos). */
export const ESPERA_GUARDAR_MS = 1000;

/** Cómo se contesta a quien pide algo; se le contesta antes de difundir la sala, para que le llegue antes. */
export type Responder<R = RespuestaAccion> = (respuesta: R) => void;

/** Hasta que se le da un difusor, la sala no avisa a nadie (y ninguna conexión sigue abierta). */
const SIN_DIFUSOR: DifusorSala = {
  estado: () => {},
  guion: () => {},
  historial: () => {},
  voz: () => {},
  mensaje: () => {},
  susurro: () => {},
  expulsar: () => {},
  sigueAbierta: () => false,
};

/**
 * La sala de juego en tiempo real (servicio de aplicación): junta la partida, el
 * chat, las conversaciones, la videollamada, el narrador virtual y las
 * estadísticas. Quien la usa (SalaController, hoy por socket) le pasa lo que piden los
 * participantes; tras cada cambio, la sala se manda entera a todos por el difusor.
 */
export class SalaService {
  readonly juego: SalaDeJuego;
  private readonly chat: ChatService;
  private readonly imagenes: ImagenesSala;
  /** La bolsa de la partida (ver BolsaController). */
  readonly bolsa: BolsaService;
  /** El gong y el reloj del narrador (ver RelojController). */
  readonly reloj: RelojService;
  /** La revelación del grimorio al acabar (ver RevelacionController). */
  readonly revelacion: RevelacionService;
  /** Los señalamientos (ver SenalamientoController). */
  readonly senalamiento: SenalamientoService;
  /** Los faroles del demonio y de cada jugador (ver FarolController). */
  readonly faroles: FarolService;
  /** El paso de las fases (ver FaseController). */
  readonly fase: FaseService;
  /** La noche: los despertares (ver NocheController). */
  readonly noche: NocheService;
  /** El día: nominaciones, votación, calavera y ejecución (ver DiaController). */
  readonly dia: DiaService;
  /** La preparación: ajustes, guion, fondo, NPCs, repartir y entregar (ver PreparacionController). */
  readonly preparacion: PreparacionService;
  /** El grimorio del narrador: fichas, recordatorios, notas y enviarlo (ver GrimorioController). */
  readonly grimorio: GrimorioService;
  /** Quién está en la sala y dónde: nombre, avatar, mano, asientos y papeles (ver ParticipantesController). */
  readonly participantes: ParticipantesService;
  private readonly conversaciones: ConversacionService;
  private readonly videollamada: VideollamadaService | null;
  /** El narrador virtual: añadirlo, quitarlo y lo que le piden los jugadores (ver NarradorVirtualController). */
  readonly narradorVirtual: NarradorVirtualService;
  private difusor: DifusorSala = SIN_DIFUSOR;
  /** El guion no va en cada estado: se manda aparte, solo cuando cambia y a quien entra. */
  private versionGuionMandada: number;
  /**
   * Recuperada la sala tras un reinicio: el asiento (o el papel de narrador) de cada
   * cuenta, hasta que vuelve a entrar (ver recuperar).
   */
  private readonly reservas = new Map<string, { asiento: string | null; narrador: boolean }>();
  /** Lo que se está guardando de la partida en curso (en orden), y si hay un guardado esperando. */
  private guardando: Promise<void> = Promise.resolve();
  private guardadoPendiente = false;

  constructor(private readonly deps: DependenciasSala) {
    this.juego = new SalaDeJuego(deps.azar);
    const { sala, partida } = this.juego;
    // Al revelar el grimorio, la partida se guarda para las estadísticas (sacada de su diario)
    if (deps.guardarPartida) {
      const guardar = deps.guardarPartida;
      partida.alTerminar = (diario, id) => {
        const registro = resumenPartida(id, diario);
        if (!registro) return;
        guardar(registro)
          .then(async () => {
            // Con una partida más, quien deja de ser novato pierde el pulpito
            if (!deps.contarPartidas) return;
            for (const { userId } of registro.jugadores) sala.participantes.cambiarPartidasJugadas(userId, await deps.contarPartidas(userId));
            this.difundir();
          })
          .catch((err) => console.error('[SALA] No se ha podido guardar la partida:', err));
      };
    }
    this.chat = new ChatService(deps.mensajes, this.juego);
    this.imagenes = new ImagenesSala(deps.imagenes);
    // Lo que cambia cada parte de la sala se manda a todos (y el guion, si ha cambiado)
    const alCambiar = () => {
      this.mandarGuionSiCambia();
      this.difundir();
    };
    this.bolsa = new BolsaService(this.juego, alCambiar);
    this.reloj = new RelojService(this.juego, alCambiar);
    this.revelacion = new RevelacionService(this.juego, alCambiar);
    this.senalamiento = new SenalamientoService(this.juego, alCambiar);
    this.faroles = new FarolService(this.juego, alCambiar);
    this.fase = new FaseService(this.juego, alCambiar);
    this.noche = new NocheService(this.juego, alCambiar);
    this.dia = new DiaService(this.juego, alCambiar);
    this.grimorio = new GrimorioService(this.juego, alCambiar);
    this.participantes = new ParticipantesService(this.juego, alCambiar, this.imagenes, (conexion) => this.difusor.expulsar(conexion, 'narrador'));
    this.preparacion = new PreparacionService(this.juego, alCambiar, {
      guiones: deps.guiones,
      imagenesBiblioteca: deps.imagenesBiblioteca,
      imagenes: this.imagenes,
    });
    this.conversaciones = new ConversacionService(this.juego);
    // Sin servidor de vídeo configurado, la sala funciona igual, sin cámaras ni micrófonos
    this.videollamada = deps.video ? new VideollamadaService(deps.video, this.juego, this.conversaciones) : null;
    this.versionGuionMandada = partida.guion.version();

    const cuentaDe = (participanteId: string) => sala.participantes.cuentaDe(participanteId);
    this.narradorVirtual = new NarradorVirtualService(
      this.juego,
      // Actúa como un narrador más: por los mismos servicios (y permisos), y la sala se difunde
      (participanteId) => ({
        asientos: async (cambio) => this.participantes.asientos(participanteId, cambio),
        accesoGrimorio: async (otroId, conceder) => this.participantes.accesoGrimorio(participanteId, otroId, conceder),
        llenarBolsa: async (personajes) => this.bolsa.llenar(participanteId, personajes),
        sonarGong: async () => this.reloj.sonarGong(participanteId),
        ponerReloj: async (segundos, mensaje) => this.reloj.poner(participanteId, segundos, mensaje),
        terminarReloj: async () => this.reloj.terminar(participanteId),
        revelarGrimorio: async (ganador, causas) => this.revelacion.empezar(participanteId, ganador, causas, {}),
        revelarFicha: async (jugadorId) => this.revelacion.revelarFicha(participanteId, jugadorId),
        empezarSenalamiento: async (peticion) => this.senalamiento.empezar(participanteId, peticion),
        terminarSenalamiento: async () => this.senalamiento.terminar(participanteId),
        prepararFarol: async (posicion, personajeId) => this.faroles.preparar(participanteId, posicion, personajeId),
        irANoche: async () => this.fase.irANoche(participanteId),
        amanecer: async () => this.fase.amanecer(participanteId),
        limpiarGrimorio: async () => this.fase.limpiarGrimorio(participanteId),
        despertar: async (jugadorId) => this.noche.despertar(participanteId, jugadorId),
        enviarDespertar: async (jugadorId, mensaje) => this.noche.enviar(participanteId, [jugadorId], mensaje),
        despertarHabilidad: async (personajeId) => this.noche.despertarHabilidad(participanteId, personajeId),
        resolverHabilidad: async (personajeId, mensaje) => this.noche.resolverHabilidad(participanteId, personajeId, mensaje),
        nuevoImp: async (jugadorId) => this.noche.nuevoImp(participanteId, jugadorId),
        darPalabra: async (otroId) => this.dia.darPalabra(participanteId, otroId),
        nominar: async (desde, hasta, comoAldeano) => this.dia.nominar(participanteId, desde, hasta, comoAldeano),
        cuentaAtras: async () => this.dia.cuentaAtras(participanteId),
        marcar: async (jugadorId, marcado) => this.dia.marcar(participanteId, jugadorId, marcado, true),
        desmarcar: async () => this.dia.desmarcar(participanteId),
        cerrarNominacion: async () => this.dia.cerrarNominacion(participanteId),
        ejecutar: async (jugadorId) => this.dia.ejecutar(participanteId, jugadorId),
        cambiarGuion: (predeterminado) => this.preparacion.guion(participanteId, { predeterminado }),
        configurar: async (cambios) => this.preparacion.configurar(participanteId, cambios),
        privados: async (abiertos) => this.preparacion.privados(participanteId, abiertos),
        asignarPersonajes: async () => this.preparacion.asignarPersonajes(participanteId),
        cambiarPersonaje: async (jugadorId, personajeId) => this.grimorio.personaje(participanteId, jugadorId, personajeId),
        cambiarVida: async (jugadorId, muerto, causa) => this.grimorio.vida(participanteId, jugadorId, muerto, causa),
        confirmarMuerte: async (jugadorId) => this.grimorio.confirmarMuerte(participanteId, jugadorId),
        ponerRecordatorio: async (jugadorId, personajeId, indice) => this.grimorio.recordatorio(participanteId, jugadorId, personajeId, indice),
        quitarRecordatorio: async (jugadorId, recordatorioId) => this.grimorio.quitarRecordatorio(participanteId, jugadorId, recordatorioId),
      }),
      {
        decir: (texto) => {
          this.difusor.voz(texto);
          this.difundir();
        },
      },
      deps.relojNarradorVirtual ?? temporizadorReal,
      alCambiar,
      deps.azar,
      deps.guiones,
      // Jarvis: con el modelo de la cuenta de quien lo añade, ya comprobado
      deps.modelosIA
        ? {
            modeloDe: async (participanteId) => {
              const cuenta = cuentaDe(participanteId);
              if (!cuenta) return 'Para añadir a Jarvis necesitas una cuenta.';
              return NarradorIAService.para(await deps.modelosIA!(cuenta));
            },
            modeloDeCuenta: async (cuenta) => NarradorIAService.para(await deps.modelosIA!(cuenta)),
          }
        : null,
      // Las bolsas recientes, de la cuenta de quien lo añade
      deps.bolsasRecientes
        ? {
            de: async (participanteId) => {
              const cuenta = cuentaDe(participanteId);
              return cuenta ? deps.bolsasRecientes!.de(cuenta) : [];
            },
            apuntar: async (participanteId, personajes) => {
              const cuenta = cuentaDe(participanteId);
              if (cuenta) await deps.bolsasRecientes!.apuntar(cuenta, personajes);
            },
          }
        : null,
    );
    // La votación avanza sola con el tiempo: cada paso se manda a todos.
    partida.alCambiarSola = () => this.difundir();
  }

  /** Por dónde se manda lo que pasa en la sala (ver DifusorSala). */
  difundirCon(difusor: DifusorSala): void {
    this.difusor = difusor;
  }

  /** Lo que se ve de la sala además de la partida, para montar lo que ve cada uno. */
  contextoVista() {
    return {
      conversaciones: this.conversaciones.lista(),
      invitacionesDe: (participanteId: string) => this.conversaciones.invitacionesDe(participanteId),
      video: !!this.videollamada,
      accionesDe: (yo: Participante) => [
        ...this.participantes.permitidas(yo),
        ...this.bolsa.permitidas(yo), ...this.reloj.permitidas(yo), ...this.revelacion.permitidas(yo), ...this.senalamiento.permitidas(yo), ...this.faroles.permitidas(yo), ...this.fase.permitidas(yo), ...this.noche.permitidas(yo), ...this.dia.permitidas(yo), ...this.preparacion.permitidas(yo), ...this.grimorio.permitidas(yo), ...this.narradorVirtual.permitidas(yo),
      ],
    };
  }

  /**
   * Identifica a quien llega: con su cuenta o, sin ella, con el nombre con el que
   * entra, que no puede usar ya otro. Aún no entra (ver conectar).
   */
  async llegada({ usuario, nombre, alias, avatar, clienteId }: PeticionLlegada): Promise<SalaLlegada | { error: ErrorLlegada }> {
    const { imagenes } = this;
    const { contarPartidas, avatarDe } = this.deps;
    if (usuario) {
      return {
        cuenta: {
          usuarioId: usuario.id,
          partidasJugadas: contarPartidas ? await contarPartidas(usuario.id).catch(() => null) : null,
        },
        nombreBase: usuario.username,
        alias: limpiarNombreSala(alias),
        avatarPorDefecto: avatarDe ? await avatarDe(usuario.id).catch(() => null) : null,
        avatarElegido: imagenes.avatarValido(avatar),
      };
    }
    const nombreBase = limpiarNombreSala(nombre);
    if (!nombreBase) return { error: 'SIN_NOMBRE' };
    const llegada: SalaLlegada = {
      cuenta: null,
      nombreBase,
      alias: limpiarNombreSala(alias),
      avatarPorDefecto: SALA_AVATAR_INVITADO,
      avatarElegido: imagenes.avatarValido(avatar),
    };
    const nombreFinal = llegada.alias || llegada.nombreBase;
    if (!this.juego.sala.participantes.nombreLibreParaInvitado(nombreFinal, clienteId, (c) => this.difusor.sigueAbierta(c))) {
      return { error: 'NOMBRE_OCUPADO' };
    }
    return llegada;
  }

  /**
   * Entra en la sala (o vuelve a su sitio) por una conexión: devuelve su clave. Le
   * llegan el guion, la sala y lo que puede leer del chat. Si su cuenta ya estaba en
   * la sala desde otra conexión, a esa se la saca.
   */
  conectar(conexion: string, clienteId: string | null, llegada: SalaLlegada): string {
    this.difusor.guion(this.juego.partida.guion.actual(), conexion);
    const { clave, expulsar } = this.juego.sala.participantes.conectar(conexion, clienteId, llegada, (c) => this.difusor.sigueAbierta(c));
    if (expulsar) this.difusor.expulsar(expulsar, 'otraConexion');
    const yo = this.participanteDe(clave);
    if (yo) this.volverASuSitio(yo.id);
    this.difundir();
    this.mandarHistorial(clave, conexion);
    return clave;
  }

  participanteDe(clave: string): Participante | undefined {
    return this.juego.sala.participantes.participanteDe(clave);
  }

  /** Se corta su conexión: si se va a propósito («Salir»), sale ya; si no, se le guarda el sitio un rato. */
  desconectar(clave: string, conexion: string, aProposito: boolean): void {
    const { participantes } = this.juego.sala;
    if (aProposito) participantes.salir(clave, conexion);
    else participantes.desconectar(clave, conexion, () => this.difundir());
    this.difundir();
  }

  /** Un mensaje de texto: le llega a quien puede leerlo; si es un susurro entre jugadores, las ondas a todos. */
  enviarMensaje(autorId: string, para: string, texto: string, responder: Responder): void {
    try {
      const { mensaje, lectores, susurro } = this.chat.enviar(autorId, para, texto);
      responder({ ok: true });
      const conexiones = this.juego.sala.participantes.conexiones().filter(({ id }) => lectores.includes(id));
      this.difusor.mensaje(mensaje, conexiones.map((c) => c.socketId));
      if (susurro) this.difusor.susurro(susurro);
    } catch (e) {
      responder({ ok: false, error: e instanceof ChatError ? e.message : 'No se ha podido mandar el mensaje.' });
    }
  }

  /** Le manda los mensajes que puede leer (cambian con su papel). */
  mandarHistorial(clave: string, conexion: string): void {
    const yo = this.participanteDe(clave);
    if (yo) this.difusor.historial(conexion, this.chat.historial(yo));
  }

  /** El pase a la videollamada: la plaza («principal») o su conversación privada. */
  async pase(yoId: string, sala: string): Promise<RespuestaAccion & Partial<PaseVideo>> {
    if (!this.videollamada) return { ok: false, error: 'Esta sala no tiene videollamada.' };
    try {
      return { ok: true, ...(await this.videollamada.pase(yoId, sala)) };
    } catch (e) {
      return { ok: false, error: e instanceof VideollamadaError ? e.message : 'No se ha podido conectar con el vídeo.' };
    }
  }

  // Conversaciones privadas (ver ConversacionService): invitar, responder a una
  // invitación, retirarla, escuchar una (visitantes) y salir.

  invitar(yoId: string, con: string, responder: Responder): void {
    this.conversar(responder, (c) => void c.invitar(yoId, con));
  }

  pedirUnirse(yoId: string, con: string, responder: Responder): void {
    this.conversar(responder, (c) => void c.pedirUnirse(yoId, con));
  }

  responderInvitacion(yoId: string, invitacion: string, aceptar: boolean, responder: Responder): void {
    this.conversar(responder, (c) => c.responder(yoId, invitacion, aceptar));
  }

  cancelarInvitacion(yoId: string, invitacion: string, responder: Responder): void {
    this.conversar(responder, (c) => c.cancelar(yoId, invitacion));
  }

  entrarEnConversacion(yoId: string, conversacion: string, responder: Responder): void {
    this.conversar(responder, (c) => c.entrar(yoId, conversacion));
  }

  escucharConversacion(yoId: string, conversacion: string, responder: Responder): void {
    this.conversar(responder, (c) => c.escuchar(yoId, conversacion));
  }

  salirDeConversacion(yoId: string, responder: Responder): void {
    this.conversar(responder, (c) => c.salir(yoId));
  }

  /** Algo con las conversaciones privadas: si sale bien, se difunde la sala. */
  private conversar(responder: Responder, hacer: (conversaciones: ConversacionService) => void): void {
    try {
      hacer(this.conversaciones);
      responder({ ok: true });
      this.difundir();
    } catch (e) {
      responder({ ok: false, error: e instanceof ConversacionError ? e.message : 'No se ha podido hacer.' });
    }
  }

  private mandarGuionSiCambia(): void {
    const { guion } = this.juego.partida;
    if (guion.version() === this.versionGuionMandada) return;
    this.versionGuionMandada = guion.version();
    this.difusor.guion(guion.actual());
  }

  /** Tras cada cambio: todo al día con la sala, a cada uno lo suyo, el narrador virtual mira si le toca algo y se guarda. */
  private difundir(): void {
    // Las conversaciones y el servidor de vídeo, al día con la sala (papeles, fase, quién está)
    this.conversaciones.depurar();
    this.videollamada?.sincronizar();
    this.difusor.estado();
    this.narradorVirtual.alCambiarSala();
    this.guardarPronto();
  }

  /**
   * Recupera la sala guardada antes de un reinicio (ver PartidaGuardada): la plaza
   * con sus asientos, la partida y su diario, los ajustes y el narrador virtual, que
   * retoma su etapa. Cada cuenta recupera su asiento o su papel de narrador al
   * volver a entrar (ver volverASuSitio). Lo que se puede deshacer empieza de cero.
   * Si lo guardado es de otra versión, se descarta. Devuelve si se ha recuperado.
   */
  async recuperar(): Promise<boolean> {
    const leida = await this.deps.partidaEnCurso?.leer().catch((err) => {
      console.error('[SALA] No se ha podido leer la partida en curso:', err);
      return null;
    });
    if (!leida) return false;
    if (leida.version !== VERSION_PARTIDA_GUARDADA) {
      console.warn(`[SALA] La partida en curso guardada es de otra versión (${leida.version}): se descarta.`);
      return false;
    }
    const guardada = leida.datos as PartidaGuardada;
    const { sala, partida } = this.juego;
    sala.rehacerPlaza(guardada.asientos.map((a) => a.id));
    // El diario antes que la partida: la partida recuerda cuánto había apuntado
    partida.registro.cargar(guardada.diario);
    partida.restaurar(guardada.partida);
    partida.configuracion.cambiar(guardada.ajustes);
    partida.configuracion.permitirPrivados(guardada.privados);
    for (const a of guardada.asientos) if (a.userId) this.reservas.set(a.userId, { asiento: a.id, narrador: false });
    for (const userId of guardada.narradores) this.reservas.set(userId, { asiento: null, narrador: true });
    if (guardada.narradorVirtual) await this.narradorVirtual.retomar(guardada.narradorVirtual);
    this.versionGuionMandada = partida.guion.version();
    console.log(`[SALA] Recuperada la partida en curso (${partida.fases.actual().momento} ${partida.fases.actual().numero}).`);
    return true;
  }

  /** Guarda ya la partida en curso (sin esperar a ESPERA_GUARDAR_MS): al apagar el servidor, y en los tests. */
  async guardarAhora(): Promise<void> {
    const destino = this.deps.partidaEnCurso;
    if (!destino) return;
    const guardada = this.guardable();
    this.guardando = this.guardando.then(() => destino.guardar(VERSION_PARTIDA_GUARDADA, guardada)).catch((err) => console.error('[SALA] No se ha podido guardar la partida en curso:', err));
    await this.guardando;
  }

  /** Tras un cambio, se guarda la partida en curso al rato (los cambios que lleguen mientras, juntos). */
  private guardarPronto(): void {
    if (!this.deps.partidaEnCurso || this.guardadoPendiente) return;
    this.guardadoPendiente = true;
    setTimeout(() => {
      this.guardadoPendiente = false;
      void this.guardarAhora();
    }, ESPERA_GUARDAR_MS);
  }

  /**
   * La sala para guardarla (ver PartidaGuardada). De cada asiento, la cuenta de quien
   * se sienta o, si aún no ha vuelto tras un reinicio, la de quien lo tenía.
   */
  private guardable(): PartidaGuardada {
    const { sala, partida } = this.juego;
    const pendientes = [...this.reservas];
    const asientos = sala.asientos().map((a) => ({
      id: a.id,
      userId: sala.participantes.cuentaDe(a.participanteId) ?? pendientes.find(([, r]) => r.asiento === a.id)?.[0] ?? null,
    }));
    const narradores = [
      ...sala.participantes.narradores().flatMap((p) => (p.persona.tipo === 'virtual' ? [] : (sala.participantes.cuentaDe(p.id) ?? []))),
      ...pendientes.filter(([, r]) => r.narrador).map(([userId]) => userId),
    ];
    return {
      asientos,
      narradores: [...new Set(narradores)],
      partida: partida.instantanea(),
      diario: partida.registro.exportar(),
      ajustes: partida.configuracion.actual(),
      privados: partida.configuracion.privadosPermitidos(),
      narradorVirtual: this.narradorVirtual.guardable(),
    };
  }

  /** Recuperada la sala tras un reinicio, quien entra con su cuenta vuelve a su asiento o a narrar (si sigue libre). */
  private volverASuSitio(participanteId: string): void {
    const cuenta = this.juego.sala.participantes.cuentaDe(participanteId);
    this.narradorVirtual.alConectar(participanteId, cuenta);
    const reserva = cuenta ? this.reservas.get(cuenta) : undefined;
    if (!cuenta || !reserva) return;
    this.reservas.delete(cuenta);
    if (reserva.narrador) this.juego.sala.participantes.cambiarRol(participanteId, 'narrador');
    else if (reserva.asiento) this.juego.sala.sentar(participanteId, reserva.asiento);
    // Han vuelto todos los que tenían asiento: el narrador virtual sigue
    if (![...this.reservas.values()].some((r) => r.asiento)) void this.narradorVirtual.reanudar();
  }
}
