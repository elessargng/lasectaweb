/**
 * Al revelar el grimorio, lo que puede haber pasado con algunos personajes en
 * juego: los que con su habilidad acaban la partida y los que conviene dejar
 * dicho al final (`terminaPartida: false`). El narrador marca lo que ha pasado y
 * se ve y se lee con el bando ganador.
 *
 * Para añadir uno: aquí (su id, el de la sala: en minúsculas y sin separadores)
 * y en el servidor (CAUSAS_FIN_PARTIDA, server/src/contrato/sala.ts).
 */
export const CAUSAS_FINAL: {
  personaje: string;
  texto: string;
  terminaPartida: boolean;
  /** El logro es de un esbirro que elige el narrador (el que descubrió a la Doncel), no de este personaje. */
  esbirro?: boolean;
}[] = [
  { personaje: 'slayer', texto: 'Ha matado al Demonio con su habilidad', terminaPartida: true },
  { personaje: 'mayor', texto: 'Ha ganado con tres vivos y un día sin ejecución', terminaPartida: true },
  { personaje: 'alsaahir', texto: 'Ha acertado quiénes eran los Esbirros y los Demonios', terminaPartida: true },
  { personaje: 'goblin', texto: 'Lo han ejecutado tras reclamarse Goblin', terminaPartida: true },
  { personaje: 'saint', texto: 'Lo ha ejecutado la plaza', terminaPartida: true },
  { personaje: 'mastermind', texto: 'Ejecutado el Demonio, la partida siguió un día más', terminaPartida: true },
  { personaje: 'snakecharmer', texto: 'Ha picado al Demonio', terminaPartida: false },
  { personaje: 'klutz', texto: 'Al morir, eligió a un jugador malvado', terminaPartida: true },
  { personaje: 'eviltwin', texto: 'La plaza ejecutó a la gemela buena', terminaPartida: true },
  { personaje: 'fanggu', texto: 'Ha saltado a un Forastero', terminaPartida: false },
  { personaje: 'vortox', texto: 'Ha terminado la partida por un día sin ejecución', terminaPartida: true },
  { personaje: 'huntsman', texto: 'Ha encontrado a la Doncel y la ha convertido', terminaPartida: false },
  { personaje: 'damsel', texto: 'Un Esbirro la ha descubierto', terminaPartida: true, esbirro: true },
  { personaje: 'fearmonger', texto: 'La plaza ejecutó a su elegido', terminaPartida: true },
  { personaje: 'leviathan', texto: 'El mal ha ganado gracias a él', terminaPartida: true },
  { personaje: 'cultleader', texto: 'Todo el bien se unió a su culto', terminaPartida: true },
  { personaje: 'puzzlemaster', texto: 'Ha acertado quién estaba borracho', terminaPartida: false },
  { personaje: 'banshee', texto: 'La mató el Demonio y despertó su habilidad', terminaPartida: false },
  { personaje: 'amnesiac', texto: 'Ha acertado cuál era su habilidad', terminaPartida: false },
  { personaje: 'scarletwoman', texto: 'Se convirtió en el Demonio', terminaPartida: false },
  { personaje: 'politician', texto: 'Cambió de bando por su habilidad', terminaPartida: false },
];
