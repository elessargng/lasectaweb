import { SalaService } from '../SalaService';
import { NPC_TOR } from './personajesEspeciales';
import { farolesVacios } from './Faroles';
import type {
  SalaAsiento,
  SalaConversacion,
  SalaEstado,
  SalaInvitacion,
  SalaNominacion,
  SalaParticipante,
} from '../../contrato/sala';

/** Lo que la vista necesita de fuera de la partida: las conversaciones, el vídeo y los permisos. */
export interface ContextoVista {
  conversaciones: SalaConversacion[];
  invitacionesDe: (participanteId: string) => SalaInvitacion[];
  /** Hay videollamada en la sala. */
  video: boolean;
  /** Las acciones que puede usar ahora un participante (ver salaAcciones). */
  accionesDe: (participante: SalaParticipante) => string[];
}

/** Una ficha sin su personaje ni su alineamiento: así la ven quienes no son su jugador ni narran. */
// Lo que un jugador no ve de una ficha: de las ajenas, el personaje y los faroles; de ninguna, los recordatorios ni la nota.
const sinPersonaje = (a: SalaAsiento): SalaAsiento => ({
  ...a,
  personaje: null,
  alineamiento: null,
  recordatorios: [],
  nota: null,
  faroles: farolesVacios(),
});
const sinRecordatorios = (a: SalaAsiento): SalaAsiento => ({ ...a, recordatorios: [], nota: null });

/**
 * La nominación como la ve quien no ve el grimorio en una votación secreta (Organ
 * Grinder): sin los votos que hacen falta ni el recuento; de lo que vota cada
 * asiento, solo lo suyo (cuánto vale su voto, no por dónde va el recuento).
 */
