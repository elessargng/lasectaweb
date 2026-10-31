/**
 * Quién está en la sala: su papel y quién es (persona).
 * Dominio que comparten el servidor y el cliente (alias @models): solo tipos y valores puros.
 */
import type { IdNarradorVirtual } from './narradorVirtual';

/** Papel de cada participante en la sala de juego. Todo el que entra es visitante. */
export type Rol = 'narrador' | 'jugador' | 'visitante';

/** Forma de la mano que levanta un jugador (como en piedra, papel o tijera). */
/**
 * La forma de la mano: una de SALA_FORMAS_MANO o el id de un personaje del guion
 * (la mano es su icono).
 */
export type FormaMano = string;

/** Los estilos de mano (lo mismo en el cliente, ESTILOS_MANO de marcas.ts, sin «al azar»). */
export const SALA_ESTILOS_MANO = ['defecto', 'laton', 'cinco', 'guante', 'esqueleto', 'guantelete'];

/** Partidas jugadas (terminadas en la sala) por debajo de las que se es novato. */
export const SALA_PARTIDAS_NOVATO = 10;

export const SALA_FORMAS_MANO: FormaMano[] = [
  'palma', 'tijera', 'puno', 'peineta', 'paz', 'cuernos', 'lagarto', 'spock', 'senalar',
  // Emoticonos (el cliente sabe qué emoji es cada uno: formasMano.ts)
  ...['sonrisa', 'risa', 'guino', 'enamorado', 'beso', 'gafas', 'pensando', 'sospecha', 'silencio', 'susto',
    'llanto', 'enfado', 'diablo', 'angel', 'sueno', 'fiesta', 'labios', 'corazon', 'rosa', 'girasol',
    'ramo', 'pulgar-arriba', 'pulgar-abajo', 'aplausos', 'por-favor', 'palomitas', 'calavera', 'fantasma',
    'fuego', 'ojos'].map((e) => `emoji-${e}`),
];

/**
 * Quién es un participante, sea cual sea su papel en la sala: un usuario de la web
 * (entró con su cuenta), un invitado (sin cuenta) o un narrador virtual (no es una persona).
 */
export type Persona =
  | {
      tipo: 'usuario';
      /** Su id de usuario de la web (para enlazar a su perfil y para las estadísticas). */
      usuarioId: string;
      /** Ha jugado menos de SALA_PARTIDAS_NOVATO partidas (lleva el pulpito junto al nombre). */
      novato: boolean;
    }
  | { tipo: 'invitado' }
  | { tipo: 'virtual'; narrador: IdNarradorVirtual };

/** Su id de usuario de la web, si entró con su cuenta; si no, null. */
export const usuarioDe = (persona: Persona): string | null => (persona.tipo === 'usuario' ? persona.usuarioId : null);

export type EstadoAccesoGrimorio = 'ninguno' | 'solicitado' | 'concedido';
