/**
 * El contrato de la sala de juego: lo que el servidor manda por el socket y las
 * constantes que tienen que valer lo mismo en los dos lados. Lo importa también el
 * cliente (alias @contrato), así que aquí solo van tipos y valores puros: nada de
 * Node, de la base de datos ni de los servicios, y los imports de tipos con `import type`.
 */
import type { SalaMensajesPrivados } from './chat';

/** Papel de cada participante en la sala de juego. Todo el que entra es visitante. */
export type SalaRol = 'narrador' | 'jugador' | 'visitante';

/** Forma de la mano que levanta un jugador (como en piedra, papel o tijera). */
/**
 * La forma de la mano: una de SALA_FORMAS_MANO o el id de un personaje del guion
 * (la mano es su icono).
 */
export type SalaFormaMano = string;
/** Los estilos de mano (lo mismo en el cliente, ESTILOS_MANO de marcas.ts, sin «al azar»). */
export const SALA_ESTILOS_MANO = ['defecto', 'laton', 'cinco', 'guante', 'esqueleto', 'guantelete'];

/** Partidas jugadas (terminadas en la sala) por debajo de las que se es novato. */
export const SALA_PARTIDAS_NOVATO = 10;

export const SALA_FORMAS_MANO: SalaFormaMano[] = [
  'palma', 'tijera', 'puno', 'peineta', 'paz', 'cuernos', 'lagarto', 'spock', 'senalar',
  // Emoticonos (el cliente sabe qué emoji es cada uno: formasMano.ts)
  ...['sonrisa', 'risa', 'guino', 'enamorado', 'beso', 'gafas', 'pensando', 'sospecha', 'silencio', 'susto',
    'llanto', 'enfado', 'diablo', 'angel', 'sueno', 'fiesta', 'labios', 'corazon', 'rosa', 'girasol',
    'ramo', 'pulgar-arriba', 'pulgar-abajo', 'aplausos', 'por-favor', 'palomitas', 'calavera', 'fantasma',
    'fuego', 'ojos'].map((e) => `emoji-${e}`),
];

export interface SalaParticipante {
  /** Identificador dentro de la sala (no es el id de usuario de la web). */
  id: string;
  nombre: string;
  /** Entró con su cuenta de la web (si no, es invitado). */
  conCuenta: boolean;
  /** Con cuenta, su id de usuario de la web (para enlazar a su perfil); invitado, null. */
  usuarioId: string | null;
  /** Con cuenta, ha jugado menos de SALA_PARTIDAS_NOVATO partidas (lleva el pulpito junto al nombre). */
  novato: boolean;
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
  /**
   * Cómo se ve su mano (su «skin»: ver SALA_ESTILOS_MANO). La elige cada uno y la ven
   * así todos; cada mano, con la de quien la levanta.
   */
  estiloMano: string;
  /** Ha quitado el sonido: no oye a los demás (los demás lo ven junto a su nombre). */
  sinSonido: boolean;
  /** Es un narrador virtual (no una persona): cuál. */
  virtual?: IdNarradorVirtual;
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
   * La nota del narrador sobre este asiento (texto libre), o null. Es del
   * grimorio, como los recordatorios: la ven los narradores y quien ve el grimorio.
   */
  nota: string | null;
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

/**
 * Un grimorio enviado (el último) a un asiento: cuándo, sus fichas (en el orden de
 * la mesa) y los faroles del demonio (ids de personaje, hasta NUM_FAROLES).
 */
export interface SalaGrimorioEnviado {
  hora: number;
  fichas: SalaFichaEnviada[];
  faroles: string[];
}

/** El largo máximo de la nota de un asiento. */
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
  /**
   * Con texto propio, el icono del centro: uno de ICONOS_RECORDATORIO_TEXTO o el
   * id de un personaje del guion. Sin él, el logo de La Secta.
   */
  icono?: string;
}

/** Los iconos que no son de un personaje para un recordatorio con texto propio. */
export const ICONOS_RECORDATORIO_TEXTO = ['_secta', '_pluma', '_interrogante'];

export type SalaAlineamiento = 'bueno' | 'malvado';

