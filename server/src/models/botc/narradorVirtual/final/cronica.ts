import type { EnvioDespertar } from '../../partida/despertar';
import type { CausaMuerte } from '../../partida/diario';
import type { SalaDeJuego } from '../../SalaDeJuego';
import { FRASES, type MuerteRevelada, type NocheRevelada } from '../frases';
import { nombreDeAsiento } from '../plazaDeJuego';
import { numeroDe } from '../noche/informacionFalsa';
import { identidadDe } from '../../partida/Grimorio';
import type { Jugador } from '../../partida/Jugador';
import { causasApuntadas, muertes, nochesPorAsiento, personajesPorAsiento, ultimaNoche } from '../../partida/proyecciones/historiaAsientos';

/** Lo que hizo alguien una noche: a quiénes eligió, lo que le dio el narrador (y si era falso) y si estaba droison. */
interface NocheApuntada {
  noche: number;
  /** Cada elección, sus asientos (la Pitonisa elige dos de una vez). */
  eligio: string[][];
  infos: { envio: EnvioDespertar; falsa: boolean }[];
  droison: 'envenenado' | 'borracho' | null;
}

/**
 * Lo que ha pasado en la partida, para contarlo al revelar el grimorio y contestar
 * al Artista: lo que elige y la información que recibe cada uno cada noche (y si
 * era falsa o estaba envenenado) y cómo y cuándo muere. Sale del diario de la
 * partida (ver cronicaDe): no se apunta aparte.
 */
export interface Cronica {
  /** Por asiento, sus noches (solo las que eligió o recibió algo). */
  noches: Map<string, NocheApuntada[]>;
  muertes: Map<string, MuerteRevelada>;
  /** Por asiento, el personaje que tenía antes de pasar a ser el Imp (la Mujer Escarlata, el esbirro del Imp que se mata). */
  antes: Map<string, string>;
  /** La última noche que se ha jugado. */
  ultimaNoche: number;
  /** Lo que ha acabado la partida o conviene dejar dicho (CAUSAS_FIN_PARTIDA): de ahí salen los logros. */
  causas: Set<string>;
}

/** Si un mensaje del narrador es información (un número, un sí o un no, un alineamiento, «Este jugador es»). */
const esInformacion = (m: EnvioDespertar): boolean =>
  numeroDe(m) !== null || ['si', 'no', 'bueno', 'malvado'].includes(m.ficha ?? '') || m.tarjeta === 'esteJugadorEs';

/**
 * La crónica de la partida, sacada de su diario (ver proyecciones/historiaAsientos).
 * De los malvados no se cuenta la información (la suya no es de su habilidad). Cada
 * muerte, por lo que la causó: la ejecución, el Exterminador, el demonio (o el
 * demonio que se mata a sí mismo) u otra cosa. Lo que tenía antes quien pasa a
 * ser el demonio (la Mujer Escarlata, el esbirro del Imp que se mata).
 */
export function cronicaDe(juego: SalaDeJuego): Cronica {
  const { partida } = juego;
  const diario = partida.registro.hechos();
  const plaza = partida.plaza();
  const esDemonio = (personaje: string) => partida.guion.personaje(personaje)?.tipo === 'demon';
  const malvado = (asiento: string) => {
    const a = plaza.find((x) => x.id === asiento);
    return !!a && partida.grimorio.alineamiento(a) === 'malvado';
  };
  const noches = new Map<string, NocheApuntada[]>();
  for (const [asiento, lista] of nochesPorAsiento(diario)) {
    const apuntadas = lista
      .map((n) => ({ ...n, infos: malvado(asiento) ? [] : n.infos.filter((i) => esInformacion(i.envio)) }))
      .filter((n) => n.eligio.length || n.infos.length);
    if (apuntadas.length) noches.set(asiento, apuntadas);
  }
  const causa = (asiento: string, c: CausaMuerte): MuerteRevelada['causa'] => {
    if (c === 'ejecucion') return 'ejecucion';
    if (c === 'slayer') return 'exterminador';
    if (!esDemonio(c)) return 'otra';
    const muerto = plaza.find((a) => a.id === asiento);
    return muerto && identidadDe(muerto) === c ? 'suicidio' : 'demonio';
  };
  const antes = new Map<string, string>();
  for (const [asiento, personajes] of personajesPorAsiento(diario)) {
    if (personajes.length >= 2 && esDemonio(personajes[personajes.length - 1])) antes.set(asiento, personajes[personajes.length - 2]);
  }
  return {
    noches,
    muertes: new Map([...muertes(diario)].map(([asiento, m]) => [asiento, { momento: m.momento, numero: m.numero, causa: causa(asiento, m.causa) }])),
    antes,
    ultimaNoche: ultimaNoche(diario),
    causas: new Set(causasApuntadas(diario)),
  };
}

