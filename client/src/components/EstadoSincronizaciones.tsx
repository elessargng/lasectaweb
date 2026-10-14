import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { parseApiResponse } from '../utils/api';

/** Cómo fue la última sincronización de algo con Villacuervos (lo da el servidor). */
interface EstadoSincronizacion {
  id: string;
  nombre: string;
  ultimoIntento: string | null;
  ultimoExito: string | null;
  error: string | null;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

/**
 * Para la administración, en la gestión: cómo van las sincronizaciones con
 * Villacuervos (personajes y traducciones). Si alguna ha fallado, lo dice en
 * rojo con el motivo y la fecha de la última correcta (la web sigue con esa copia).
 */
const EstadoSincronizaciones = ({ token }: { token: string }) => {
  const [estados, setEstados] = useState<EstadoSincronizacion[] | null>(null);
  const [errorConsulta, setErrorConsulta] = useState(false);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
    let vigente = true;
    fetch(`${apiUrl}/admin/sincronizaciones`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => parseApiResponse(r))
      .then((datos: EstadoSincronizacion[]) => vigente && setEstados(datos))
      .catch(() => vigente && setErrorConsulta(true));
    return () => {
      vigente = false;
    };
  }, [token]);

  if (!estados && !errorConsulta) return null;
  const fallidas = (estados ?? []).filter((e) => e.error);

  return (
    <section aria-labelledby="gestion-sincronizacion" className="mb-10">
      <h2 id="gestion-sincronizacion" className="text-2xl font-display font-medium text-white mb-4 border-b border-outline-ghost pb-4">
        Sincronización con Villacuervos
      </h2>

      {errorConsulta && (
        <p className="text-sm text-on-surface-muted font-body">No se ha podido consultar el estado de la sincronización.</p>
      )}

      {fallidas.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded mb-4 text-sm font-body flex gap-3">
          <AlertTriangle size={20} className="shrink-0" />
          <ul className="flex flex-col gap-2">
            {fallidas.map((e) => (
              <li key={e.id}>
                <strong>Ha fallado la sincronización de {e.nombre.toLocaleLowerCase('es')}</strong>
                {e.ultimoIntento && ` el ${fecha(e.ultimoIntento)}`}: {e.error}.{' '}
                {e.ultimoExito
                  ? `La web sigue con la última copia correcta, del ${fecha(e.ultimoExito)}.`
                  : 'No hay ninguna sincronización correcta todavía.'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estados && (
        <ul className="flex flex-col gap-1 text-sm text-on-surface-muted font-body">
          {estados
            .filter((e) => !e.error)
            .map((e) => (
              <li key={e.id}>
                {e.nombre}:{' '}
                {e.ultimoExito ? `última sincronización correcta el ${fecha(e.ultimoExito)}.` : 'aún no se ha sincronizado.'}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
};

export default EstadoSincronizaciones;