/**
 * El final de la partida: el narrador dice qué bando ha ganado, todas las fichas
 * se dan la vuelta y él las va revelando una a una (todos ven el personaje de
 * las reveladas). Con todas reveladas, se anuncia el ganador.
 */
/**
 * Los personajes cuya habilidad puede acabar la partida (o que conviene dejar
 * dicho al final, como el Encantador de serpientes que pica al demonio): al
 * revelar, el narrador marca lo que ha pasado con los que están en juego. Los
 * textos los pone el cliente (causasFinal.ts); para añadir uno, en los dos sitios.
 */
export const CAUSAS_FIN_PARTIDA = [
  'slayer', 'mayor', 'alsaahir', 'goblin', 'saint', 'mastermind', 'snakecharmer', 'klutz', 'eviltwin', 'fanggu', 'vortox',
  'huntsman', 'damsel', 'fearmonger', 'leviathan', 'cultleader', 'puzzlemaster', 'banshee', 'amnesiac', 'scarletwoman',
  'politician',
];

/**
 * Las causas cuyo logro solo cuenta si quien lo consigue gana la partida: picar al
 * Demonio y perder, o salvar un día más al Demonio y que gane el bien, no valen.
 */
export const CAUSAS_CON_VICTORIA = ['mastermind', 'snakecharmer', 'fanggu', 'scarletwoman', 'leviathan', 'cultleader', 'politician'];

/**
 * Las causas cuyo logro no es de quien lleva ese personaje sino de un esbirro que
 * elige el narrador: la Doncel descubierta es logro del esbirro que la cazó.
 */
export const CAUSAS_DE_ESBIRRO = ['damsel'];

/**
 * El reloj del narrador: una cuenta atrás que ven todos, con su mensaje
 * («Conversaciones privadas»). Al acabar suena el gong. Cada cliente la calcula
 * con el reloj del servidor, así que el servidor no tiene que avisar al terminar.
 */
export interface SalaReloj {
  /** Cuándo empezó y cuándo acaba (ms, reloj del servidor). */
  inicio: number;
  fin: number;
  /** El mensaje (puede ir vacío). */
  mensaje: string;
}

/**
 * Un señalamiento: el narrador pide que unos jugadores señalen a otros (con un
 * mensaje). Mientras dura la cuenta atrás cada uno elige (y puede cambiar);
 * al acabar se congela. De día lo ven todos; de noche, solo los que señalan
 * (despiertos) y quien ve el grimorio. Lo quita el narrador.
 */
export interface SalaSenalamiento {
  id: string;
  /** 'normal', o el de Lil' Monsta: los esbirros eligen quién lo cuida, sin cuenta atrás. */
  tipo: 'normal' | 'lilmonsta';
  /** Lo que se pide, en grande (puede ir vacío). */
  mensaje: string;
  /** Los asientos que señalan y los que se pueden señalar (ids; si no se eligió ninguno, todos). */
  senaladores: string[];
  objetivos: string[];
  /** De día: lo ven todos (y suena la cuenta atrás). */
  publico: boolean;
  /** Cuándo empezó y cuándo acaba la cuenta atrás (ms, reloj del servidor); fin null: sin cuenta atrás. */
  inicio: number;
  fin: number | null;
  /** Ya no se puede señalar: acabó la cuenta atrás o (Lil' Monsta) todos coinciden. */
  congelado: boolean;
  /** A quién señala cada asiento (asiento que señala → asiento señalado). */
  senales: Record<string, string>;
}

/** Los límites de un señalamiento: segundos de la cuenta atrás (10 por defecto) y largo del mensaje. */
export const SALA_SENALAMIENTO = { minSegundos: 3, maxSegundos: 120, defectoSegundos: 10, mensajeMax: 120 };

