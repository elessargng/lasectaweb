import {
  CircleCheck,
  CircleX,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  MessageCircleMore,
  Square,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react';
import { IconoCalavera, IconoEspadas, IconoGente, IconoHuella, IconoLuna, IconoMascaras, IconoOjo, IconoPalma, type IconoSala, IconoSinVer } from './IconosJuego';
import type { PersonajeMostrado } from './guiones';
import { datosAsiento, describirAsiento } from './nombresAsiento';
import type { MensajeDespertar, SalaAlineamiento, SalaDespertar, SalaEstado } from './useSala';

export const NOMBRE_BANDO: Record<SalaAlineamiento, string> = { bueno: 'Bueno', malvado: 'Malvado' };

/**
 * Lo que se puede mandar al despertar a alguien de noche. Es el mismo catálogo
 * que el del servidor (server/src/types/sala.ts): las fichas las usan el
 * narrador y el jugador despierto; las tarjetas, solo el narrador.
 */

/** Lo que lleva una ficha o tarjeta además de sí misma (se elige antes de mandarla). */
export interface AdjuntoDespertar {
  jugadores?: boolean;
  personajes?: boolean;
  texto?: boolean;
  /** Un alineamiento (bueno o malvado), opcional. */
  alineamiento?: boolean;
}

export interface FichaDespertar {
  id: string;
  etiqueta: string;
  Icono: IconoSala;
  adjunto?: AdjuntoDespertar;
}

export const FICHAS_DESPERTAR: FichaDespertar[] = [
  { id: 'entendido', etiqueta: 'Entendido', Icono: ThumbsUp },
  { id: 'si', etiqueta: 'Sí', Icono: CircleCheck },
  { id: 'no', etiqueta: 'No', Icono: CircleX },
  { id: 'bueno', etiqueta: 'Bueno', Icono: ThumbsUp },
  { id: 'malvado', etiqueta: 'Malvado', Icono: ThumbsDown },
  { id: 'cero', etiqueta: 'Cero', Icono: Square },
  { id: 'uno', etiqueta: 'Uno', Icono: Dice1 },
  { id: 'dos', etiqueta: 'Dos', Icono: Dice2 },
  { id: 'tres', etiqueta: 'Tres', Icono: Dice3 },
  { id: 'cuatro', etiqueta: 'Cuatro', Icono: Dice4 },
  { id: 'cinco', etiqueta: 'Cinco', Icono: Dice5 },
  { id: 'jugador', etiqueta: 'Jugador', Icono: User, adjunto: { jugadores: true } },
  { id: 'personaje', etiqueta: 'Personaje', Icono: IconoMascaras, adjunto: { personajes: true } },
  { id: 'personalizado', etiqueta: 'Personalizado', Icono: MessageCircleMore, adjunto: { texto: true } },
];

export interface TarjetaDespertar {
  id: string;
  texto: string;
  Icono: IconoSala;
  /** Fondo de la tarjeta (tokens de index.css). */
  fondo: string;
  adjunto?: AdjuntoDespertar;
}

export const TARJETAS_DESPERTAR: TarjetaDespertar[] = [
  { id: 'habilidad', texto: '¿Quieres usar tu habilidad?', Icono: IconoLuna, fondo: 'from-gold-deep to-blood-deep' },
  { id: 'eleccion', texto: 'Haz una elección', Icono: IconoEspadas, fondo: 'from-gold-deep to-blood-deep' },
  { id: 'noEnJuego', texto: 'Estos personajes no están en juego', Icono: IconoSinVer, fondo: 'from-good to-midnight', adjunto: { personajes: true } },
  { id: 'demonio', texto: 'Este es el demonio', Icono: IconoCalavera, fondo: 'from-blood to-blood-deep', adjunto: { jugadores: true } },
  { id: 'esbirros', texto: 'Estos son tus esbirros', Icono: IconoGente, fondo: 'from-blood to-blood-deep', adjunto: { jugadores: true } },
  { id: 'tuEres', texto: 'Tú eres', Icono: IconoHuella, fondo: 'from-arcano to-arcano-deep', adjunto: { personajes: true, alineamiento: true } },
  { id: 'esteJugadorEs', texto: 'Este jugador es', Icono: IconoOjo, fondo: 'from-arcano to-arcano-deep', adjunto: { jugadores: true, personajes: true } },
  { id: 'teHaElegido', texto: 'Este personaje te ha elegido', Icono: IconoPalma, fondo: 'from-savia to-savia-deep', adjunto: { personajes: true } },
];

export const fichaDespertar = (id: string | null) => FICHAS_DESPERTAR.find((f) => f.id === id);
export const tarjetaDespertar = (id: string | null) => TARJETAS_DESPERTAR.find((t) => t.id === id);

/** Lo que se elige antes de mandar una ficha o tarjeta con adjunto. */
export interface Envio {
  ficha?: string;
  tarjeta?: string;
  jugadores?: string[];
  personajes?: string[];
  texto?: string;
  alineamiento?: SalaAlineamiento | null;
}

/** «asiento 3 (Bea)» con mayúscula: así empieza una frase o una línea. */
export const nombreDeAsiento = (estado: SalaEstado, asientoId: string) => {
  const { numero, ocupante } = datosAsiento(estado, asientoId);
  const texto = numero > 0 ? describirAsiento(numero, ocupante) : 'un asiento que ya no está';
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
};

/** «Ana», «Ana y Luis», «Ana, Luis y Bea». */
export const enumerar = (nombres: string[]) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;

/**
 * Un mensaje en una frase, para el lector: «Este jugador es: Asiento 3 (Bea);
 * Imp». (Los nombres en inglés no llevan su idioma aquí: es texto de un aviso.)
 */
export function describirMensaje(
  m: MensajeDespertar,
  estado: SalaEstado,
  personajes: Map<string, PersonajeMostrado>,
): string {
  const titulo = tarjetaDespertar(m.tarjeta)?.texto ?? fichaDespertar(m.ficha)?.etiqueta ?? '';
  const partes = [
    m.jugadores.length ? enumerar(m.jugadores.map((id) => nombreDeAsiento(estado, id))) : '',
    m.personajes.length ? enumerar(m.personajes.map((id) => personajes.get(id)?.nombre.texto ?? id)) : '',
    m.alineamiento ? NOMBRE_BANDO[m.alineamiento] : '',
    m.texto ?? '',
  ].filter(Boolean);
  // «Personalizado»: solo su texto
  if (m.ficha === 'personalizado') return m.texto ?? '';
  return partes.length ? `${titulo}: ${partes.join('; ')}` : titulo;
}

/** Quién manda un mensaje: «Narrador», «Tú» o el asiento del jugador. */
export const autorDe = (m: MensajeDespertar, estado: SalaEstado) =>
  m.autor === 'narrador'
    ? 'Narrador'
    : estado.asientos.find((a) => a.id === m.autor)?.ocupante === estado.yo
      ? 'Tú'
      : nombreDeAsiento(estado, m.autor);

/**
 * Lo último del despertar es un «Entendido» (del jugador o del narrador): ya está
 * hablado. En la mesa, la luna de su ficha es un pulgar arriba.
 */
export const esEntendido = (d: SalaDespertar) => d.mensajes[d.mensajes.length - 1]?.ficha === 'entendido';
