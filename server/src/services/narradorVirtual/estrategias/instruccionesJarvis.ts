import { CONCEPTOS_BIEN, CONCEPTOS_MAL, type Conceptos } from '../bolsa/conceptos';
import type { MotivoDecision, RasgoOpcion } from './EstrategiaNarrador';

/**
 * Lo que se le explica al modelo de Jarvis con cada decisión: quién es, qué busca
 * y, por cada tipo de decisión, cómo la tomaría un buen narrador.
 */

export const INSTRUCCIONES_NARRADOR =
  'Eres el narrador de una partida de Blood on the Clocktower (guion Trouble Brewing). En el estado tienes el grimorio ' +
  'entero: quién es cada jugador de verdad, su bando, si está vivo, envenenado o borracho, sus recordatorios, lo que se ' +
  'le ha dicho de noche y, de los malvados, los faroles que usan. Quieres una partida equilibrada e interesante hasta el ' +
  'final: que el bien pueda resolverla y que el mal tenga opciones de ganar, sin decidir tú quién gana. Decide como lo ' +
  'haría un buen narrador humano.';

const POR_MOTIVO: Record<MotivoDecision, string> = {
  bolsa:
    'Montas la bolsa de la partida hueco a hueco. Busca una partida equilibrada e interesante: variedad de información, ' +
    'personajes que se combinen bien y que el mal pueda esconderse.',
  borracho: 'El Borracho cree ser este aldeano y recibe información que puede ser falsa: elige el que haga la partida más interesante sin romperla.',
  asientoLibre: 'Nadie juega en este asiento: elige lo que elegiría ese personaje jugado con sensatez por su bando.',
  nuevoImp: 'El Imp se ha matado y un esbirro pasa a ser el demonio: elige el que mejor mantenga la partida viva.',
  farol:
    'Un farol para el demonio: un personaje bueno que no está en juego. Que sea creíble, que no choque con los faroles que ' +
    'ya usan los esbirros ni con aldeanos que ya se hayan destapado.',
  redHerring: 'El Red Herring: un jugador bueno que a la Pitonisa le saldrá como el demonio. Que confunda sin hundir al bien.',
  correcto: 'El jugador de verdad de ese tipo que se le enseña.',
  incorrecto: 'El otro jugador que se le enseña sin serlo: que la información sea útil e interesante.',
  revision: 'Alguien puede registrar como otro (el Espía, la Reclusa). Decide qué se le dice pensando en el equilibrio.',
  droisonVerdad:
    'Este rol de información está envenenado o borracho y puedes mentirle. Lo habitual: si la verdad no le cuesta nada al ' +
    'mal, decirla a menudo esconde el veneno; si la señala, casi nunca. Sé coherente con lo que ya se le dijo. La ' +
    'probabilidad del consejo es la que daría un narrador al azar.',
  informacionFalsa:
    'La mentira que recibe. Que sea creíble y coherente con lo dicho otras noches; mejor si confirma el farol de un ' +
    'malvado o inculpa a un bueno, sin dejar la partida sin solución.',
  alcaldeRebota: 'El demonio ataca al Alcalde: decide si muere él o la muerte rebota a otro jugador.',
  alcaldeAQuien: 'A quién rebota la muerte del Alcalde.',
  espiaComoAldeano: 'El Espía nomina a la Virgen: si registra como aldeano, el Espía es ejecutado al momento.',
  reclusaComoDemonio: 'El Exterminador dispara a la Reclusa: si registra como demonio, muere.',
  violinistaBueno: 'El Violinista: el jugador bueno que se enfrenta al demonio; todos votarán entre los dos.',
};

const RASGOS: Record<RasgoOpcion, string> = {
  verdad: 'es la verdad',
  verosimil: 'creíble',
  inculpaABueno: 'inculpa a un bueno',
  confirmaFarol: 'confirma el farol de un malvado',
  inofensivaParaElMal: 'no le cuesta nada al mal',
  forastero: 'forastero',
  concepto: 'encaja con el concepto',
};

/**
 * Para la bolsa: los conceptos de esta partida y lo usado en las recientes
 * (`recientes`, ya en palabras; vacío si no hay).
 */
export const instruccionesBolsa = ({ bien, mal }: Conceptos, recientes: string) =>
  'Montas la bolsa de la partida hueco a hueco. ' +
  `Concepto del bien: ${CONCEPTOS_BIEN[bien].descripcion}. Concepto del mal: ${CONCEPTOS_MAL[mal].descripcion}. ` +
  'Cada hueco de aldeano tiene asignada una categoría; elige dentro de ella el personaje que mejor sirva a los dos ' +
  'conceptos y que mejor se combine con lo ya elegido. ' +
  (recientes ? `Personajes usados en partidas recientes: ${recientes}; evítalos salvo que encajen claramente mejor. ` : '') +
  'No busques la bolsa estándar. Si la combinación de conceptos deja a un bando sin opciones reales, compénsalo con ' +
  'tus elecciones, pero sin traicionar los conceptos.';

/** Las de su motivo, o las `propias` de la decisión si las trae. */
export const instruccionesPara = (motivo: MotivoDecision, pregunta: string, propias?: string) => `${propias ?? POR_MOTIVO[motivo]}\n${pregunta}`;

/** Una opción para el modelo: su descripción y, entre corchetes, lo que la mesa sabe de ella. */
export const describirParaJarvis = (descripcion: string, rasgos: readonly RasgoOpcion[] = []) =>
  rasgos.length ? `${descripcion} [${rasgos.map((r) => RASGOS[r]).join(', ')}]` : descripcion;