export interface SalaRevelacion {
  ganador: SalaAlineamiento;
  /** Lo que ha pasado (ids de CAUSAS_FIN_PARTIDA, de personajes en juego), por orden. */
  causas: string[];
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
  /** De ellos, los que no están muertos (con sudario). */
  jugadoresVivos: number;
  viajeros: number;
  viajerosVivos: number;
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
  /**
   * El fondo de la sala: una imagen en /uploads/sala/fondos (subida o de la
   * Biblioteca), la dirección https del fondo que trae el guion, o null: el de por defecto.
   */
  fondo: string | null;
  /**
   * Las cámaras de quien conversa en privado no se ven en la mesa (de entrada,
   * sí se ocultan). Si no, en la mesa se ve su cámara, sin su voz (de día: de
   * noche no hay cámaras en la mesa).
   */
  ocultarCamarasConversacion: boolean;
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
  /**
   * Lo que valió el voto de cada asiento que votó, si no fue 1: las dos manos de la
   * Banshee (×2), el Burócrata (×3), el Ladrón (en negativo), y combinados.
   */
  valores?: Record<string, number>;
}

/** Una nominación en curso: de qué asiento a qué asiento (ids de asiento). */
export interface SalaNominacion {
  desde: string;
  hasta: string;
  /** Cuándo acaba la cuenta atrás (ms, reloj del servidor), o null si no ha empezado. */
  cuentaAtrasFin: number | null;
  /** La votación, desde que acaba la cuenta atrás. */
  votacion: SalaVotacion | null;
  /**
   * El nominado es un viajero: no es una nominación, es una expulsión. Hace falta
   * la mitad de los votos de la plaza (de todos los asientos, vivos o muertos, sin
   * mirar otras votaciones), vota cualquiera sin gastar su voto de muerto, cada mano
   * vale 1 y, si sale, el viajero muere al momento (sin calavera). Nunca es secreta
   * (el Organ Grinder solo esconde las nominaciones).
   */
  expulsion: boolean;
  /** Votos que hacen falta para el nominado: los que ha elegido el narrador o, si no, los de por defecto. */
  votosNecesarios: number;
  /**
   * Los de por defecto: la mitad de las fichas vivas (redondeando hacia arriba)
   * y, si ya ha habido hoy una votación que llegó a los necesarios, al menos uno
   * más que la que más votos tuvo (aunque empatara y nadie lleve la calavera).
   */
  votosNecesariosPorDefecto: number;
  /**
   * Votación secreta (el Organ Grinder vivo y sin su «Drunk»): a quien no ve el
   * grimorio no se le mandan los votos que hacen falta, ni el recuento, ni quién
   * vota (salvo lo suyo), ni las manos de los demás (ver salaSocket).
   */
  privada: boolean;
}

/** Una nominación del día y, si se votó, su votación, para el registro del narrador. */
export interface SalaRegistroVotacion {
  /** Cuándo se nominó (ms). */
  hora: number;
  /** El día de la partida en que se nominó. */
  dia: number;
  /** «Ana» o, si el asiento está libre, «asiento 1». */
  nomina: string;
  nominado: string;
  /** Los asientos que nominan y que son nominados (no los hay en las partidas guardadas antes). */
  nominaAsiento?: string;
  nominadoAsiento?: string;
  /** Era la expulsión de un viajero (ver SalaNominacion.expulsion), no una nominación. */
  expulsion?: boolean;
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

/** Con lo que contesta el jugador a lo que le manda el despertar guiado (si no le pide que elija). */
export const FICHAS_RESPUESTA_GUIADA: readonly FichaDespertar[] = ['entendido', 'personalizado'];

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
  /**
   * «Haz una elección» de una habilidad (el despertar guiado, ver SalaHabilidadNoche):
   * a cuántos jugadores elige y si puede elegirse a sí mismo. El jugador solo puede
   * contestar con la ficha «Jugador» y justo esos. null: una elección libre.
   */
  eleccion: SalaEleccionDespertar | null;
  /**
   * Lo ha mandado el despertar guiado (la habilidad del que despierta). Si es lo
   * último del narrador y no le pide que elija, el jugador solo contesta
   * «Entendido» o con un texto («Personalizado»).
   */
  guiado: boolean;
  /** En qué momento de la partida se mandó («Noche 2»). */
  fase: { momento: SalaFase['momento']; numero: number };
  /** ms */
  hora: number;
}

