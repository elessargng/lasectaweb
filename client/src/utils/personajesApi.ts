import { useEffect, useState } from 'react';
import { parseApiResponse, urlDelServidor } from './api';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

/** Lo que la web pública necesita de un personaje del catálogo: su icono. */
interface PersonajeCatalogo {
  id: string;
  icono: string | null;
}

/** Id del catálogo: minúsculas y sin separadores («fortune-teller» → «fortuneteller»). */
export const idCatalogo = (id: string): string => id.toLowerCase().replace(/[^a-z]/g, '');

let peticion: Promise<Map<string, string>> | null = null;

/**
 * Los iconos de los personajes, por id del catálogo, ya como dirección
 * completa. El catálogo es la copia local que el servidor sincroniza con
 * Villacuervos; se pide una sola vez por visita. Si falla, el mapa sale vacío y
 * quien lo use pinta su icono de reserva.
 */
export function cargarIconosPersonajes(): Promise<Map<string, string>> {
  peticion ??= fetch(`${API_URL}/personajes`)
    .then((r) => parseApiResponse(r))
    .then((lista: PersonajeCatalogo[]) => {
      const iconos = new Map<string, string>();
      for (const p of lista) if (p.icono) iconos.set(p.id, urlDelServidor(p.icono));
      return iconos;
    })
    .catch(() => {
      peticion = null; // Se reintentará en la próxima visita a la página.
      return new Map<string, string>();
    });
  return peticion;
}

/** Hook: el mapa de iconos (vacío mientras carga o si no hay catálogo). */
export function useIconosPersonajes(): Map<string, string> {
  const [iconos, setIconos] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    let vigente = true;
    cargarIconosPersonajes().then((m) => vigente && setIconos(m));
    return () => {
      vigente = false;
    };
  }, []);
  return iconos;
}
