import { createContext, useContext } from 'react';

/** Lo que pide el despertar al elegir un jugador en la plaza. */
export interface PedidoEleccion {
  /** Para qué se elige (lo que se va a enviar: «Este es el demonio»). */
  titulo: string;
  /** Los asientos que no se pueden elegir. */
  excluidos: string[];
  /** Los ya elegidos: se ven marcados y, pulsándolos, se quitan (`onQuitado`). */
  elegidos?: string[];
  /** Cuántos se eligen seguidos en la plaza antes de volver (1 si no se dice). */
  cuantos?: number;
  /** Lo que se dice al empezar en lugar de «Elige en la plaza un jugador para…» (el despertar guiado: «Elige 2 jugadores»). */
  aviso?: string;
  /** Cada asiento elegido. */
  onElegido: (asientoId: string) => void;
  onQuitado?: (asientoId: string) => void;
  /** id de lo que recibe el foco al volver (si no, lo que lo tenía al empezar). */
  volver?: string;
}

/**
 * Cómo se eligen los jugadores en el despertar de noche (Preferencias >
 * Accesibilidad): en la plaza (la ventana se esconde, se pulsa la ficha y vuelve
 * con el elegido), con esta función; o en una lista dentro de la ventana, si es null.
 */
export const ElegirEnPlazaContexto = createContext<((pedido: PedidoEleccion) => void) | null>(null);

export const useElegirEnPlaza = () => useContext(ElegirEnPlazaContexto);