/** Lo que se manda en un despertar, sin quién, cuándo ni elección. */
export type SalaEnvioDespertar = Omit<MensajeDespertar, 'id' | 'autor' | 'fase' | 'hora' | 'eleccion' | 'guiado'>;

/** La elección que pide una habilidad: a cuántos jugadores y si puede elegirse a sí mismo. */
export interface SalaEleccionDespertar {
  cantidad: number;
  puedeElegirse: boolean;
}

/**
 * Cómo está el despertar guiado de una fila del orden de noche:
 * - listo: se hace solo, con un clic;
 * - falta: falta algo en el grimorio (ver los avisos) y no se puede;
 * - revisar: el narrador mira lo propuesto (las opciones) y lo cambia si quiere antes de mandarlo;
 * - esperando: se le ha pedido que elija y aún no ha contestado;
 * - hecho: ya está, esta noche.
 */
export type SalaEstadoHabilidad = 'listo' | 'falta' | 'revisar' | 'esperando' | 'hecho';

/** Cómo registra un Espía o una Reclusa en una opción: como bueno, malvado, el demonio o no. */
export type SalaRegistro = 'bueno' | 'malvado' | 'demonio' | 'noDemonio';

/**
 * Lo que dice el despertar guiado al narrador (el cliente lo pone en palabras):
 * - faltaRecordatorio: hay que poner antes ese recordatorio (de ese personaje, con ese texto);
 * - envenenado / borracho: el que despierta está droison;
 * - muerto: el de la ficha está muerto;
 * - noMuere: el Ravenkeeper no muere esta noche;
 * - registro: en lo que se calcula entra un Espía o una Reclusa (`asiento`);
 * - sinEfecto: estaba droison al elegir; se le ha contestado sin poner el recordatorio;
 * - protegido: el demonio ha elegido a uno protegido (`asiento`): no muere;
 * - alcalde: el demonio ha elegido al Alcalde (`asiento`): decide el narrador;
 * - elegido: a quién ha elegido (`asientos`);
 * - pocosJugadores: hay menos de 7 jugadores: los esbirros y el demonio no se despiertan;
 * - faltanFaroles: el narrador aún no ha puesto los 3 faroles del demonio.
 */
export type SalaAvisoHabilidad =
  | { tipo: 'faltaRecordatorio'; personaje: string; texto: string }
  | { tipo: 'envenenado' | 'borracho' | 'muerto' | 'noMuere' | 'sinEfecto' | 'pocosJugadores' | 'faltanFaroles' }
  | { tipo: 'registro' | 'protegido' | 'alcalde'; asiento: string }
  | { tipo: 'elegido'; asientos: string[] };

/** Una respuesta posible: lo que se manda y, con un Espía o una Reclusa, cómo registra cada uno para que salga. */
export interface SalaOpcionDespertar {
  envio: SalaEnvioDespertar;
  registros: { asiento: string; como: SalaRegistro }[];
}

/**
 * El despertar guiado de una fila del orden de noche (solo con el guion Trouble
 * Brewing, de momento): el personaje despierta según su habilidad. Si elige, solo
 * puede elegir lo que ella le deja y el recordatorio se pone solo; si recibe
 * información, se calcula y se manda sola. Uno por personaje con habilidad y ficha en la mesa,
 * y los de la primera noche para los esbirros y el demonio ('esbirros' y 'demonios').
 */
