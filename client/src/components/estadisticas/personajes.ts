import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getCatalogoPersonajes,
  getIdiomaNombres,
  getNombresEnIdioma,
  IDIOMA_ORIGINAL,
  type PersonajeDelCatalogo,
  type ResumenEstadisticas,
} from '../../utils/estadisticasApi';

/** Los tipos que se juegan en una ficha, en el orden del grimorio. */
export const TIPOS: { tipo: string; titulo: string }[] = [
  { tipo: 'townsfolk', titulo: 'Aldeanos' },
  { tipo: 'outsider', titulo: 'Forasteros' },
  { tipo: 'minion', titulo: 'Esbirros' },
  { tipo: 'demon', titulo: 'Demonios' },
  { tipo: 'traveller', titulo: 'Viajeros' },
];

export type Bando = 'bueno' | 'malvado';
export const porcentaje = (parte: number, total: number) => (total > 0 ? `${Math.round((parte / total) * 100)} %` : '—');
export const nombreBando = (b: Bando | null) => (b === 'bueno' ? 'Bueno' : b === 'malvado' ? 'Malvado' : '—');
export const colorBando = (b: Bando | null) =>
  b === 'bueno' ? 'text-good-bright' : b === 'malvado' ? 'text-blood-bright' : 'text-on-surface-muted';
export const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
export const veces = (n: number) => (n === 1 ? '1 vez' : `${n} veces`);

/** Lo que se sabe de un personaje para pintarlo: su nombre (en el idioma de quien mira), su icono y su tipo. */
export interface DatosPersonajes {
  catalogo: PersonajeDelCatalogo[] | null;
  nombre: (id: string) => string;
  /** El idioma de ese nombre (para `lang`): el elegido o, si no tiene traducción, el original. */
  lang: (id: string) => string;
  icono: (id: string) => string | null | undefined;
  tipo: (id: string) => string | undefined;
}

/**
 * Los nombres e iconos de los personajes. Los nombres, en el idioma que quien
 * mira tiene elegido en la sala (Preferencias > Usuario); si no hay traducción, el
 * original. Los iconos, del resumen (los jugados) o del catálogo (se pide una
 * vez por visita).
 */
export function usePersonajes(resumen: ResumenEstadisticas | null): DatosPersonajes {
  const { token } = useAuth();
  const [catalogo, setCatalogo] = useState<PersonajeDelCatalogo[] | null>(null);
  const [traduccion, setTraduccion] = useState<{ codigo: string; nombres: Map<string, string> } | null>(null);
  useEffect(() => {
    getCatalogoPersonajes()
      .then(setCatalogo)
      .catch(() => setCatalogo([]));
  }, []);
  useEffect(() => {
    let vigente = true;
    getIdiomaNombres(token)
      .then((idioma) => (idioma.id === IDIOMA_ORIGINAL ? null : getNombresEnIdioma(idioma)))
      .then((t) => vigente && setTraduccion(t))
      .catch(() => vigente && setTraduccion(null));
    return () => {
      vigente = false;
    };
  }, [token]);
  const delCatalogo = (id: string) => catalogo?.find((p) => p.id === id);
  const traducido = (id: string) => traduccion?.nombres.get(id);
  return {
    catalogo,
    nombre: (id) => traducido(id) ?? resumen?.personajes[id]?.nombre ?? delCatalogo(id)?.nombre ?? id,
    lang: (id) => (traducido(id) ? traduccion!.codigo : IDIOMA_ORIGINAL),
    icono: (id) => resumen?.personajes[id]?.icono ?? delCatalogo(id)?.icono,
    tipo: (id) => resumen?.personajes[id]?.tipo ?? delCatalogo(id)?.tipo,
  };
}
