import { SalaMensajesPrivados } from './chat';

/** Papel de cada participante en la sala de juego. Todo el que entra es visitante. */
export type SalaRol = 'narrador' | 'jugador' | 'visitante';

/** Forma de la mano que levanta un jugador (como en piedra, papel o tijera). */
export type SalaFormaMano = 'palma' | 'puno' | 'tijera';
export const SALA_FORMAS_MANO: SalaFormaMano[] = ['palma', 'puno', 'tijera'];

export interface SalaParticipante {
  /** Identificador dentro de la sala (no es el id de usuario de la web). */
  id: string;
  nombre: string;
  /** Entró con su cuenta de la web (si no, es invitado). */
  conCuenta: boolean;
  /** Ruta del avatar de su cuenta; null para los invitados. */
  avatar: string | null;
  rol: SalaRol;
  /** false mientras se espera a que vuelva tras perder la conexión. */
  conectado: boolean;
  /** Jugador con la mano levantada. Al dejar de ser jugador, vuelve a false. */
  manoLevantada: boolean;
  /**
   * Con la mano levantada, levanta las dos (la Banshee muerta con su «Has Ability»):
   * su voto cuenta doble. Siempre false con la mano bajada.
   */
  dosManos: boolean;
  /** La forma de su mano al levantarla; se conserva aunque la baje. */
  formaMano: SalaFormaMano;
  /** Ha quitado el sonido: no oye a los demás (los demás lo ven junto a su nombre). */
  sinSonido: boolean;
  /**
   * Un visitante puede pedir ver el grimorio del narrador: «solicitado» mientras
   * el narrador responde; «concedido», lo ve como él (todos los personajes) y ya
   * no lo pierde (tampoco si sale de la sala y vuelve) ni puede sentarse (lo ha
   * visto). Al cambiar de papel, al limpiar el grimorio (otra partida) o si un
   * narrador lo expulsa, vuelve a «ninguno».
   */
  accesoGrimorio: SalaAccesoGrimorio;
}

export type SalaAccesoGrimorio = 'ninguno' | 'solicitado' | 'concedido';

/**
 * Un asiento de la mesa (las sillas de la partida). Cada asiento tiene su ficha,
 * haya alguien sentado o no: la muerte y la calavera son de la ficha.
 */
export interface SalaAsiento {
  id: string;
  /** id del participante sentado (un jugador), o null si está libre. */
  ocupante: string | null;
  /** Su ficha está muerta (lleva sudario). */
  muerto: boolean;
  /**
   * Muerta de noche, a falta de que el narrador lo anuncie (de día, al pulsar el
   * sudario): aún no cuenta como muerta. Solo la ven quienes ven el grimorio.
   */
  muertePendiente: boolean;
  /**
   * Muerta, ya ha gastado el único voto que le queda (se apaga su vela). Es
   * público: todos saben qué muertos pueden votar todavía. Al morir o revivir
   * vuelve a false.
   */
  votoGastado: boolean;
  /** Su ficha lleva la calavera (solo una de la mesa). */
  marcado: boolean;
  /** Con cuántos votos se le puso la calavera (desde una nominación ya votada), o null. */
  votosMarca: number | null;
  /**
   * El personaje de su ficha (id del catálogo o del guion), o null si no tiene.
   * Solo lo ven los narradores y quien se sienta en ese asiento (el suyo).
   */
  personaje: string | null;
  /**
   * Su alineamiento si el narrador lo ha cambiado; null: el de su tipo (aldeanos
   * y forasteros, buenos; esbirros y demonios, malvados; viajeros, sin decidir).
   */
  alineamiento: SalaAlineamiento | null;
  /**
   * Las fichas recordatorio puestas junto a la suya, en el orden en que se
   * pusieron. Son del grimorio: las ven los narradores (y quien ve el grimorio),
   * no los jugadores, ni en su propia ficha.
   */
  recordatorios: SalaRecordatorio[];
  /**
   * Las notas del narrador sobre este asiento (hasta SALA_NOTAS_MAX), en el orden
   * en que se escribieron. Son del grimorio, como los recordatorios: las ven los
   * narradores y quien ve el grimorio.
   */
  notas: SalaNota[];
  /**
   * Los faroles que el jugador de este asiento se ha puesto (o ha copiado de
   * los del narrador): siempre 3 casillas, cada una un id de personaje o null.
   * Los ven quien se sienta ahí y quien ve el personaje del asiento.
   */
  faroles: (string | null)[];
}