export interface SalaHabilidadNoche {
  /** El personaje, o 'esbirros' / 'demonios'. */
  personaje: string;
  /** El asiento que despierta (el de la ficha); con 'esbirros' o 'demonios', el primero. */
  asiento: string;
  /** Todos los que despiertan: el de la ficha o, con 'esbirros' y 'demonios', cada uno. */
  asientos: string[];
  estado: SalaEstadoHabilidad;
  avisos: SalaAvisoHabilidad[];
  /** Lo que se propone mandar (revisar: una o varias, la primera es la de verdad). */
  opciones: SalaOpcionDespertar[];
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

/**
 * Los narradores virtuales: llevan la partida solos, sin una persona de narrador.
 * «Tonto y tú» elige siempre al azar; Jarvis sale, pero aún no se puede elegir.
 */
export const NARRADORES_VIRTUALES = [
  { id: 'tontoYTu', nombre: 'Tonto y tú', descripcion: 'Elige siempre al azar.', disponible: true },
  { id: 'jarvis', nombre: 'Jarvis', descripcion: 'Próximamente.', disponible: false },
] as const;
export type IdNarradorVirtual = (typeof NARRADORES_VIRTUALES)[number]['id'];

/** Los guiones que puede llevar un narrador virtual (los predeterminados, por su id). */
export const GUIONES_NARRADOR_VIRTUAL = [{ id: 'troublebrewing', nombre: 'Trouble Brewing' }] as const;
export type GuionNarradorVirtual = (typeof GUIONES_NARRADOR_VIRTUAL)[number]['id'];

/** Cuántos jugadores puede tener una partida con narrador virtual. */
export const JUGADORES_NARRADOR_VIRTUAL = { min: 7, max: 15 } as const;

/** Por dónde va la partida del narrador virtual. */
export type EtapaNarradorVirtual =
  | 'esperandoJugadores'
  | 'noche'
  | 'privados'
  | 'puestaEnComun'
  | 'nominaciones'
  | 'violinista'
  | 'revelando';

/** El narrador virtual de la sala, para todos. */
export interface SalaNarradorVirtual {
  id: IdNarradorVirtual;
  /** Su participante (con `rol: 'narrador'` y `virtual`). */
  participante: string;
  /** Quien lo añadió: el único que puede quitarlo. */
  creador: string;
  guion: GuionNarradorVirtual;
  jugadores: number;
  etapa: EtapaNarradorVirtual;
  /** Lo último que ha dicho (se oye con la voz y sale escrito junto a su cuadro). */
  frase: string | null;
  /**
   * En una nominación, quién tiene la palabra: el que nomina acusa (y pasa a la
   * «Defensa»), el nominado se defiende (y pasa al «Voto») y se vota. null sin nominación.
   */
  turno: TurnoNominacion | null;
  /** Los jugadores listos para pasar a la noche (quien ya ha nominado lo está siempre). */
  listos: string[];
  /** Quienes ya se han declarado Exterminador y han disparado (una vez por partida). */
  exterminadores: string[];
}

export type TurnoNominacion = 'acusacion' | 'defensa' | 'votacion';

/** Lo que el servidor manda a cada cliente cada vez que cambia la sala. */
export interface SalaEstado {
  /** El narrador virtual, si lo hay. */
  narradorVirtual: SalaNarradorVirtual | null;
  /**
   * Quien tiene la palabra en la mesa (el narrador virtual, al nominar): los demás
   * jugadores tienen el micrófono cerrado. null: hablan todos.
   */
  palabra: string | null;
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
  /**
   * El Voudon está vivo: solo votan él y los muertos (sin gastar su voto) y basta
   * con 1 voto. Para todos (es un viajero: público).
   */
  voudon: boolean;
  /** La Institutriz está viva: los jugadores solo conversan en privado con sus vecinos. Para todos. */
  institutriz: boolean;
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
  /** El reloj del narrador (una cuenta atrás con un mensaje), o null. Para todos. */
  reloj: SalaReloj | null;
  /**
   * El señalamiento en curso (o ya congelado), o null. De día, para todos; de
   * noche, para los narradores, quien ve el grimorio y los jugadores que señalan.
   */
  senalamiento: SalaSenalamiento | null;
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
  /** El despertar guiado de cada fila del orden de noche (ver SalaHabilidadNoche). Solo para los narradores. */
  habilidadesNoche: SalaHabilidadNoche[];
  /**
   * El Imp se ha elegido a sí mismo: el narrador tiene que decir quién es el nuevo
   * (el asiento del que muere), o null. Solo para los narradores.
   */
  nuevoImp: string | null;
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

/** La respuesta a una acción ('sala:accion'). `valor`: lo que devuelve a quien la pidió (p. ej. la ruta del avatar subido). */
export type SalaResultado = { ok: true; valor?: string } | { ok: false; error: string };
