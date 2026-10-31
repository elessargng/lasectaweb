import type { SalaDeJuego } from '../SalaDeJuego';
import type { Partida } from './Partida';
import { identidadDe } from './Grimorio';
import type { Participante } from '../sala/Participantes';
import { NPC_TOR } from './personajesEspeciales';
import { farolesVacios } from './Faroles';
import type {
  SalaAsiento,
  SalaConversacion,
  SalaEstado,
  SalaInvitacion,
  SalaNominacion,
  } from '../../contrato/sala';

/** Lo que la vista necesita de fuera de la partida: las conversaciones, el vídeo y los permisos. */
export interface ContextoVista {
  conversaciones: SalaConversacion[];
  invitacionesDe: (participanteId: string) => SalaInvitacion[];
  /** Hay videollamada en la sala. */
  video: boolean;
  /** Las acciones que puede usar ahora un participante (ver salaAcciones). */
  accionesDe: (participante: Participante) => string[];
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
  farolEnUso: null,
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

  private readonly partida: Partida;

  constructor(
    juego: SalaDeJuego,
    private readonly contexto: ContextoVista,
  ) {
    const { sala, partida } = juego;
    this.partida = partida;
    // Con su acceso al grimorio (es de la partida, no del participante)
    this.participantes = sala.participantes.participantes().map((p) => ({ ...p, accesoGrimorio: partida.acceso.de(p.id) }));
    // Cada jugador de la plaza como asiento del contrato: lo suyo, lo del grimorio y sus faroles
    const calavera = partida.grimorio.calavera();
    this.asientos = partida.plaza().map((j) => {
      const marcado = calavera?.jugador === j.id;
      return {
        id: j.id,
        ocupante: j.participanteId,
        muerto: j.muerto,
        muertePendiente: j.muertePendiente,
        votoGastado: j.votoGastado,
        marcado,
        votosMarca: marcado ? calavera.votos : null,
        personaje: j.personaje,
        alineamiento: j.alineamiento,
        recordatorios: [...j.recordatorios],
        nota: partida.grimorio.nota(j.id),
        faroles: partida.faroles.deJugador(j),
        farolEnUso: partida.faroles.enUso(j),
      };
    });
    this.nominacion = partida.nominaciones.nominacion();
    this.revelacion = partida.revelacion.revelacion();
    this.reveladas = new Set(this.revelacion?.reveladas ?? []);
    this.tor = partida.npcs.activo(NPC_TOR);
    this.retenidas = partida.entregas.fichasRetenidas();
    this.secreta = partida.votacionSecreta();
    this.gastadosAlVotar = partida.nominaciones.gastadosAlVotar();
    this.comun = {
      configuracion: partida.configuracion.actual(),
      fase: partida.fases.actual(),
      distribucion: partida.reparto.distribucion(),
      bolsa: partida.reparto.bolsa.bolsa(),
      faroles: partida.faroles.faroles(),
      npcs: partida.npcs.npcs(),
      despertares: partida.despertares.despertares(),
      recordatoriosNoche: partida.recordatoriosNoche(),
      votaciones: partida.nominaciones.votaciones(),
      senalamiento: partida.senalamientos.senalamiento(),
      narradorVirtual: juego.narrador.actual(),
    };
  }

  /** El estado de la sala tal como lo ve este participante. */
  para(yo: Participante): SalaEstado {
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
      asientos: veGrimorio ? this.asientos : this.asientos.map((a) => this.asientoSinGrimorio(a, yo, ocultarVotos, ocultarVotacion)),
      configuracion: comun.configuracion,
      nominacion: ocultarVotacion && this.nominacion ? nominacionSecreta(this.nominacion, miAsiento) : this.nominacion,
      fase: comun.fase,
      distribucion: comun.distribucion,
      revelacion: this.revelacion,
      gong: partida.reloj.gong(),
      reloj: partida.reloj.reloj(),
      // De noche, solo quien señala (y quien ve el grimorio)
      senalamiento: partida.senalamientos.veSenalamiento(yo) ? comun.senalamiento : null,
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
      habilidadesNoche: narra ? partida.guiado.habilidadesNoche() : [],
      nuevoImp: narra ? partida.guiado.nuevoImp() : null,
      // Los despertares: los narradores y los visitantes que ven el grimorio, todos; un
      // jugador, solo el de su asiento (nadie más sabe a quién se despierta).
      despertares: veGrimorio
        ? comun.despertares
        : yo.rol === 'jugador'
          ? comun.despertares.filter((d) => d.asiento === partida.despertares.asientoDespiertoDe(yo.id))
          : [],
      grimorioRecibido: yo.rol === 'jugador' ? partida.entregas.grimorioRecibidoPor(yo.id) : null,
      narradorVirtual: comun.narradorVirtual,
      palabra: partida.nominaciones.palabra(),
      yo: yo.id,
      acciones: contexto.accionesDe(yo),
    };
  }

  /** Un asiento como lo ve quien no ve el grimorio (un jugador o un visitante sin acceso). */
  private asientoSinGrimorio(a: SalaAsiento, yo: Participante, ocultarVotos: boolean, ocultarVotacion: boolean): SalaAsiento {
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
    const id = identidadDe(a);
    return id && this.partida.guion.personaje(id)?.tipo === 'traveller' ? id : null;
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
    if (this.tor) return { ...sinRecordatorios(a), personaje: identidadDe(a) };
    const viajero = this.viajeroDe(a);
    // Un viajero: quien es lo ve todo el mundo; su alineamiento, como se le dijo (al repartir
    // o con «Tú eres»), no el que el narrador le ponga en el grimorio
    return viajero
      ? { ...sinRecordatorios(a), personaje: viajero, alineamiento: this.partida.entregas.fichaEntregada(a.id).alineamiento }
      : { ...sinRecordatorios(a), ...this.partida.entregas.fichaEntregada(a.id) };
  }
}
