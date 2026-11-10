/**
 * Lo que el narrador virtual necesita de fuera, como interfaces (se le inyectan):
 * así no sabe de sockets ni de relojes, y en los tests se le dan unos falsos.
 */

import type { Alineamiento } from '../compartido/jugador';
import type { BorradorDespertar } from '../partida/mensajeDespertar';
import type { CambiosAjustes } from '../partida/Configuracion';
import type { CambioAsientos } from '../sala/Sala';

/**
 * El narrador virtual en la plaza: hace lo que haría un narrador, por los mismos
 * casos de uso de la sala (y con los mismos permisos), y la sala se difunde a todos.
 */
export interface Narrador {
  /** Cambia los asientos (añadir, quitar, mover a alguien…). */
  asientos(cambio: CambioAsientos): Promise<RespuestaAccion>;
  /** Responde a quien pide ver el grimorio. */
  accesoGrimorio(participanteId: string, conceder: boolean): Promise<RespuestaAccion>;
  /** Llena la bolsa con estos personajes (los que ha elegido). */
  llenarBolsa(personajes: string[]): Promise<RespuestaAccion>;
  /** Suena el gong. */
  sonarGong(): Promise<RespuestaAccion>;
  /** Pone el reloj: una cuenta atrás para todos con su mensaje. */
  ponerReloj(segundos: number, mensaje: string): Promise<RespuestaAccion>;
  /** Acaba el reloj ya: suena el gong, como si se hubiera agotado. */
  terminarReloj(): Promise<RespuestaAccion>;
  /** Revela el grimorio: ha ganado ese bando. */
  revelarGrimorio(ganador: Alineamiento): Promise<RespuestaAccion>;
  /** Revela la ficha de un asiento, para todos. */
  revelarFicha(jugadorId: string): Promise<RespuestaAccion>;
  /** Pide que se señale (listas vacías: todos; segundos null: sin cuenta atrás). */
  empezarSenalamiento(peticion: {
    mensaje: string;
    segundos: number | null;
    senaladores: readonly string[];
    objetivos: readonly string[];
  }): Promise<RespuestaAccion>;
  /** Quita el señalamiento. */
  terminarSenalamiento(): Promise<RespuestaAccion>;
  /** Pone un personaje en una casilla de los faroles del demonio. */
  prepararFarol(posicion: number, personajeId: string | null): Promise<RespuestaAccion>;
  /** Anochece. */
  irANoche(): Promise<RespuestaAccion>;
  /** Amanece. */
  amanecer(): Promise<RespuestaAccion>;
  /** Limpia el grimorio: vuelve a la preparación, como al principio. */
  limpiarGrimorio(): Promise<RespuestaAccion>;
  /** Abre el despertar de un asiento. */
  despertar(jugadorId: string): Promise<RespuestaAccion>;
  /** Manda un mensaje al despertar de un asiento (ver Partida.enviarAlDespertar). */
  enviarDespertar(jugadorId: string, mensaje: BorradorDespertar): Promise<RespuestaAccion>;
  /** El despertar guiado de una fila del orden de noche, si está listo. */
  despertarHabilidad(personajeId: string): Promise<RespuestaAccion>;
  /** El despertar guiado, revisado: lo que se manda al de esa fila. */
  resolverHabilidad(personajeId: string, mensaje: BorradorDespertar): Promise<RespuestaAccion>;
  /** El Imp se ha elegido a sí mismo: el nuevo es el de ese asiento. */
  nuevoImp(jugadorId: string): Promise<RespuestaAccion>;
  /** Da la palabra a un participante (null: a todos). */
  darPalabra(participanteId: string | null): Promise<RespuestaAccion>;
  /** Nomina (contesta «comoAldeano», «ejecutado» o «final»: ver DiaService.nominar). */
  nominar(desde: string, hasta: string, comoAldeano?: boolean): Promise<RespuestaAccion>;
  /** Arranca la cuenta atrás de la nominación abierta. */
  cuentaAtras(): Promise<RespuestaAccion>;
  /** Pone o quita la calavera a un asiento (y cierra la nominación). */
  marcar(jugadorId: string, marcado: boolean): Promise<RespuestaAccion>;
  /** Quita la calavera a quien la lleve (y cierra la nominación). */
  desmarcar(): Promise<RespuestaAccion>;
  cerrarNominacion(): Promise<RespuestaAccion>;
  /** Ejecuta a quien lleva la calavera. */
  ejecutar(jugadorId: string): Promise<RespuestaAccion>;
  /** Carga uno de los guiones por defecto. */
  cambiarGuion(predeterminado: string): Promise<RespuestaAccion>;
  /** Cambia los ajustes de la partida. */
  configurar(cambios: CambiosAjustes): Promise<RespuestaAccion>;
  /** Abre o cierra las conversaciones privadas. */
  privados(abiertos: boolean): Promise<RespuestaAccion>;
  /** Reparte al azar los personajes de la bolsa entre los asientos. */
  asignarPersonajes(): Promise<RespuestaAccion>;
  /** Pone un personaje en la ficha de un asiento. */
  cambiarPersonaje(jugadorId: string, personajeId: string | null): Promise<RespuestaAccion>;
  /** Mata o revive la ficha de un asiento. */
  cambiarVida(jugadorId: string, muerto: boolean): Promise<RespuestaAccion>;
  /** Anuncia la muerte pendiente de un asiento. */
  confirmarMuerte(jugadorId: string): Promise<RespuestaAccion>;
  /** Pone junto a una ficha uno de los recordatorios de un personaje. */
  ponerRecordatorio(jugadorId: string, personajeId: string, indice: number): Promise<RespuestaAccion>;
  quitarRecordatorio(jugadorId: string, recordatorioId: string): Promise<RespuestaAccion>;
}

