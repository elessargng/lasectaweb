import type { SalaDeJuego } from '../models/SalaDeJuego';
import type { Partida } from '../models/partida/Partida';
import { identidadDe } from '../models/partida/Grimorio';
import type { Participante } from '../models/sala/Participantes';
import type { EstadoAccesoGrimorio } from '../models/compartido/participante';
import type { ParticipanteDto } from './dto/participante';
import { NPC_TOR } from '../models/partida/personajesEspeciales';
import { farolesVacios } from '../models/partida/Faroles';
import type { JugadorDto } from './dto/jugador';
import type { NominacionDto } from './dto/partida';
import type { Nominacion } from '../models/partida/Nominaciones';
import type { HiloDespertar } from '../models/partida/Despertares';
import type { FichaEnviada, GrimorioEnviado } from '../models/partida/Entregas';
import type { HabilidadNoche } from '../models/partida/DespertarGuiado';
import type { DespertarDto, HabilidadNocheDto } from './dto/despertar';
import type { FichaEnviadaDto, GrimorioEnviadoDto } from './dto/grimorio';
import type { ConversacionDto, SalaDto, InvitacionDto } from './dto/sala';
import type { Conversacion, Invitacion } from '../models/conversaciones';
import type { Ajustes } from '../models/partida/Configuracion';
import type { Reloj } from '../models/partida/RelojSala';
import type { EstadoRevelacion } from '../models/partida/Revelacion';
import type { Senalamiento } from '../models/partida/Senalamientos';
import type { ConfiguracionDto, RelojDto, RevelacionDto, SenalamientoDto } from './dto/partida';

/** Lo que la vista necesita de fuera de la partida: las conversaciones, el vídeo y los permisos. */
export interface ContextoVista {
  conversaciones: Conversacion[];
  invitacionesDe: (participanteId: string) => Invitacion[];
  /** Hay videollamada en la sala. */
  video: boolean;
  /** Las acciones que puede usar ahora un participante (ver salaAcciones). */
  accionesDe: (participante: Participante) => string[];
}

/** Una ficha sin su personaje ni su alineamiento: así la ven quienes no la juegan ni narran. */
// Lo que un jugador no ve de una ficha: de las ajenas, el personaje y los faroles; de ninguna, los recordatorios.
const sinPersonaje = (a: JugadorDto): JugadorDto => ({
  ...a,
  personaje: null,
  alineamiento: null,
  recordatorios: [],
  faroles: farolesVacios(),
  farolEnUso: null,
});
const sinRecordatorios = (a: JugadorDto): JugadorDto => ({ ...a, recordatorios: [] });

/** El Dto de algo que puede no estar (null se queda en null). */
const siHay = <T, D>(x: T | null, dto: (x: T) => D): D | null => (x === null ? null : dto(x));