/** Cuántos faroles hay: los del narrador y los de cada asiento. */
export const NUM_FAROLES = 3;

/**
 * Una ficha del grimorio que el narrador envía al Espía o a la Viuda: lo que se
 * ve de ella (el narrador puede cambiarlo antes de enviarlo).
 */
export interface SalaFichaEnviada {
  asientoId: string;
  personaje: string | null;
  alineamiento: SalaAlineamiento | null;
  muerto: boolean;
  recordatorios: SalaRecordatorio[];
}

/** Un grimorio enviado (el último) a un asiento: cuándo y sus fichas, en el orden de la mesa. */
export interface SalaGrimorioEnviado {
  hora: number;
  fichas: SalaFichaEnviada[];
}

/** Una nota del narrador sobre un asiento: texto libre. */
export interface SalaNota {
  id: string;
  texto: string;
}

/** Notas como mucho por asiento, y su largo máximo. */
export const SALA_NOTAS_MAX = 4;
export const SALA_NOTA_LARGO_MAX = 500;

/**
 * El «personaje» de un recordatorio con texto propio (escrito por el narrador, sin
 * personaje ni icono): su texto es el que se escribió, de hasta SALA_RECORDATORIO_TEXTO_MAX.
 */
export const RECORDATORIO_TEXTO = '_texto';
export const SALA_RECORDATORIO_TEXTO_MAX = 14;

/**
 * Una ficha recordatorio: de qué personaje es (su icono) y cuál de sus recordatorios.
 * Con texto propio, `personaje` es RECORDATORIO_TEXTO e `indice`, -1.
 */
export interface SalaRecordatorio {
  id: string;
  personaje: string;
  /** Cuál de los recordatorios del personaje (su posición en la lista del guion). */
  indice: number;
  /** Su texto en el original (el cliente lo traduce si puede). */
  texto: string;
}

export type SalaAlineamiento = 'bueno' | 'malvado';

/**
 * El final de la partida: el narrador dice qué bando ha ganado, todas las fichas
 * se dan la vuelta y él las va revelando una a una (todos ven el personaje de
 * las reveladas). Con todas reveladas, se anuncia el ganador.
 */
export interface SalaRevelacion {
  ganador: SalaAlineamiento;
  /** Asientos cuya ficha ya se ha revelado, en orden. */
  reveladas: string[];
  /** Están todas reveladas. */
  terminada: boolean;
}

/**
 * Cuántos personajes de cada tipo tiene la partida: se cuentan los asientos,
 * se quitan los que llevan un viajero y se mira la tabla (ver repartoPara).
 */
export interface SalaDistribucion {
  /** Asientos que no llevan viajero. */
  jugadores: number;
  viajeros: number;
  /** null si hay menos de 5 jugadores (no hay reparto). */
  aldeanos: number | null;
  forasteros: number | null;
  esbirros: number | null;
  demonios: number | null;
}

/** Ajustes de la partida que fija el narrador y valen para todos. */
export interface SalaConfiguracion {
  /** Cada jugador puede cambiar las fichas en su propio grimorio (si no, solo las ve). */
  grimorioJugadores: boolean;
  /** Lo que tarda la aguja en pasar de una ficha a la siguiente al votar, en segundos. */
  segundosPorFicha: number;
  /** Mensajes privados entre jugadores: ninguno, solo con los vecinos o con todos. */
  mensajes: SalaMensajesPrivados;
  /** El fondo de la sala (ruta de una imagen en /uploads/sala/fondos), o null: el de por defecto. */
  fondo: string | null;
}

/**
 * La votación de una nominación: la aguja del nominado recorre las fichas en el
 * sentido de las agujas del reloj, del asiento siguiente al nominado hasta él.
 */
export interface SalaVotacion {
  /** Los asientos en el orden en que vota cada uno (el último, el nominado). */
  orden: string[];
  /** Cuántas fichas ha recorrido ya la aguja. */
  paso: number;
  /** Por asiento ya recorrido: los votos acumulados si votó, o null si no. */
  resultados: Record<string, number | null>;
  votos: number;
  terminada: boolean;
  /** Los asientos que votaron con las dos manos (dos votos). */
  dobles?: string[];
}