/** Lo que contesta la sala a una acción: hecha (con lo que devuelva) o no, y por qué. */
export type RespuestaAccion = { ok: true; valor?: string } | { ok: false; error: string };

/** Programa algo para dentro de un rato; devuelve cómo cancelarlo. */
export interface Temporizador {
  programar(ms: number, hacer: () => void): () => void;
}

/** Lo que dice el narrador virtual, para que lo oigan todos (la voz del navegador). */
export interface Voz {
  decir(texto: string): void;
}

/** El azar (ver models/partida/azar). */
export type { Azar } from '../partida/azar';

/**
 * El modelo de IA con el que decide Jarvis, sea cual sea (en los tests, uno falso):
 * con lo que pasa en la partida (`contexto`) y cómo decidirlo, elige. Falla con un
 * error si no contesta.
 */
export interface ModeloNarrador {
  /** Una de las opciones (clave → descripción): la clave que elige. */
  elegir(contexto: unknown, instrucciones: string, opciones: Record<string, string>): Promise<string>;
  /** La probabilidad de «sí» (de 0 a 1), sabiendo lo que significa cada respuesta. */
  siONo(contexto: unknown, instrucciones: string, si: string, no: string): Promise<number>;
}

/** Para Jarvis: el modelo de quien lo añade, ya comprobado; o por qué no se puede. */
export interface ModelosNarrador {
  modeloDe(participanteId: string): Promise<ModeloNarrador | string>;
}

/**
 * Las bolsas que ha montado el narrador virtual en las últimas partidas de quien
 * lo añade (por su cuenta), para no repetirlas.
 */
export interface BolsasRecientes {
  /** Las últimas, la más reciente primero (cada una, sus personajes). */
  de(participanteId: string): Promise<string[][]>;
  apuntar(participanteId: string, personajes: string[]): Promise<void>;
}

/** El temporizador de verdad. */
export const temporizadorReal: Temporizador = {
  programar: (ms, hacer) => {
    const t = setTimeout(hacer, ms);
    return () => clearTimeout(t);
  },
};
