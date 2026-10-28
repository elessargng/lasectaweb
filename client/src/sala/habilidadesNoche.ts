import { describirMensaje, enumerar, nombreDeAsiento, type Envio } from './despertar';
import { textoRecordatorio } from './fichas';
import type { PersonajeMostrado } from './guiones';
import type { SalaAvisoHabilidad, SalaEnvioDespertar, SalaEstado, SalaHabilidadNoche, SalaOpcionDespertar, SalaRegistro } from './useSala';

/**
 * El despertar guiado del orden de noche (ver SalaHabilidadNoche en el contrato):
 * cómo se dice cada cosa que avisa el servidor. Los nombres de los personajes y
 * de los recordatorios, en el idioma elegido.
 */
export interface ContextoHabilidades {
  estado: SalaEstado;
  porId: Map<string, PersonajeMostrado>;
  /** La posición de un recordatorio (por su texto en el original) entre los de su personaje, o -1. */
  indiceRecordatorio: (personaje: string, texto: string) => number;
}

const COMO: Record<SalaRegistro, string> = {
  bueno: 'bueno',
  malvado: 'malvado',
  demonio: 'el demonio',
  noDemonio: 'no demonio',
};

const nombrePersonaje = (c: ContextoHabilidades, id: string | null | undefined) => (id ? (c.porId.get(id)?.nombre.texto ?? id) : '');

/** «Asiento 3 (Bea), Reclusa»: el asiento y su personaje (el de su ficha). */
const asientoConPersonaje = (c: ContextoHabilidades, asientoId: string) => {
  const personaje = c.estado.asientos.find((a) => a.id === asientoId)?.personaje;
  const nombre = nombreDeAsiento(c.estado, asientoId);
  return personaje ? `${nombre}, ${nombrePersonaje(c, personaje)}` : nombre;
};

/** Un aviso del despertar guiado, en una frase. */
export function describirAviso(c: ContextoHabilidades, aviso: SalaAvisoHabilidad): string {
  switch (aviso.tipo) {
    case 'faltaRecordatorio': {
      const personaje = c.porId.get(aviso.personaje);
      const indice = c.indiceRecordatorio(aviso.personaje, aviso.texto);
      const texto = textoRecordatorio({ id: '', personaje: aviso.personaje, indice, texto: aviso.texto }, personaje).texto;
      return `Falta el recordatorio «${texto}» de ${nombrePersonaje(c, aviso.personaje)}.`;
    }
    case 'envenenado':
      return 'Está envenenado.';
    case 'borracho':
      return 'Es el Borracho.';
    case 'muerto':
      return 'Está muerto.';
    case 'noMuere':
      return 'No muere esta noche.';
    case 'sinEfecto':
      return 'Como está droison, se le ha contestado sin poner el recordatorio.';
    case 'registro':
      return `${asientoConPersonaje(c, aviso.asiento)}, puede registrar como otra cosa.`;
    case 'protegido':
      return `${asientoConPersonaje(c, aviso.asiento)}, está protegido: no muere.`;
    case 'alcalde':
      return `Ha elegido al Alcalde (${nombreDeAsiento(c.estado, aviso.asiento)}): decide si muere o si muere otro.`;
    case 'elegido':
      return `Ha elegido a ${enumerar(aviso.asientos.map((id) => nombreDeAsiento(c.estado, id)))}.`;
  }
}

/** Una respuesta posible: lo que se manda y, si sale de cómo registra alguien, cómo («si Asiento 3 (Bea) registra como malvado»). */
export function describirOpcion(c: ContextoHabilidades, opcion: SalaOpcionDespertar): { mensaje: string; registros: string } {
  const registros = opcion.registros.map((r) => `${nombreDeAsiento(c.estado, r.asiento)} registra como ${COMO[r.como]}`);
  return {
    mensaje: describirMensaje(opcion.envio, c.estado, c.porId),
    registros: registros.length ? `Si ${enumerar(registros)}.` : '',
  };
}

/** Lo que manda el servidor, como lo que se elige al mandar algo (sin lo que no lleva). */
export const aEnvio = (e: SalaEnvioDespertar): Envio => ({
  ...(e.ficha ? { ficha: e.ficha } : {}),
  ...(e.tarjeta ? { tarjeta: e.tarjeta } : {}),
  ...(e.jugadores.length ? { jugadores: e.jugadores } : {}),
  ...(e.personajes.length ? { personajes: e.personajes } : {}),
  ...(e.texto ? { texto: e.texto } : {}),
  ...(e.alineamiento ? { alineamiento: e.alineamiento } : {}),
});

/** Lo que pone en la fila del orden de noche, según cómo está. */
export const ESTADO_HABILIDAD: Record<SalaHabilidadNoche['estado'], string> = {
  listo: 'Listo',
  falta: 'Falta algo',
  revisar: 'Para revisar',
  esperando: 'Esperando su elección',
  hecho: 'Hecho',
};