const configuracionDto = (a: Ajustes): ConfiguracionDto => ({
  grimorioJugadores: a.grimorioJugadores,
  segundosPorFicha: a.segundosPorFicha,
  mensajes: a.mensajes,
  fondo: a.fondo,
  ocultarCamarasConversacion: a.ocultarCamarasConversacion,
});
const relojDto = (r: Reloj): RelojDto => ({ inicio: r.inicio, fin: r.fin, mensaje: r.mensaje });
const revelacionDto = (r: EstadoRevelacion): RevelacionDto => ({
  ganador: r.ganador,
  causas: [...r.causas],
  reveladas: [...r.reveladas],
  terminada: r.terminada,
});
const senalamientoDto = (s: Senalamiento): SenalamientoDto => ({
  id: s.id,
  tipo: s.tipo,
  mensaje: s.mensaje,
  senaladores: [...s.senaladores],
  objetivos: [...s.objetivos],
  publico: s.publico,
  inicio: s.inicio,
  fin: s.fin,
  congelado: s.congelado,
  senales: { ...s.senales },
});
// Campo a campo: lo que la nominación guarda para sí (quién ha votado ya, por cuenta) no sale
const nominacionDto = (n: Nominacion): NominacionDto => ({
  desde: n.desde,
  hasta: n.hasta,
  cuentaAtrasFin: n.cuentaAtrasFin,
  votacion: n.votacion && {
    orden: [...n.votacion.orden],
    paso: n.votacion.paso,
    resultados: { ...n.votacion.resultados },
    votos: n.votacion.votos,
    terminada: n.votacion.terminada,
    ...(n.votacion.valores && { valores: { ...n.votacion.valores } }),
  },
  expulsion: n.expulsion,
  votosNecesarios: n.votosNecesarios,
  votosNecesariosPorDefecto: n.votosNecesariosPorDefecto,
  privada: n.privada,
});
// Sin quién lo jugaba al abrirlo (es para cerrar el despertar si cambia)
const despertarDto = (h: HiloDespertar): DespertarDto => ({ jugador: h.jugador, mensajes: h.mensajes.map((m) => ({ ...m })) });
const fichaEnviadaDto = (f: FichaEnviada): FichaEnviadaDto => ({
  jugadorId: f.jugadorId,
  personaje: f.personaje,
  alineamiento: f.alineamiento,
  muerto: f.muerto,
  recordatorios: f.recordatorios.map((r) => ({ ...r })),
});
const grimorioEnviadoDto = (g: GrimorioEnviado): GrimorioEnviadoDto => ({
  hora: g.hora,
  fichas: g.fichas.map(fichaEnviadaDto),
  faroles: [...g.faroles],
});
const participanteDto = (p: Participante, accesoGrimorio: EstadoAccesoGrimorio): ParticipanteDto => ({
  id: p.id,
  nombre: p.nombre,
  persona: { ...p.persona },
  avatar: p.avatar,
  rol: p.rol,
  conectado: p.conectado,
  manoLevantada: p.manoLevantada,
  dosManos: p.dosManos,
  formaMano: p.formaMano,
  estiloMano: p.estiloMano,
  sinSonido: p.sinSonido,
  accesoGrimorio,
});
const habilidadNocheDto = (h: HabilidadNoche): HabilidadNocheDto => ({
  personaje: h.personaje,
  jugador: h.jugador,
  jugadores: [...h.jugadores],
  estado: h.estado,
  avisos: h.avisos.map((a) => ({ ...a })),
  opciones: h.opciones.map((o) => ({ envio: { ...o.envio }, registros: o.registros.map((r) => ({ ...r })) })),
});
const conversacionDto = (c: Conversacion): ConversacionDto => ({ id: c.id, miembros: [...c.miembros], oyentes: [...c.oyentes] });
const invitacionDto = (i: Invitacion): InvitacionDto => ({ id: i.id, de: i.de, para: i.para, ...(i.conversacion && { conversacion: i.conversacion }) });

/**
 * La nominación como la ve quien no ve el grimorio en una votación secreta (Organ
 * Grinder): sin los votos que hacen falta ni el recuento; de lo que vota cada
 * asiento, solo lo suyo (cuánto vale su voto, no por dónde va el recuento).
 */
const nominacionSecreta = (n: NominacionDto, miAsiento: string | null): NominacionDto => {
  const v = n.votacion;
  const mio = miAsiento && v && miAsiento in v.resultados ? v.resultados[miAsiento] : undefined;
  return {
    ...n,
    votosNecesarios: 0,
    votosNecesariosPorDefecto: 0,
    votacion: v && {
      ...v,
      votos: 0,
      valores: undefined,
      resultados: mio === undefined ? {} : { [miAsiento!]: mio === null ? null : (v.valores?.[miAsiento!] ?? 1) },
    },
  };
};

/**
 * Lo que ve cada uno de la partida. El grimorio es secreto: según su papel
 * (narrador, jugador, visitante con o sin el grimorio) a cada participante se le
 * manda una parte. Se crea una vez por difusión (lee la sala en ese momento) y da
 * el estado de cada participante con `para`. No cambia la sala ni sabe de sockets.
 */
export class VistaPartida {
  private readonly participantes;
  private readonly plaza: JugadorDto[];
  private readonly calavera;
  private readonly notas;
  private readonly nominacion;
  private readonly revelacion;
  /** Lo que se lee igual para todos (luego cada uno ve una parte). */
  private readonly comun;
  /** Las fichas ya reveladas al final de la partida: todos ven su personaje. */
  private readonly reveladas: Set<string>;
  /** Con Tor, los jugadores no saben quiénes son hasta que mueren. */
  private readonly tor: boolean;
  /** Con el Gardener, mientras el narrador no los entregue, nadie ve ningún personaje (tampoco el suyo ni los viajeros). */
  private readonly retenidas: boolean;
  /** Votación secreta (Organ Grinder): lo que no ve quien no ve el grimorio. */
  private readonly secreta: boolean;
  private readonly gastadosAlVotar;
  private readonly ahora = Date.now();

  private readonly partida: Partida;

