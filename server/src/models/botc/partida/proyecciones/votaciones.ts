import type { AsientoDiario, EntradaDiario } from '../diario';
import type { RegistroVotacion } from '../tiposPartida';

/** «Bea» o, si estaba libre, «asiento 3», como lo ve el narrador en el registro. */
const nombre = (a: AsientoDiario) => a.nombre || `asiento ${a.numero}`;

/**
 * El registro de nominaciones y votaciones de una partida, en el orden en que se
 * nominó, sacado de su diario: cada nominación con su día y, si se votó, quién votó
 * (con lo que valía su voto, si no era 1) y cuántos votos tuvo. Si se reinicia la
 * votación, los votos de antes no cuentan.
 */
export function votaciones(diario: readonly EntradaDiario[]): RegistroVotacion[] {
  const registro: RegistroVotacion[] = [];
  let votantes: string[] = [];
  for (const e of diario) {
    const actual = registro[registro.length - 1];
    switch (e.tipo) {
      case 'nominacion':
        votantes = [];
        registro.push({
          hora: e.hora,
          dia: e.fase.numero,
          nomina: nombre(e.asiento),
          nominado: nombre(e.objetivo),
          ...(e.asiento.id && { nominaAsiento: e.asiento.id }),
          ...(e.objetivo.id && { nominadoAsiento: e.objetivo.id }),
          ...(e.expulsion && { expulsion: true }),
          votantes: null,
          votos: null,
        });
        break;
      case 'voto':
        votantes.push(e.valor === 1 ? nombre(e.asiento) : `${nombre(e.asiento)} (${e.valor} votos)`);
        break;
      case 'reinicioVotacion':
        votantes = [];
        break;
      case 'votacion':
        if (actual) {
          actual.votantes = votantes;
          actual.votos = e.votos;
        }
        break;
    }
  }
  return registro;
}
