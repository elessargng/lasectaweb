/**
 * Las reliquias: recuerdos de momentos de La Secta que no se repetirán. No son
 * logros (no se consiguen jugando, no cuentan para el platino ni se ven
 * bloqueadas): las tiene quien estuvo allí. Cada una dice quiénes, por su nombre
 * de usuario (sin distinguir mayúsculas).
 */
export interface Reliquia {
  id: string;
  nombre: string;
  descripcion: string;
  /** Cuándo fue, en hora de España (AAAA-MM-DDTHH:MM). */
  fecha: string;
  /** Los nombres de usuario de quienes la tienen. */
  testigos: string[];
}

export const RELIQUIAS: Reliquia[] = [
  {
    id: 'tontoytu',
    nombre: '¿Tú eres tonto o eres tú?',
    descripcion: 'Presenciaste la primera partida narrada por un sintetizoide no humano… ¡por dos! Tonto y tú.',
    fecha: '2026-10-29T18:00',
    testigos: ['elessar', 'Qezzoh', 'Peach', 'Sade', 'mag1cw', 'Bostom'],
  },
];

const mismo = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0;

/** Las reliquias de un usuario (por su nombre de usuario). */
export const reliquiasDe = (username: string): Reliquia[] => RELIQUIAS.filter((r) => r.testigos.some((t) => mismo(t, username)));

/** Los demás testigos de una reliquia (sin el usuario). */
export const otrosTestigos = (reliquia: Reliquia, username: string): string[] => reliquia.testigos.filter((t) => !mismo(t, username));
