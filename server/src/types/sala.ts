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
  /** La forma de su mano al levantarla; se conserva aunque la baje. */
  formaMano: SalaFormaMano;
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
  /** Revelando el grimorio (final de la partida), o null. */
  revelacion: SalaRevelacion | null;
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
  /** id del participante que recibe el mensaje. */
  yo: string;
  /** Acciones que puede usar ahora quien recibe el mensaje (ver `salaAcciones`). */
  acciones: string[];
}
