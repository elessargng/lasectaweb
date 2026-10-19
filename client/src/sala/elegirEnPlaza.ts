import { createContext, useContext } from 'react';

/** Lo que pide el despertar al elegir un jugador en la plaza. */
export interface PedidoEleccion {
  /** Para qué se elige (lo que se va a enviar: «Este es el demonio»). */
  titulo: string;
  /** Los asientos ya elegidos: no se ofrecen otra vez. */
  excluidos: string[];
  /** El asiento elegido. */
  onElegido: (asientoId: string) => void;
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
