import { banshee } from './banshee';
import { burocrata } from './burocrata';
import { canibal } from './canibal';
import { carnicero } from './carnicero';
import { enterrador } from './enterrador';
import { espia } from './espia';
import { leviatan } from './leviatan';
import { virgen } from './virgen';
import { institutriz } from './institutriz';
import { ladron } from './ladron';
import { organGrinder } from './organGrinder';
import { reclusa } from './reclusa';
import {
  droison,
  type ContextoReglas,
  type FinDePartida,
  type Herencia,
  type PasaASerDemonio,
  type RegistroAlNominar,
  type ReglaPersonaje,
} from './ReglaPersonaje';
import type { Alineamiento } from '../compartido/jugador';
import { santo } from './santo';
import { mujerEscarlata } from './mujerEscarlata';
import { revolucionario } from './revolucionario';
import { voudon } from './voudon';
import type { Jugador } from '../partida/Jugador';
import { percepcionReal, type Percepcion } from './Percepcion';
import { objetivoReal, type Objetivo } from './Objetivo';
import { alcalde } from './alcalde';
import { bufon } from './bufon';
import { marinero } from './marinero';
import { monje } from './monje';
import { soldado } from './soldado';

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
  // Cómo registran
  reclusa,
  espia,
  // El final: el Santo antes que el Alcalde (ejecutado el Santo, gana el mal)
  santo,
  mujerEscarlata,
  // A quién le llega: se consulta de la última a la primera. Quien protege, antes
  // que quien se salva gastando su habilidad (protegido, el Bufón no la gasta) y que
  // quien desvía (protegido, no rebota)
  alcalde,
  bufon,
  marinero,
  soldado,
  monje,
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
  puedeVotar(jugador: Jugador): boolean {
    for (const r of this.reglas) {
      const decide = r.puedeVotar?.(this.ctx, jugador);
      if (decide !== undefined) return decide;
    }
    return !(jugador.muerto && jugador.votoGastado);
  }

  /** Un muerto que vota desde este asiento no gasta su voto. */
  votaSinGastar(jugador: Jugador): boolean {
    return this.reglas.some((r) => r.votaSinGastar?.(this.ctx, jugador));
  }

  votaDoble(jugador: Jugador): boolean {
    return this.reglas.some((r) => r.votaDoble?.(this.ctx, jugador));
  }

  /** Lo que vale el voto de quien se sienta en el asiento: 1 por lo que lo multiplique cada regla. */
  valorDelVoto(jugador: Jugador, dosManos: boolean): number {
    return this.reglas.reduce((valor, r) => valor * (r.multiplicaVoto?.(this.ctx, jugador, dosManos) ?? 1), 1);
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
    nominador: Jugador,
    nominado: Jugador,
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
  recordatoriosAlEjecutar(ejecutado: Jugador): RecordatorioAlEjecutar[] {
    return this.reglas.flatMap((r) => {
      const recordatorio = r.alEjecutar?.(this.ctx, ejecutado);
      return recordatorio ? [{ personaje: r.personaje, ...recordatorio }] : [];
    });
  }

  /** Tras ejecutar, anochece (salvo que una regla lo impida). */
  anocheceTrasEjecutar(): boolean {
    return !this.reglas.some((r) => r.impideAnochecer?.(this.ctx));
  }

  /**
   * Cómo registra un jugador: lo de verdad o, si su personaje puede registrar como
   * otra cosa y está sano, lo que diga su regla. Droison, como cualquiera.
   */
  percepcion(jugador: Jugador): Percepcion {
    const base = percepcionReal(this.ctx, jugador);
    if (droison(this.ctx, jugador)) return base;
    const id = this.ctx.identidad(jugador);
    return this.reglas.reduce((p, r) => (r.personaje === id && r.alterarPercepcion ? r.alterarPercepcion(this.ctx, p) : p), base);
  }

  /** A quién le llega lo que le hacen a un jugador: a él, con lo que cambie cada regla. */
  objetivo(jugador: Jugador): Objetivo {
    return this.reglas.reduce((o, r) => r.alterarObjetivo?.(this.ctx, jugador, o) ?? o, objetivoReal(jugador));
  }

  /** Si la partida acaba por un personaje: quién gana (lo que diga la primera regla), o undefined. */
  ganador(fin: FinDePartida): Alineamiento | undefined {
    for (const r of this.reglas) {
      const ganador = r.ganador?.(this.ctx, fin);
      if (ganador) return ganador;
    }
    return undefined;
  }

  /** Es un demonio: lo es de verdad o cuenta como tal por una regla (la Mujer Escarlata que lo ha heredado). */
  esDemonio(jugador: Jugador): boolean {
    const id = this.ctx.identidad(jugador);
    return (id ? this.ctx.personaje(id)?.tipo === 'demon' : false) || this.reglas.some((r) => r.esDemonio?.(this.ctx, jugador));
  }

  /** Muerto el demonio, quién lo hereda de los `vivos`, o null. */
  heredarDemonio(vivos: readonly Jugador[]): Herencia | null {
    for (const r of this.reglas) {
      const herencia = r.heredarDemonio?.(this.ctx, vivos);
      if (herencia) return herencia;
    }
    return null;
  }

  /** Quien ha heredado el demonio, a qué pasa a ser, o null. */
  pasaASerDemonio(jugador: Jugador): PasaASerDemonio | null {
    for (const r of this.reglas) {
      const pasa = r.pasaASerDemonio?.(this.ctx, jugador);
      if (pasa) return pasa;
    }
    return null;
  }

  /** Los personajes barajados, en el orden en que se reparten (ver ReglaPersonaje.repartir). */
  repartir(jugadores: Jugador[], personajes: string[]): string[] {
    return this.reglas.reduce((lista, r) => r.repartir?.(this.ctx, jugadores, lista) ?? lista, personajes);
  }
}
