/** Lo que cambia de un personaje en otro idioma (lo que no se traduce, se queda en el original). */
export interface TraduccionPersonaje {
  personajeId: string;
  nombre: string | null;
  habilidad: string | null;
  recordatorios: string | null;
  recordatoriosGlobales: string | null;
  recordatorioPrimeraNoche: string | null;
  recordatorioOtrasNoches: string | null;
}
