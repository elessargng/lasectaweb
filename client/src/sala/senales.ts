import { useEffect, useState } from 'react';
import { enumerar, nombreDeAsiento } from './despertar';
import type { SalaEstado, SalaSenalamiento } from './useSala';

/**
 * Si el señalamiento ya no admite señales: congelado por el servidor o con su
 * cuenta atrás acabada (aquí se sabe sin esperar a que el servidor lo mande).
 * `desfase`: reloj del servidor menos el de aquí.
 */
export function useSenalamientoCongelado(s: SalaSenalamiento | null, desfase: number): boolean {
  // El señalamiento (su id y su fin) cuya cuenta atrás ya ha acabado aquí
  const [vencido, setVencido] = useState<string | null>(null);
  const clave = s && s.fin !== null ? `${s.id}:${s.fin}` : null;
  useEffect(() => {
    if (!s || s.congelado || s.fin === null) return;
    const falta = s.fin - (Date.now() + desfase);
    const t = window.setTimeout(() => setVencido(`${s.id}:${s.fin}`), Math.max(0, falta));
    return () => window.clearTimeout(t);
  }, [s, desfase]);
  return !!s && (s.congelado || (clave !== null && vencido === clave));
}

/** El recuento al congelarse: cada asiento señalado, con cuántos lo señalan (de más a menos). */
export function recuentoSenales(s: SalaSenalamiento): { asiento: string; veces: number }[] {
  const veces = new Map<string, number>();
  for (const hasta of Object.values(s.senales)) veces.set(hasta, (veces.get(hasta) ?? 0) + 1);
  return [...veces].map(([asiento, n]) => ({ asiento, veces: n })).sort((a, b) => b.veces - a.veces);
}

/** El resultado en una frase («Más señalado: asiento 3 (Ana), 3 veces», un empate o nadie). */
export function resultadoSenalamiento(estado: SalaEstado, s: SalaSenalamiento): string {
  const recuento = recuentoSenales(s);
  if (recuento.length === 0) return 'Nadie ha señalado.';
  if (s.tipo === 'lilmonsta' && recuento.length === 1) return `Cuida de Lil' Monsta: ${nombreDeAsiento(estado, recuento[0].asiento)}.`;
  const max = recuento[0].veces;
  const primeros = recuento.filter((r) => r.veces === max).map((r) => nombreDeAsiento(estado, r.asiento));
  const veces = max === 1 ? '1 vez' : `${max} veces`;
  return primeros.length === 1 ? `Más señalado: ${primeros[0]}, ${veces}.` : `Empate, ${veces}: ${enumerar(primeros)}.`;
}

/**
 * Lo que se dice de una ficha en el señalamiento (para el lector, con el resto de
 * lo que lleva): a quién señala y quién la señala. null si nada.
 */
export function senalDeFicha(estado: SalaEstado, s: SalaSenalamiento, asientoId: string): string | null {
  const nombre = (id: string) => nombreDeAsiento(estado, id).replace(/^A/, 'a');
  const senala = s.senales[asientoId];
  const por = Object.entries(s.senales)
    .filter(([, hasta]) => hasta === asientoId)
    .map(([desde]) => (desde === asientoId ? 'sí mismo' : nombre(desde)));
  const partes = [senala && `señala a ${senala === asientoId ? 'sí mismo' : nombre(senala)}`, por.length > 0 && `señalada por ${enumerar(por)}`];
  const texto = partes.filter(Boolean).join(', ');
  return texto || null;
}