/**
 * Lo que se cuenta de un asiento al revelar su ficha. Un demonio, sea cual sea, es
 * siempre «el demonio» (quién era, lo que creía ser, lo que le enseñaron…), nunca su nombre.
 */
export function fraseAlRevelar(cronica: Cronica, juego: SalaDeJuego, jugador: Jugador): string {
  const { partida } = juego;
  const nombreP = (id: string) => {
    const personaje = partida.guion.personaje(id);
    return personaje?.tipo === 'demon' ? 'el demonio' : (personaje?.nombre ?? id);
  };
  const nombre = (id: string) => nombreDeAsiento(juego, id);
  const identidad = identidadDe(jugador) ?? jugador.personaje;
  const noches: NocheRevelada[] = (cronica.noches.get(jugador.id) ?? []).map((n) => ({
    noche: n.noche,
    eligio: n.eligio.map((ids) => listaConA(ids.map(nombre))),
    infos: n.infos.map(({ envio, falsa }) => ({ que: describirInformacion(envio, nombre, nombreP), falsa })),
    // El Borracho ya lo dice «creía que era…»
    envenenado: n.droison === 'envenenado',
  }));
  const muerte = jugador.muerto ? (cronica.muertes.get(jugador.id) ?? null) : null;
  // Despierta cada noche con su información y murió antes de que acabara: dejó de recibirla
  const ficha = jugador.personaje;
  const antes = cronica.antes.get(jugador.id);
  const conInformacion = noches.some((n) => n.infos.length > 0);
  const cadaNoche = !!ficha && conInformacion && (partida.guion.actual()?.otrasNoches ?? []).includes(ficha);
  const antesDelFinal = !!muerte && (muerte.momento === 'noche' || muerte.numero < cronica.ultimaNoche);
  return FRASES.alRevelar({
    nombre: nombreDeAsiento(juego, jugador.id),
    personaje: identidad ? nombreP(identidad) : null,
    creia: ficha && identidad && ficha !== identidad ? nombreP(ficha) : null,
    antes: antes ? nombreP(antes) : null,
    noches,
    muerte,
    sinMasInformacion: cadaNoche && antesDelFinal,
  });
}

/** «a Ana», «a Ana y a Luis». */
const listaConA = (nombres: string[]) => {
  const conA = nombres.map((n) => `a ${n}`);
  return conA.length <= 1 ? (conA[0] ?? '') : `${conA.slice(0, -1).join(', ')} y ${conA[conA.length - 1]}`;
};

/** Una información en palabras: «un 1», «un sí», «a Ana o a Luis como Lavandera». */
function describirInformacion(envio: EnvioDespertar, nombre: (asiento: string) => string, nombreP: (id: string) => string): string {
  const n = numeroDe(envio);
  if (n !== null) return `un ${n}`;
  if (envio.ficha === 'si') return 'un sí';
  if (envio.ficha === 'no') return 'un no';
  if (envio.ficha === 'bueno' || envio.ficha === 'malvado') return `«${envio.ficha}»`;
  const quienes = envio.jugadores.map((id, i) => (i === 0 ? nombre(id) : `a ${nombre(id)}`));
  const lista = quienes.length <= 1 ? (quienes[0] ?? '') : `${quienes.slice(0, -1).join(', ')} o ${quienes[quienes.length - 1]}`;
  const personajes = envio.personajes.map(nombreP).join(' o ');
  return [lista && `a ${lista}`, personajes && `como ${personajes}`].filter(Boolean).join(' ');
}

/** El narrador virtual apunta en el diario una causa del final (de ahí salen los logros, ver cronicaDe). */
export function apuntarCausa(juego: SalaDeJuego, id: string): void {
  juego.narrador.paso('narradorVirtual:causa', () => juego.partida.anotar({ tipo: 'causa', id }));
}
