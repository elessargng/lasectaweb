import type { SalaAsiento } from '../../../contrato/sala';
import { banshee } from './banshee';
import { burocrata } from './burocrata';
import { canibal, carnicero, enterrador, leviatan } from './ejecuciones';
import { virgen } from './virgen';
import { institutriz } from './institutriz';
import { ladron } from './ladron';
import { organGrinder } from './organGrinder';
import type { ContextoReglas, RegistroAlNominar, ReglaPersonaje } from './ReglaPersonaje';
import { revolucionario } from './revolucionario';
import { voudon } from './voudon';

/**
 * Las reglas de los personajes, en el orden en que se consultan: el Voudon antes
 * que la Banshee (con él vivo, decide él quién vota) y las de las ejecuciones en
 * el orden en que se ponen sus recordatorios.
 */
export const REGLAS: readonly ReglaPersonaje[] = [
  voudon,
  banshee,
  burocrata,
  ladron,
  organGrinder,
  institutriz,
  virgen,
  canibal,
  enterrador,
  leviatan,
  carnicero,
  revolucionario,
];

/** Un recordatorio que hay que poner al ejecutar (o al nominar): de qué personaje y con qué texto. */
export interface RecordatorioAlEjecutar {
  personaje: string;
  texto: string;
  unico: boolean;
}

/**
 * Lo que dicen las reglas de los personajes sobre la partida tal como está. La
 * sala le pregunta y ella consulta a cada regla; no sabe de ningún personaje.
 */
export class Reglas {
  constructor(
    private readonly ctx: ContextoReglas,
    private readonly reglas: readonly ReglaPersonaje[] = REGLAS,
  ) {}

  /**
   * Si quien se sienta en el asiento puede votar: lo que diga la primera regla que
   * decida o, si no, que no sea un muerto que ya ha gastado su voto.
   */
  puedeVotar(asiento: SalaAsiento): boolean {
    for (const r of this.reglas) {
      const decide = r.puedeVotar?.(this.ctx, asiento);
      if (decide !== undefined) return decide;
    }
    return !(asiento.muerto && asiento.votoGastado);
  }

  /** Un muerto que vota desde este asiento no gasta su voto. */
  votaSinGastar(asiento: SalaAsiento): boolean {
    return this.reglas.some((r) => r.votaSinGastar?.(this.ctx, asiento));
  }

  votaDoble(asiento: SalaAsiento): boolean {
    return this.reglas.some((r) => r.votaDoble?.(this.ctx, asiento));
  }

  /** Lo que vale el voto de quien se sienta en el asiento: 1 por lo que lo multiplique cada regla. */
  valorDelVoto(asiento: SalaAsiento, dosManos: boolean): number {
    return this.reglas.reduce((valor, r) => valor * (r.multiplicaVoto?.(this.ctx, asiento, dosManos) ?? 1), 1);
  }

  /** Los votos que hacen falta para la calavera con tantas fichas vivas: los de una regla o la mitad, hacia arriba. */
  mayoria(vivos: number): number {
    for (const r of this.reglas) {
      const votos = r.mayoria?.(this.ctx);
      if (votos !== undefined) return votos;
    }
    return Math.ceil(vivos / 2);
  }

  votacionSecreta(): boolean {
    return this.reglas.some((r) => r.votacionSecreta?.(this.ctx));
  }

  soloVecinos(): boolean {
    return this.reglas.some((r) => r.soloVecinos?.(this.ctx));
  }

  /**
   * Al nominar: los recordatorios que se ponen solos en la ficha del nominado, en
   * orden, y si el nominador se ejecuta al momento; o, si alguna regla necesita
   * saber cómo registra el nominador, la pregunta (ver ReglaPersonaje.alNominar).
   */
  alNominar(
    nominador: SalaAsiento,
    nominado: SalaAsiento,
    registro: RegistroAlNominar = {},
  ): { recordatorios: RecordatorioAlEjecutar[]; ejecutaAlNominador: boolean } | { pregunta: 'comoAldeano' } {
    const respuestas = this.reglas.flatMap((r) => {
      const respuesta = r.alNominar?.(this.ctx, nominador, nominado, registro);
      return respuesta ? [{ personaje: r.personaje, respuesta }] : [];
    });
    const efectos = [];
    for (const { personaje, respuesta } of respuestas) {
      if ('pregunta' in respuesta) return respuesta;
      efectos.push({ personaje, ...respuesta });
    }
    return {
      recordatorios: efectos.flatMap((e) => (e.recordatorio ? [{ personaje: e.personaje, ...e.recordatorio }] : [])),
      ejecutaAlNominador: efectos.some((e) => e.ejecutaAlNominador),
    };
  }

  /** Los recordatorios que se ponen solos en la ficha del ejecutado, en orden. */
  recordatoriosAlEjecutar(ejecutado: SalaAsiento): RecordatorioAlEjecutar[] {
    return this.reglas.flatMap((r) => {
      const recordatorio = r.alEjecutar?.(this.ctx, ejecutado);
      return recordatorio ? [{ personaje: r.personaje, ...recordatorio }] : [];
    });
  }

  /** Tras ejecutar, anochece (salvo que una regla lo impida). */
  anocheceTrasEjecutar(): boolean {
    return !this.reglas.some((r) => r.impideAnochecer?.(this.ctx));
  }

  /** Los personajes barajados, en el orden en que se reparten (ver ReglaPersonaje.repartir). */
  repartir(asientos: SalaAsiento[], personajes: string[]): string[] {
    return this.reglas.reduce((lista, r) => r.repartir?.(this.ctx, asientos, lista) ?? lista, personajes);
  }
}