  constructor(
    juego: SalaDeJuego,
    private readonly contexto: ContextoVista,
  ) {
    const { sala, partida } = juego;
    this.partida = partida;
    // Con su acceso al grimorio (es de la partida, no del participante)
    this.participantes = sala.participantes.participantes().map((p) => participanteDto(p, partida.acceso.de(p.id)));
    // Cada jugador de la plaza con sus faroles; la calavera y las notas, del grimorio
    this.plaza = partida.plaza().map((j) => ({
      id: j.id,
      participanteId: j.participanteId,
      muerto: j.muerto,
      muertePendiente: j.muertePendiente,
      votoGastado: j.votoGastado,
      personaje: j.personaje,
      alineamiento: j.alineamiento,
      recordatorios: [...j.recordatorios],
      faroles: partida.faroles.deJugador(j),
      farolEnUso: partida.faroles.enUso(j),
    }));
    this.calavera = partida.grimorio.calavera();
    this.notas = partida.grimorio.notas();
    this.nominacion = siHay(partida.nominaciones.nominacion(), nominacionDto);
    this.revelacion = partida.revelacion.revelacion();
    this.reveladas = new Set(this.revelacion?.reveladas ?? []);
    this.tor = partida.npcs.activo(NPC_TOR);
    this.retenidas = partida.entregas.fichasRetenidas();
    this.secreta = partida.votacionSecreta();
    this.gastadosAlVotar = partida.nominaciones.gastadosAlVotar();
    this.comun = {
      configuracion: configuracionDto(partida.configuracion.actual()),
      fase: partida.fases.actual(),
      distribucion: partida.reparto.distribucion(),
      bolsa: partida.reparto.bolsa.bolsa(),
      faroles: partida.faroles.faroles(),
      npcs: partida.npcs.npcs(),
      despertares: partida.despertares.despertares().map(despertarDto),
      recordatoriosNoche: partida.recordatoriosNoche(),
      votaciones: partida.nominaciones.votaciones(),
      senalamiento: siHay(partida.senalamientos.senalamiento(), senalamientoDto),
      narradorVirtual: juego.narrador.actual(),
    };
  }

  /** El estado de la sala tal como lo ve este participante. */
  para(yo: Participante): SalaDto {
    const { partida, contexto, comun } = this;
    const narra = yo.rol === 'narrador';
    const veGrimorio = narra || (yo.rol === 'visitante' && partida.acceso.de(yo.id) === 'concedido');
    const ocultarVotos = this.secreta && !veGrimorio;
    // La votación en curso solo se esconde si es una nominación (las expulsiones, no)
    const ocultarVotacion = ocultarVotos && !!this.nominacion?.privada;
    const miAsiento = partida.jugadorDe(yo.id)?.id ?? null;
    return {
      // Votación secreta, con una nominación abierta: las manos de los demás no se ven
      participantes:
        ocultarVotacion
          ? this.participantes.map((p) => (p.id === yo.id ? p : { ...p, manoLevantada: false, dosManos: false }))
          : this.participantes,
      plaza: veGrimorio ? this.plaza : this.plaza.map((a) => this.sinGrimorio(a, yo, ocultarVotacion)),
      // Votación secreta: con cuántos votos se puso la calavera no se sabe
      calavera: this.calavera && ocultarVotos ? { ...this.calavera, votos: null } : this.calavera,
      notas: veGrimorio ? this.notas : {},
      configuracion: comun.configuracion,
      nominacion: ocultarVotacion && this.nominacion ? nominacionSecreta(this.nominacion, miAsiento) : this.nominacion,
      fase: comun.fase,
      distribucion: comun.distribucion,
      revelacion: siHay(this.revelacion, revelacionDto),
      gong: partida.reloj.gong(),
      reloj: siHay(partida.reloj.reloj(), relojDto),
      // De noche, solo quien señala (y quien ve el grimorio)
      senalamiento: partida.senalamientos.veSenalamiento(yo) ? comun.senalamiento : null,
      video: contexto.video,
      // Los jugadores no saben qué visitantes escuchan las conversaciones; de noche, ni
      // siquiera que las hay: solo ven aquella en la que están
      conversaciones:
        yo.rol === 'jugador'
          ? contexto.conversaciones
              .filter((c) => comun.fase.momento !== 'noche' || c.miembros.includes(yo.id))
              .map((c) => ({ ...conversacionDto(c), oyentes: [] }))
          : contexto.conversaciones.map(conversacionDto),
      invitaciones: contexto.invitacionesDe(yo.id).map(invitacionDto),
      // La bolsa es solo para los narradores (son los personajes de la partida)
      bolsa: narra ? comun.bolsa : [],
      // Los faroles del narrador: también los ven los visitantes (no juegan)
      faroles: yo.rol === 'jugador' ? farolesVacios() : comun.faroles,
      npcs: comun.npcs,
      setupAceptado: narra ? partida.reparto.setupAceptado() : null,
      silencio: partida.npcs.silencio(),
      voudon: partida.voudonVivo(),
      institutriz: partida.institutrizViva(),
      bootlegger: partida.npcs.bootlegger(),
      rolStormcatcher: partida.npcs.rolStormcatcher(),
      fichasRetenidas: this.retenidas,
      ahora: this.ahora,
      // El registro de votaciones es solo para los narradores.
      votaciones: narra ? comun.votaciones : [],
      recordatoriosNoche: narra ? comun.recordatoriosNoche : {},
      habilidadesNoche: narra ? partida.guiado.habilidadesNoche().map(habilidadNocheDto) : [],
      nuevoImp: narra ? partida.guiado.nuevoImp() : null,
      // Los despertares: los narradores y los visitantes que ven el grimorio, todos; un
      // jugador, solo el de su asiento (nadie más sabe a quién se despierta).
      despertares: veGrimorio
        ? comun.despertares
        : yo.rol === 'jugador'
          ? comun.despertares.filter((d) => d.jugador === partida.despertares.asientoDespiertoDe(yo.id))
          : [],
      grimorioRecibido: yo.rol === 'jugador' ? siHay(partida.entregas.grimorioRecibidoPor(yo.id), grimorioEnviadoDto) : null,
      narradorVirtual: comun.narradorVirtual,
      palabra: partida.nominaciones.palabra(),
      yo: yo.id,
      acciones: contexto.accionesDe(yo),
    };
  }