/** Una nominación en curso: de qué asiento a qué asiento (ids de asiento). */
export interface SalaNominacion {
  desde: string;
  hasta: string;
  /** Cuándo acaba la cuenta atrás (ms, reloj del servidor), o null si no ha empezado. */
  cuentaAtrasFin: number | null;
  /** La votación, desde que acaba la cuenta atrás. */
  votacion: SalaVotacion | null;
  /** Votos que hacen falta para el nominado: los que ha elegido el narrador o, si no, los de por defecto. */
  votosNecesarios: number;
  /**
   * Los de por defecto: la mitad de las fichas vivas (redondeando hacia arriba)
   * y, si ya ha habido hoy una votación que llegó a los necesarios, al menos uno
   * más que la que más votos tuvo (aunque empatara y nadie lleve la calavera).
   */
  votosNecesariosPorDefecto: number;
}

/** Una nominación del día y, si se votó, su votación, para el registro del narrador. */
export interface SalaRegistroVotacion {
  /** Cuándo se nominó (ms). */
  hora: number;
  /** El día de la partida en que se nominó. */
  dia: number;
  /** «asiento 1 (Ana)» o «asiento 1, libre». */
  nomina: string;
  nominado: string;
  /** Nombres de quienes votaron, en el orden en que votaron; null si no se llegó a votar. */
  votantes: string[] | null;
  votos: number | null;
}

/**
 * En qué momento está la partida: la preparación y, después, noche 1, día 1,
 * noche 2, día 2… (lo cambia el narrador).
 */
export interface SalaFase {
  momento: 'preparacion' | 'noche' | 'dia';
  /** Número de la noche o del día (0 en la preparación). */
  numero: number;
  /** Veces que se ha limpiado el grimorio (para avisarlo una vez, sin avisar de cada ficha). */
  reinicios: number;
}

/** Una conversación privada (voz y vídeo) entre dos o más jugadores o narradores. */
export interface SalaConversacion {
  id: string;
  /** ids de los que hablan en ella (jugadores y narradores). */
  miembros: string[];
  /**
   * ids de los visitantes que la escuchan (ni hablan ni se ven). A los jugadores
   * no se les manda: no saben que están.
   */
  oyentes: string[];
}

/** Una invitación a conversar, pendiente de que `para` la acepte o la rechace. */
export interface SalaInvitacion {
  id: string;
  de: string;
  para: string;
  /**
   * Si es una petición para unirse a la conversación de `para`: su id. La ven
   * y la pueden aceptar todos sus miembros. Sin ella, `de` invita a `para`.
   */
  conversacion?: string;
}

/**
 * Lo que se puede mandar al despertar a alguien de noche. Las fichas las usan
 * el narrador y el jugador despierto; las tarjetas, solo el narrador. El
 * cliente tiene el mismo catálogo (client/src/sala/despertar.ts).
 */
export const FICHAS_DESPERTAR = [
  'entendido', 'si', 'no', 'bueno', 'malvado',
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco',
  'jugador', 'personaje', 'personalizado',
] as const;
export type FichaDespertar = (typeof FICHAS_DESPERTAR)[number];

export const TARJETAS_DESPERTAR = [
  'habilidad', 'eleccion', 'noEnJuego', 'demonio', 'esbirros', 'tuEres', 'esteJugadorEs', 'teHaElegido',
] as const;
export type TarjetaDespertar = (typeof TARJETAS_DESPERTAR)[number];

/** Lo que lleva cada ficha o tarjeta además de sí misma. */
export interface AdjuntoDespertar {
  jugadores?: boolean;
  personajes?: boolean;
  texto?: boolean;
  /** Un alineamiento (bueno o malvado), opcional. */
  alineamiento?: boolean;
}

export const ADJUNTOS_DESPERTAR: Partial<Record<FichaDespertar | TarjetaDespertar, AdjuntoDespertar>> = {
  jugador: { jugadores: true },
  personaje: { personajes: true },
  personalizado: { texto: true },
  noEnJuego: { personajes: true },
  demonio: { jugadores: true },
  esbirros: { jugadores: true },
  tuEres: { personajes: true, alineamiento: true },
  esteJugadorEs: { jugadores: true, personajes: true },
  teHaElegido: { personajes: true },
};

/** Lo que se manda mientras alguien está despierto: una ficha o una tarjeta, con lo que lleve. */
export interface MensajeDespertar {
  id: string;
  /** 'narrador', o el id del asiento del jugador que contesta. */
  autor: string;
  ficha: FichaDespertar | null;
  tarjeta: TarjetaDespertar | null;
  /** ids de asiento. */
  jugadores: string[];
  /** ids de personaje. */
  personajes: string[];
  texto: string | null;
  /** «Tú eres»: el alineamiento, si se dice. */
  alineamiento: SalaAlineamiento | null;
  /** En qué momento de la partida se mandó («Noche 2»). */
  fase: { momento: SalaFase['momento']; numero: number };
  /** ms */
  hora: number;
}

