/**
 * Al revelar el grimorio, lo que puede haber pasado con algunos personajes en
 * juego: los que con su habilidad acaban la partida y los que conviene dejar
 * dicho al final (`terminaPartida: false`). El narrador marca lo que ha pasado y
 * se ve y se lee con el bando ganador.
 *
 * Para añadir uno: aquí (su id, el de la sala: en minúsculas y sin separadores)
 * y en el servidor (CAUSAS_FIN_PARTIDA, types/sala.ts).
 */
export const CAUSAS_FINAL: { personaje: string; texto: string; terminaPartida: boolean }[] = [
  { personaje: 'slayer', texto: 'Ha matado al demonio con su habilidad', terminaPartida: true },
  { personaje: 'mayor', texto: 'Ha ganado con tres vivos y un día sin ejecución', terminaPartida: true },
  { personaje: 'alsaahir', texto: 'Ha acertado quiénes eran los esbirros y los demonios', terminaPartida: true },
  { personaje: 'goblin', texto: 'Lo han ejecutado tras reclamarse Goblin', terminaPartida: true },
  { personaje: 'saint', texto: 'Lo ha ejecutado la plaza', terminaPartida: true },
  { personaje: 'mastermind', texto: 'Ejecutado el demonio, la partida siguió un día más', terminaPartida: true },
  { personaje: 'snakecharmer', texto: 'Ha picado al demonio', terminaPartida: false },
  { personaje: 'klutz', texto: 'Al morir, eligió a un jugador malvado', terminaPartida: true },
  { personaje: 'eviltwin', texto: 'La plaza ejecutó a la gemela buena', terminaPartida: true },
  { personaje: 'fanggu', texto: 'Ha saltado a un forastero', terminaPartida: false },
  { personaje: 'vortox', texto: 'Ha terminado la partida por un día sin ejecución', terminaPartida: true },
];