  /** Un jugador como lo ve quien no ve el grimorio (un jugador o un visitante sin acceso). */
  private sinGrimorio(a: JugadorDto, yo: Participante, ocultarVotacion: boolean): JugadorDto {
    return {
      // La muerte pendiente (de la noche, por anunciar) es del grimorio: los demás no la ven
      ...(this.reveladas.has(a.id)
        ? a
        : this.retenidas
          ? sinPersonaje(a)
          : a.participanteId === yo.id
            ? this.comoLaVeSuJugador(a)
            : this.comoLaVenTodos(a)),
      muertePendiente: false,
      // Votación secreta: mientras se vota, el voto de los muertos ajenos se ve como estaba al empezar
      ...(ocultarVotacion &&
        this.gastadosAlVotar &&
        a.participanteId !== yo.id && { votoGastado: this.gastadosAlVotar.has(a.id) }),
    };
  }

  /** El viajero que es de verdad un jugador (los viajeros son públicos), o null. */
  private viajeroDe(a: JugadorDto): string | null {
    const id = identidadDe(a);
    return id && this.partida.guion.personaje(id)?.tipo === 'traveller' ? id : null;
  }

  /**
   * Las fichas ajenas, como las ve quien no tiene el grimorio: sin personaje, salvo los
   * viajeros, que son públicos. Se ve quién es de verdad (un Alcalde con «Is The
   * Apprentice» se ve como Aprendiz); el alineamiento de un viajero, no.
   */
  private comoLaVenTodos(a: JugadorDto): JugadorDto {
    const viajero = this.viajeroDe(a);
    return viajero ? { ...sinPersonaje(a), personaje: viajero } : sinPersonaje(a);
  }

  /**
   * Su jugador ve el personaje y el alineamiento que se le entregaron al repartir la
   * bolsa (lo que el narrador cambie luego es del grimorio: no lo ve), sin recordatorios.
   * Si es un viajero de verdad, como ese viajero (el Aprendiz: la ficha que sacó de la
   * bolsa), como los demás. Con Tor, no sabe quién es hasta que muere: la ve como los
   * demás; muerto, ve quién es de verdad.
   */
  private comoLaVeSuJugador(a: JugadorDto): JugadorDto {
    if (this.tor && !a.muerto) return this.comoLaVenTodos(a);
    // Con Tor, al morir sabe quién es de verdad (un Borracho con ficha de aldeano: Borracho)
    if (this.tor) return { ...sinRecordatorios(a), personaje: identidadDe(a) };
    const viajero = this.viajeroDe(a);
    // Un viajero: quien es lo ve todo el mundo; su alineamiento, como se le dijo (al repartir
    // o con «Tú eres»), no el que el narrador le ponga en el grimorio
    return viajero
      ? { ...sinRecordatorios(a), personaje: viajero, alineamiento: this.partida.entregas.fichaEntregada(a.id).alineamiento }
      : { ...sinRecordatorios(a), ...this.partida.entregas.fichaEntregada(a.id) };
  }
}
