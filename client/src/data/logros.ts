/**
 * Los logros de las estadísticas, como los trofeos de las consolas: uno por cada
 * cosa que el narrador puede marcar al revelar el grimorio (ver causasFinal.ts
 * de la sala y CAUSAS_FIN_PARTIDA del servidor), y el de platino por tenerlos
 * todos. Para añadir uno, el id es el del personaje en la sala (su nombre inglés
 * en minúsculas y sin espacios).
 */
export type NivelLogro = 'bronce' | 'plata' | 'oro' | 'platino';

export interface Logro {
  /** El personaje cuya habilidad lo da (o «platino»). */
  id: string;
  nombre: string;
  descripcion: string;
  nivel: NivelLogro;
}

export const LOGROS: Logro[] = [
  { id: 'slayer', nombre: 'Bala de plata', descripcion: 'Como Cazador, mataste al Demonio de un solo disparo.', nivel: 'oro' },
  { id: 'mayor', nombre: 'Aquí no se ahorca a nadie', descripcion: 'Como Alcalde, ganaste con tres vivos y un día sin ejecución.', nivel: 'oro' },
  { id: 'alsaahir', nombre: 'Lo vi venir', descripcion: 'Como Alsaahir, acertaste quiénes eran todos los esbirros y demonios.', nivel: 'oro' },
  { id: 'goblin', nombre: 'Soy un Goblin, ¡ejecutadme!', descripcion: 'Te reclamaste Goblin y la plaza picó: te ejecutaron.', nivel: 'plata' },
  { id: 'saint', nombre: 'Mártir de pacotilla', descripcion: 'La plaza ejecutó al Santo. Es decir, a ti.', nivel: 'bronce' },
  { id: 'mastermind', nombre: 'Segunda temporada', descripcion: 'Como Mente Maestra, ejecutaron a tu Demonio y la partida siguió un día más.', nivel: 'plata' },
  { id: 'snakecharmer', nombre: 'Cuidado, que muerde', descripcion: 'Como Encantador de Serpientes, picaste al Demonio.', nivel: 'plata' },
  { id: 'klutz', nombre: 'Manos de mantequilla', descripcion: 'Como Torpe, al morir señalaste justo a un malvado.', nivel: 'bronce' },
  { id: 'eviltwin', nombre: 'El bueno era el otro', descripcion: 'Como Gemelo Malvado, la plaza ejecutó a tu gemelo bueno.', nivel: 'oro' },
  { id: 'fanggu', nombre: 'Salto de fe', descripcion: 'Como Fang Gu, saltaste a un forastero.', nivel: 'plata' },
  { id: 'vortox', nombre: 'Silencio en la plaza', descripcion: 'Como Vortox, el pueblo pasó un día sin ejecutar a nadie y perdió.', nivel: 'oro' },
];

/** El de platino: tener todos los demás. */
export const LOGRO_PLATINO: Logro = {
  id: 'platino',
  nombre: 'Coleccionista de catástrofes',
  descripcion: 'Consigue todos los demás logros.',
  nivel: 'platino',
};
