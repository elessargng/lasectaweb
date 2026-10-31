/** Ids de personaje normalizados: minúsculas y sin separadores («Fortune_Teller» → «fortuneteller»). */
export const normalizarIdPersonaje = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, '');
