import { createContext, useCallback, useContext, useState } from 'react';

/**
 * Qué avisos al lector de pantalla (aria-live) quiere cada uno, por tipo
 * (Preferencias > Accesibilidad). Todos empiezan activados; con cuenta se guarda
 * en el servidor (configuracion.ts). Lo que también se ve en pantalla (errores, conexión) se sigue
 * viendo: solo deja de leerse.
 */
export type TipoAviso =
  | 'narradores'
  | 'asientos'
  | 'miAsiento'
  | 'manos'
  | 'miMano'
  | 'muertes'
  | 'calavera'
  | 'grimorio'
  | 'guion'
  | 'fase'
  | 'miPersonaje'
  | 'faroles'
  | 'npcs'
  | 'bolsa'
  | 'accesoGrimorio'
  | 'revelacion'
  | 'mensajes'
  | 'susurros'
  | 'despertar'
  | 'comunicaciones'
  | 'conversaciones'
  | 'nominaciones'
  | 'cuentaAtras'
  | 'votoAVoto'
  | 'resultadoVotacion'
  | 'mezclar'
  | 'moverJugadores'
  | 'editarAsientos'
  | 'errores'
  | 'conexion'
  | 'preferencias';

/** Los tipos, agrupados como salen en las preferencias. */
export const GRUPOS_AVISOS: { grupo: string; tipos: { tipo: TipoAviso; etiqueta: string }[] }[] = [
  {
    grupo: 'Participantes',
    tipos: [
      { tipo: 'narradores', etiqueta: 'Narradores: quién narra, entra, sale o pierde la conexión' },
      { tipo: 'accesoGrimorio', etiqueta: 'Ver el grimorio del narrador: quién lo pide y la respuesta' },
      { tipo: 'asientos', etiqueta: 'Quién se sienta o se levanta' },
      { tipo: 'miAsiento', etiqueta: 'Cambios en tu asiento (te levantan, te mueven, lo eliminan)' },
    ],
  },
  {
    grupo: 'Manos',
    tipos: [
      { tipo: 'manos', etiqueta: 'Quién levanta, baja o cambia la mano' },
      { tipo: 'miMano', etiqueta: 'Tu mano (al levantarla, bajarla o cambiar su forma)' },
    ],
  },
  {
    grupo: 'Partida',
    tipos: [
      { tipo: 'muertes', etiqueta: 'Muertes, resurrecciones y el voto de los muertos' },
      { tipo: 'calavera', etiqueta: 'Calavera: a quién se le pone o se le quita' },
      { tipo: 'grimorio', etiqueta: 'Grimorio para los jugadores (activado o desactivado)' },
      { tipo: 'guion', etiqueta: 'Cambio de guion' },
      { tipo: 'fase', etiqueta: 'Noche y día (y al limpiar el grimorio)' },
      { tipo: 'miPersonaje', etiqueta: 'Tu personaje y tu alineamiento, cuando te los cambia el narrador' },
      { tipo: 'faroles', etiqueta: 'Faroles: al cambiarlos o copiarlos' },
      { tipo: 'npcs', etiqueta: 'NPCs: legendarios y lóricos que el narrador pone o quita' },
      { tipo: 'revelacion', etiqueta: 'Revelar el grimorio: cada ficha que se revela y el bando ganador' },
    ],
  },
  {
    grupo: 'Nominaciones y votaciones',
    tipos: [
      { tipo: 'nominaciones', etiqueta: 'Nominaciones: quién nomina a quién, cancelada o cerrada' },
      { tipo: 'cuentaAtras', etiqueta: 'Cuenta atrás: cuando empieza y cuando acaba' },
      { tipo: 'votoAVoto', etiqueta: 'Votación, ficha a ficha: el nombre y los votos' },
      { tipo: 'resultadoVotacion', etiqueta: 'Votación: cuando empieza y su resultado' },
    ],
  },
  {
    grupo: 'Mensajes y comunicaciones',
    tipos: [
      { tipo: 'conversaciones', etiqueta: 'Conversaciones privadas: las tuyas (quién entra y sale) y quién conversa con quién' },
      { tipo: 'comunicaciones', etiqueta: 'Tu micrófono y tu cámara, al cambiarlos con su tecla' },
      { tipo: 'mensajes', etiqueta: 'Mensajes que te llegan (con quién y qué dicen)' },
      {
        tipo: 'susurros',
        etiqueta: 'Susurros: quién escribe en privado a quién en la mesa (a los narradores, también lo que dice)',
      },
      { tipo: 'despertar', etiqueta: 'De noche: lo que te muestra el narrador al despertarte, o lo que te contesta el jugador despierto' },
    ],
  },
  {
    grupo: 'Acciones del narrador',
    tipos: [
      { tipo: 'mezclar', etiqueta: 'Mezclar jugadores' },
      { tipo: 'bolsa', etiqueta: 'Bolsa de personajes: setup modificado y personajes repartidos' },
      { tipo: 'moverJugadores', etiqueta: 'Mover a un jugador de asiento (instrucciones y pasos)' },
      { tipo: 'editarAsientos', etiqueta: 'Número de asientos al añadir o eliminar' },
    ],
  },
  {
    grupo: 'Sistema',
    tipos: [
      { tipo: 'errores', etiqueta: 'Errores (siguen viéndose en pantalla)' },
      { tipo: 'conexion', etiqueta: 'Estado de la conexión (sigue viéndose en pantalla)' },
      { tipo: 'preferencias', etiqueta: 'Confirmaciones en las preferencias («Guardado», atajo cambiado)' },
    ],
  },
];

export type AvisosActivos = Record<TipoAviso, boolean>;

const TODOS = GRUPOS_AVISOS.flatMap((g) => g.tipos.map((t) => t.tipo));
const todos = (valor: boolean) => Object.fromEntries(TODOS.map((t) => [t, valor])) as AvisosActivos;

/** Lo que guardaba antes la sala en el navegador (para llevarlo a la cuenta la primera vez). */
export const KEY_ANTIGUA = 'sala:avisos';

/** Avisos válidos a partir de lo que sea (guardado, de un perfil…): lo que falte o no valga, activado. */
export function normalizarAvisos(datos: unknown): AvisosActivos {
  const activos = todos(true);
  const guardados = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
  for (const t of TODOS) {
    const valor = guardados[t];
    if (typeof valor === 'boolean') activos[t] = valor;
  }
  return activos;
}

export function useAvisosActivos() {
  const [activos, setActivos] = useState(() => todos(true));

  const cambiar = useCallback((tipo: TipoAviso, activo: boolean) => {
    setActivos((prev) => ({ ...prev, [tipo]: activo }));
  }, []);
  const cambiarTodos = useCallback((activo: boolean) => setActivos(todos(activo)), []);
  /** Pone los de una configuración guardada. */
  const reemplazar = useCallback((datos: unknown) => setActivos(normalizarAvisos(datos)), []);

  return { activos, cambiar, cambiarTodos, reemplazar };
}

/** Para que cualquier componente sepa si un tipo de aviso está activo (por defecto, sí). */
export const AvisosContexto = createContext<AvisosActivos>(todos(true));

/** El valor de aria-live para una región de avisos de ese tipo: «polite» si está activo, «off» si no. */
export function useAriaLive(tipo: TipoAviso): 'polite' | 'off' {
  return useContext(AvisosContexto)[tipo] ? 'polite' : 'off';
}