const nominacionSecreta = (n: SalaNominacion, miAsiento: string | null): SalaNominacion => {
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
  private readonly asientos;
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

  constructor(
    private readonly sala: SalaService,
    private readonly contexto: ContextoVista,
  ) {
    this.participantes = sala.participantes();
    this.asientos = sala.asientos();
    this.nominacion = sala.nominacion();
    this.revelacion = sala.revelacion();
    this.reveladas = new Set(this.revelacion?.reveladas ?? []);
    this.tor = sala.npcActivo(NPC_TOR);
    this.retenidas = sala.fichasRetenidas();
    this.secreta = sala.votacionSecreta();
    this.gastadosAlVotar = sala.gastadosAlVotar();
    this.comun = {
      configuracion: sala.configuracion(),
      fase: sala.fase(),
      distribucion: sala.distribucion(),
      bolsa: sala.bolsa(),
      faroles: sala.faroles(),
      npcs: sala.npcs(),
      despertares: sala.despertares(),
      recordatoriosNoche: sala.recordatoriosNoche(),
      votaciones: sala.votaciones(),
      senalamiento: sala.senalamiento(),
    };
  }

  /** El estado de la sala tal como lo ve este participante. */
  para(yo: SalaParticipante): SalaEstado {
    const { sala, contexto, comun } = this;
    const narra = yo.rol === 'narrador';
    const veGrimorio = narra || (yo.rol === 'visitante' && yo.accesoGrimorio === 'concedido');
    const ocultarVotos = this.secreta && !veGrimorio;
    // La votación en curso solo se esconde si es una nominación (las expulsiones, no)
    const ocultarVotacion = ocultarVotos && !!this.nominacion?.privada;
    const miAsiento = sala.asientoDe(yo.id)?.id ?? null;
    return {
      // Votación secreta, con una nominación abierta: las manos de los demás no se ven
      participantes:
        ocultarVotacion
          ? this.participantes.map((p) => (p.id === yo.id ? p : { ...p, manoLevantada: false, dosManos: false }))
          : this.participantes,
      asientos: veGrimorio ? this.asientos : this.asientos.map((a) => this.asientoSinGrimorio(a, yo, ocultarVotos, ocultarVotacion)),
      configuracion: comun.configuracion,
      nominacion: ocultarVotacion && this.nominacion ? nominacionSecreta(this.nominacion, miAsiento) : this.nominacion,
      fase: comun.fase,
      distribucion: comun.distribucion,
      revelacion: this.revelacion,
      gong: sala.gong(),
      reloj: sala.reloj(),
      // De noche, solo quien señala (y quien ve el grimorio)
      senalamiento: sala.veSenalamiento(yo) ? comun.senalamiento : null,
      video: contexto.video,
      // Los jugadores no saben qué visitantes escuchan las conversaciones; de noche, ni
      // siquiera que las hay: solo ven aquella en la que están
      conversaciones:
        yo.rol === 'jugador'
          ? contexto.conversaciones
              .filter((c) => comun.fase.momento !== 'noche' || c.miembros.includes(yo.id))
              .map((c) => ({ ...c, oyentes: [] }))
          : contexto.conversaciones,
      invitaciones: contexto.invitacionesDe(yo.id),
      // La bolsa es solo para los narradores (son los personajes de la partida)
      bolsa: narra ? comun.bolsa : [],
      // Los faroles del narrador: también los ven los visitantes (no juegan)
      faroles: yo.rol === 'jugador' ? farolesVacios() : comun.faroles,
      npcs: comun.npcs,
      setupAceptado: narra ? sala.setupAceptado() : null,
      silencio: sala.silencio(),
      voudon: sala.voudonVivo(),
      institutriz: sala.institutrizViva(),
      bootlegger: sala.bootlegger(),
      rolStormcatcher: sala.rolStormcatcher(),
      fichasRetenidas: this.retenidas,
      ahora: this.ahora,
      // El registro de votaciones es solo para los narradores.
      votaciones: narra ? comun.votaciones : [],
      recordatoriosNoche: narra ? comun.recordatoriosNoche : {},
      habilidadesNoche: narra ? sala.habilidadesNoche() : [],
      nuevoImp: narra ? sala.nuevoImp() : null,
      // Los despertares: los narradores y los visitantes que ven el grimorio, todos; un
      // jugador, solo el de su asiento (nadie más sabe a quién se despierta).
      despertares: veGrimorio
        ? comun.despertares
        : yo.rol === 'jugador'
          ? comun.despertares.filter((d) => d.asiento === sala.asientoDespiertoDe(yo.id))
          : [],
      grimorioRecibido: yo.rol === 'jugador' ? sala.grimorioRecibidoPor(yo.id) : null,
      narradorVirtual: sala.narradorVirtual(),
      palabra: sala.palabra(),
      yo: yo.id,
      acciones: contexto.accionesDe(yo),
    };
  }

  /** Un asiento como lo ve quien no ve el grimorio (un jugador o un visitante sin acceso). */
  private asientoSinGrimorio(a: SalaAsiento, yo: SalaParticipante, ocultarVotos: boolean, ocultarVotacion: boolean): SalaAsiento {
    return {
      // La muerte pendiente (de la noche, por anunciar) es del grimorio: los demás no la ven
      ...(this.reveladas.has(a.id)
        ? a
        : this.retenidas
          ? sinPersonaje(a)
          : a.ocupante === yo.id
            ? this.comoLaVeSuJugador(a)
            : this.comoLaVenTodos(a)),
      muertePendiente: false,
      // Votación secreta: con cuántos votos se puso la calavera no se sabe, y mientras
      // se vota, el voto de los muertos ajenos se ve como estaba al empezar
      ...(ocultarVotos && {
        votosMarca: null,
        votoGastado: ocultarVotacion && this.gastadosAlVotar && a.ocupante !== yo.id ? this.gastadosAlVotar.has(a.id) : a.votoGastado,
      }),
    };
  }

  /** El viajero que es de verdad el de un asiento (los viajeros son públicos), o null. */
  private viajeroDe(a: SalaAsiento): string | null {
    const id = this.sala.identidad(a);
    return id && this.sala.personaje(id)?.tipo === 'traveller' ? id : null;
  }

  /**
   * Las fichas ajenas, como las ve quien no tiene el grimorio: sin personaje, salvo los
   * viajeros, que son públicos. Se ve quién es de verdad (un Alcalde con «Is The
   * Apprentice» se ve como Aprendiz); el alineamiento de un viajero, no.
   */
  private comoLaVenTodos(a: SalaAsiento): SalaAsiento {
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
  private comoLaVeSuJugador(a: SalaAsiento): SalaAsiento {
    if (this.tor && !a.muerto) return this.comoLaVenTodos(a);
    // Con Tor, al morir sabe quién es de verdad (un Borracho con ficha de aldeano: Borracho)
    if (this.tor) return { ...sinRecordatorios(a), personaje: this.sala.identidad(a) };
    const viajero = this.viajeroDe(a);
    // Un viajero: quien es lo ve todo el mundo; su alineamiento, como se le dijo (al repartir
    // o con «Tú eres»), no el que el narrador le ponga en el grimorio
    return viajero
      ? { ...sinRecordatorios(a), personaje: viajero, alineamiento: this.sala.fichaEntregada(a.id).alineamiento }
      : { ...sinRecordatorios(a), ...this.sala.fichaEntregada(a.id) };
  }
}