/**
 * Un despertar: lo que se dicen el narrador y el jugador de un asiento (o el
 * asiento, si está libre). Se abre de noche y dura hasta limpiar el grimorio;
 * se pueden tener varios a la vez, uno por asiento. Cerrar su ventana es cosa de
 * cada uno (en su navegador): el despertar sigue. Solo lo reciben los narradores
 * y el jugador de ese asiento.
 */
export interface SalaDespertar {
  asiento: string;
  mensajes: MensajeDespertar[];
}

/** Lo que el servidor manda a cada cliente cada vez que cambia la sala. */
export interface SalaEstado {
  participantes: SalaParticipante[];
  /** Los asientos de la mesa, en orden: el primero a las 12 y siguiendo como las agujas del reloj. */
  asientos: SalaAsiento[];
  configuracion: SalaConfiguracion;
  nominacion: SalaNominacion | null;
  fase: SalaFase;
  /** El reparto de personajes de la partida, para todos. */
  distribucion: SalaDistribucion;
  /** Los personajes metidos en la bolsa (ids); solo se manda a los narradores. */
  bolsa: string[];
  /**
   * Los faroles que el narrador ha preparado para el demonio (3 casillas, id de
   * personaje o null). Se mandan a los narradores y a los visitantes.
   */
  faroles: (string | null)[];
  /** Los NPCs de la partida (legendarios y lóricos, ids), en el orden en que se añadieron. Para todos. */
  npcs: string[];
  /**
   * El reparto que un narrador ha dado por bueno aunque no cuadre con las reglas
   * (su firma, la calcula el cliente: «7:5/0/1/1»), o null. Si el reparto cambia,
   * deja de valer solo. Solo se manda a los narradores.
   */
  setupAceptado: string | null;
  /**
   * El narrador ha pedido silencio (con el Bibliotecario del Infierno en juego):
   * los jugadores no pueden emitir su micrófono, ni en la mesa ni en las
   * conversaciones. Para todos.
   */
  silencio: boolean;
  /** Las reglas del Bootlegger: las del guion o las que ha escrito el narrador. Para todos. */
  bootlegger: string[];
  /** El personaje bueno que el narrador ha nombrado con el Storm Catcher (id), o null. Para todos. */
  rolStormcatcher: string | null;
  /**
   * Con el Gardener: los personajes ya repartidos aún no se entregan (los jugadores
   * no ven ni el suyo) hasta que el narrador pulsa el Gardener. Para todos.
   */
  fichasRetenidas: boolean;
  /** Revelando el grimorio (final de la partida), o null. */
  revelacion: SalaRevelacion | null;
  /**
   * Hora del servidor (ms) del último gong del narrador («¡regresad a la plaza!»),
   * o null. Al cambiar, suena y se ve el aviso. Para todos.
   */
  gong: number | null;
  /** Hay videollamada (cámaras y micrófonos) en esta sala. */
  video: boolean;
  /** Las conversaciones privadas en curso (todos ven quién habla con quién, no qué). */
  conversaciones: SalaConversacion[];
  /** Las invitaciones a conversar que ha hecho o recibido quien recibe el mensaje. */
  invitaciones: SalaInvitacion[];
  /** Hora del servidor (ms) al mandar el estado: el cliente la usa para la cuenta atrás. */
  ahora: number;
  /** Registro de nominaciones y votaciones (en orden); solo se manda a los narradores. */
  votaciones: SalaRegistroVotacion[];
  /**
   * Fichas recordatorio (estrella) del orden de noche que los narradores han
   * quitado (false) o puesto (true) a mano, por id de personaje o 'esbirros' /
   * 'demonios'; las demás son las automáticas. Solo se manda a los narradores.
   */
  recordatoriosNoche: Record<string, boolean>;
  /** Los despertares: todos, para los narradores; el de su asiento, para un jugador; ninguno, para los demás. */
  despertares: SalaDespertar[];
  /**
   * El grimorio que el narrador ha enviado (el último) a quien recibe el mensaje,
   * si está sentado en el asiento al que se envió (el Espía, la Viuda); si no, null.
   */
  grimorioRecibido: SalaGrimorioEnviado | null;
  /** id del participante que recibe el mensaje. */
  yo: string;
  /** Acciones que puede usar ahora quien recibe el mensaje (ver `salaAcciones`). */
  acciones: string[];
}
