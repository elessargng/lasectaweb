/**
 * Los logros de las estadísticas, como los trofeos de las consolas: uno por cada
 * cosa que el narrador puede marcar al revelar el grimorio (ver causasFinal.ts
 * de la sala y CAUSAS_FIN_PARTIDA del servidor), y el de platino por tenerlos
 * todos. Para añadir uno, el id es el del personaje en la sala (su nombre inglés
 * en minúsculas y sin espacios).
 *
 * Los personajes se nombran como en la traducción de Bumblebee, como nombres
 * propios (con mayúscula), y entre asteriscos ({klutz}) para destacarlos (ver
 * TextoLogro).
 */
export type NivelLogro = 'bronce' | 'plata' | 'oro' | 'platino';

export interface Logro {
  /** El personaje cuya habilidad lo da (o «platino»). */
  id: string;
  nombre: string;
  /** Con los personajes entre llaves ({klutz}) y los tipos entre asteriscos (*Demonio*). */
  descripcion: string;
  nivel: NivelLogro;
  /** Solo cuenta si se gana la partida (como el servidor, CAUSAS_CON_VICTORIA). */
  exigeVictoria?: boolean;
}

export const LOGROS: Logro[] = [
  { id: 'slayer', nombre: 'Bala de plata', descripcion: 'Como {slayer}, mataste al *Demonio* de un solo disparo.', nivel: 'oro' },
  { id: 'mayor', nombre: 'Aquí no se ahorca a nadie', descripcion: 'Como {mayor}, ganaste con tres vivos y un día sin ejecución.', nivel: 'oro' },
  { id: 'alsaahir', nombre: 'Lo vi venir', descripcion: 'Como {alsaahir}, acertaste quiénes eran todos los *Esbirros* y *Demonios*.', nivel: 'oro' },
  { id: 'goblin', nombre: 'Soy un Goblin, ¡ejecutadme!', descripcion: 'Te reclamaste {goblin} y la plaza picó: te ejecutaron.', nivel: 'plata' },
  { id: 'saint', nombre: 'Mártir de pacotilla', descripcion: 'La plaza ejecutó al {saint}. Es decir, a ti.', nivel: 'bronce' },
  {
    id: 'mastermind',
    nombre: 'Segunda temporada',
    descripcion: 'Como {mastermind}, ejecutaron a tu *Demonio*, la partida siguió un día más y aun así ganasteis.',
    nivel: 'plata',
    exigeVictoria: true,
  },
  {
    id: 'snakecharmer',
    nombre: 'Cuidado, que muerde',
    descripcion: 'Como {snakecharmer}, picaste al *Demonio* y ganaste la partida.',
    nivel: 'plata',
    exigeVictoria: true,
  },
  { id: 'klutz', nombre: 'Manos de mantequilla', descripcion: 'Como {klutz}, al morir señalaste justo a un malvado.', nivel: 'bronce' },
  { id: 'eviltwin', nombre: 'El bueno era el otro', descripcion: 'Como {eviltwin}, la plaza ejecutó a tu gemela buena.', nivel: 'oro' },
  { id: 'fanggu', nombre: 'Salto de fe', descripcion: 'Como {fanggu}, saltaste a un *Forastero* y ganaste la partida.', nivel: 'plata', exigeVictoria: true },
  { id: 'vortox', nombre: 'Silencio en la plaza', descripcion: 'Como {vortox}, el pueblo pasó un día sin ejecutar a nadie y perdió.', nivel: 'oro' },
  { id: 'huntsman', nombre: 'Rescate en la torre', descripcion: 'Como {huntsman}, encontraste a la {damsel} y la convertiste.', nivel: 'plata' },
  { id: 'damsel', nombre: 'Damisela en apuros', descripcion: 'Como *Esbirro*, descubriste a la {damsel} y el bien perdió la partida.', nivel: 'oro' },
  { id: 'fearmonger', nombre: 'El miedo manda', descripcion: 'Como {fearmonger}, la plaza ejecutó a tu elegido y su equipo perdió.', nivel: 'oro' },
  { id: 'leviathan', nombre: 'Monstruo del abismo', descripcion: 'Como {leviathan}, el pueblo no pudo contigo: ganaste la partida.', nivel: 'plata', exigeVictoria: true },
  { id: 'cultleader', nombre: 'Todos a una', descripcion: 'Como {cultleader}, todo el bien se unió a tu culto y ganasteis.', nivel: 'oro', exigeVictoria: true },
  { id: 'puzzlemaster', nombre: 'Puzle resuelto', descripcion: 'Como {puzzlemaster}, adivinaste quién estaba borracho.', nivel: 'plata' },
  { id: 'banshee', nombre: 'El grito', descripcion: 'Como {banshee}, el *Demonio* te mató y despertaste tu habilidad.', nivel: 'bronce' },
  { id: 'amnesiac', nombre: '¡Bingo!', descripcion: 'Como {amnesiac}, acertaste cuál era tu habilidad.', nivel: 'plata' },
  {
    id: 'scarletwoman',
    nombre: 'Larga vida al Demonio',
    descripcion: 'Como {scarletwoman}, tomaste el relevo del *Demonio* y ganaste la partida.',
    nivel: 'oro',
    exigeVictoria: true,
  },
  {
    id: 'politician',
    nombre: 'Chaquetero',
    descripcion: 'Como {politician}, fuiste el mayor culpable de la derrota de tu equipo: cambiaste de bando y ganaste.',
    nivel: 'plata',
    exigeVictoria: true,
  },
];

/** El de platino: tener todos los demás. */
export const LOGRO_PLATINO: Logro = {
  id: 'platino',
  nombre: 'Coleccionista de catástrofes',
  descripcion: 'Consigue todos los demás logros.',
  nivel: 'platino',
};
