/** Lo que dice el narrador virtual (en voz alta y escrito junto a su cuadro). */

/** «Ana», «Ana y a Bea», «Ana, a Bea y a Carla» (detrás de «salvo a…»). */
const listaConA = (nombres: string[]) => {
  const conA = nombres.map((n, i) => (i === 0 ? n : `a ${n}`));
  return conA.length <= 1 ? (conA[0] ?? '') : `${conA.slice(0, -1).join(', ')} y ${conA[conA.length - 1]}`;
};

/** «medio minuto», «1 minuto», «3 minutos y medio» (en medios minutos; lo que sobra, se redondea). */
const tiempo = (segundos: number) => {
  const medios = Math.max(1, Math.round(segundos / 30));
  const minutos = Math.floor(medios / 2);
  const medio = medios % 2 === 1;
  if (minutos === 0) return 'medio minuto';
  return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}${medio ? ' y medio' : ''}`;
};

/** Los saludos al llegar a la sala: se elige uno al azar. */
const SALUDOS = [
  'Buenas noches, forasteros. Sentaos, que esta noche alguien no verá el amanecer.',
  'Bienvenidos a Ravenswood Bluff. Coged sitio en la plaza, que el demonio no espera.',
  'Hola a todos, seré vuestro narrador. Sentaos y que nadie se fíe de nadie.',
  'Saludos, vecinos. Cuando estéis todos sentados, empezamos.',
  'Buenas noches. Ocupad vuestros asientos, la ciudad tiene un problema y vosotros sois la solución.',
  'Ya estoy aquí. Sentaos tranquilos, que de momento no muerde nadie.',
] as const;

/** Lo que dice al acabar de revelar el grimorio, según quién gane: la primera, la favorita. */
const GANA = {
  bueno: [
    'Felicidades al equipo de los buenos.',
    'Felicidades al equipo de los buenos: Ravenswood Bluff está a salvo.',
    '¡Ganan los buenos! El demonio ya no volverá a molestar a la ciudad.',
    'Enhorabuena al equipo de los buenos, habéis salvado la ciudad.',
    'La luz se impone esta vez: felicidades a los buenos.',
  ],
  malvado: [
    'Felicidades al equipo de los malos.',
    'Felicidades al equipo de los malos: Ravenswood Bluff ya es vuestra.',
    '¡Ganan los malos! La ciudad cae en manos del demonio.',
    'Enhorabuena al equipo de los malos, os habéis salido con la vuestra.',
    'La oscuridad se impone esta vez: felicidades a los malos.',
  ],
} as const;

/** Lo que el narrador dio a alguien, ya en palabras («un 1», «un sí»…), y si era mentira. */
export interface InfoRevelada {
  que: string;
  falsa: boolean;
}

/** Lo que hizo alguien una noche, ya en palabras. */
export interface NocheRevelada {
  noche: number;
  /** Cada elección («a Ana», «a Ana y a Bea»). */
  eligio: string[];
  infos: InfoRevelada[];
  /** Estaba envenenado (lo que eligió no hizo nada; lo que recibió, quizá mentira). */
  envenenado: boolean;
}

/** Cómo y cuándo murió alguien (el número del día o de la noche). */
export interface MuerteRevelada {
  momento: 'dia' | 'noche';
  numero: number;
  causa: 'ejecucion' | 'exterminador' | 'demonio' | 'suicidio' | 'otra';
}

/** Lo que se cuenta de alguien al revelar su ficha. */
export interface Revelacion {
  nombre: string;
  /** Quien es de verdad (su nombre), o null si no tiene personaje. */
  personaje: string | null;
  /** El personaje que creía ser (el Borracho), o null. */
  creia: string | null;
  /** El que tenía antes de pasar a ser el que es (la Mujer Escarlata que pasa a ser el Imp), o null. */
  antes: string | null;
  /** Las noches en que eligió o recibió algo. */
  noches: NocheRevelada[];
  muerte: MuerteRevelada | null;
  /** Despertaba cada noche con información y murió antes del final: dejó de recibirla. */
  sinMasInformacion: boolean;
}

const ORDINALES = ['primer', 'segund', 'tercer', 'cuart', 'quint', 'sext', 'séptim', 'octav', 'noven', 'décim'];
/** «el segundo día», «el primer día», «el día 12». */
const elDia = (n: number) => {
  const raiz = ORDINALES[n - 1];
  if (!raiz) return `el día ${n}`;
  return `el ${raiz}${raiz === 'primer' || raiz === 'tercer' ? '' : 'o'} día`;
};
/** «la segunda noche», «la noche 12». */
const laNoche = (n: number) => {
  const raiz = ORDINALES[n - 1];
  if (!raiz) return `la noche ${n}`;
  return `la ${raiz}a noche`;
};

/** «a, b y c». */
const listaConY = (partes: string[]) =>
  partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;

function muerteEnPalabras({ momento, numero, causa }: MuerteRevelada): string {
  const cuando = momento === 'dia' ? elDia(numero) : laNoche(numero);
  if (causa === 'ejecucion') return `murió en la ejecución del${cuando.slice(2)}`;
  if (causa === 'exterminador') return `murió por el disparo del Exterminador ${cuando}`;
  if (causa === 'demonio') return `murió a manos del demonio ${cuando}`;
  if (causa === 'suicidio') return `se quitó la vida ${cuando}`;
  return `murió ${cuando}`;
}

/**
 * Lo de cada noche: «a Ana la primera noche y a Bea la segunda noche (envenenado)»
 * (solo elecciones, o solo información: el verbo lo pone quien llama) o «eligió a
 * Ana y a Bea y recibió un sí la primera noche, …». Lo que recibió envenenado se
 * dice: si era mentira o, si no, que era verdad.
 */
function porNoches(noches: NocheRevelada[]): string | null {
  if (!noches.length) return null;
  // Con una sola noche, la primera, no hace falta decir cuándo
  const conNoche = noches.length > 1 || noches[0].noche !== 1;
  const soloInfo = noches.every((n) => !n.eligio.length);
  const soloEleccion = noches.every((n) => !n.infos.length);
  const tramo = (n: NocheRevelada) => {
    const recibio = listaConY(n.infos.map((i) => `${i.que}${i.falsa ? ' (era mentira)' : ''}`));
    const acciones = soloInfo
      ? recibio
      : soloEleccion
        ? listaConY(n.eligio)
        : [n.eligio.length && `eligió ${listaConY(n.eligio)}`, n.infos.length && `recibió ${recibio}`].filter(Boolean).join(' y ');
    const veneno = !n.envenenado ? '' : n.infos.length && !n.infos.some((i) => i.falsa) ? ' (envenenado, pero era verdad)' : ' (envenenado)';
    return `${acciones}${conNoche ? ` ${laNoche(n.noche)}` : ''}${veneno}`;
  };
  const tramos = noches.map(tramo);
  if (soloInfo) return `recibió ${listaConY(tramos)}`;
  if (soloEleccion) return `eligió ${listaConY(tramos)}`;
  return tramos.join('; ');
}

/**
 * «Pepe era Chef, recibió un 1 y murió en la ejecución del segundo día.»
 * «Ana era Monje, eligió a Bea la segunda noche y a Luis la tercera noche (envenenado).»
 * «Juan creía que era Bibliotecario, pero en realidad era Borracho. Recibió…»
 * «Eva era Mujer Escarlata y pasó a ser Imp, eligió a Luis la tercera noche.»
 */
function alRevelar({ nombre, personaje, creia, antes, noches, muerte, sinMasInformacion }: Revelacion): string {
  const inicio =
    creia && personaje
      ? `${nombre} creía que era ${creia}, pero en realidad era ${personaje}`
      : antes && personaje
        ? `${nombre} era ${antes} y pasó a ser ${personaje}`
        : personaje
          ? `${nombre} era ${personaje}`
          : nombre;
  const partes = [
    porNoches(noches),
    muerte && muerteEnPalabras(muerte),
    sinMasInformacion && 'ya no recibió más su información',
  ].filter((p): p is string => !!p);
  if (!partes.length) return `${inicio}.`;
  const resto = listaConY(partes);
  return creia ? `${inicio}. ${resto[0].toUpperCase()}${resto.slice(1)}.` : `${inicio}, ${resto}.`;
}

/**
 * Lo que se tarda en decir cada letra (ms), para esperar a que acabe una frase: lo
 * que tarda la voz del navegador en español, más o menos (si se queda corto, la
 * siguiente no la corta: la voz las encola).
 */
const POR_LETRA_MS = 60;

/** La pausa con suspense entre una parte y otra de lo que dice (al ejecutar, al disparar…) (ms): breve, sin que se haga larga. */
export const PAUSA_MS = 600;

/** Lo que se tarda en decir una frase (ms), más o menos. */
export const duracionFrase = (frase: string): number => frase.length * POR_LETRA_MS;

export const FRASES = {
  /** Al añadirlo a la sala; `azar` da un número en [0, 1). */
  saludo: (azar: () => number) => SALUDOS[Math.min(SALUDOS.length - 1, Math.floor(azar() * SALUDOS.length))],
  primeraNoche: () => 'Noche uno, nos vamos a dormir.',
  /** El primer día: lo que duran los privados. */
  primerDia: (segundos: number) =>
    `Buenos días plaza, hay un demonio entre vosotros que me ha matado durante la noche, encontradlo y ejecutadlo, tenéis ${tiempo(segundos)}.`,
  /** Los demás días: quién ha muerto esta noche. */
  buenosDias: (muertos: string[]) =>
    muertos.length === 0
      ? 'Buenos días a todo el mundo, nadie nos ha dejado esta noche.'
      : `Buenos días a todo el mundo salvo a ${listaConA(muertos)}, que ${muertos.length === 1 ? 'nos ha dejado' : 'nos han dejado'}.`,
  nomina: (quien: string, aQuien: string) => `${quien} nomina a ${aQuien}, acusación ${quien}.`,
  /** El nominador pasa la palabra al nominado. */
  defensa: (quien: string) => `Defensa ${quien}.`,
  /** Los votos para marcar; con una marca ya puesta, cuántos empatarían con ella. */
  votosNecesarios: (votos: number, aQuien: string, hayMarca: boolean) =>
    `Hacen falta ${votos} votos para marcar a ${aQuien}${hayMarca ? `, ${votos - 1} votos empatarían la votación anterior` : ''}.`,
  /** La votación llega a los votos y supera la marca. */
  marcado: (quien: string) => `${quien} queda marcado.`,
  /** Se acaba el día, en dos partes con una pausa: «Pepe es ejecutada y muere…» y, después, `trasEjecucion`. */
  ejecutado: (quien: string) => `${quien} es ejecutada y muere…`,
  /** Quien nomina a la Virgen es ejecutado al momento. */
  virgen: (quien: string, aQuien: string) => `${quien} nomina a ${aQuien} y es ejecutada…`,
  nadieEjecutado: () => 'Nadie es ejecutado…',
  /** Lo que sigue a la pausa: a la noche o, si se acaba la partida, al grimorio. */
  trasEjecucion: (final: boolean) => (final ? 'Y revelamos el grimorio.' : 'Y nos vamos a la noche.'),
  /** Alguien se declara Exterminador y dispara (luego, tras una pausa, si muere y si sigue la partida). */
  disparo: (quien: string, aQuien: string) => `${quien} se declara exterminador y dispara a ${aQuien} y…`,
  muere: (quien: string) => `${quien} muere.`,
  /** Un muerto se declara Patoso y elige a un vivo (luego, tras una pausa, si sigue la partida). */
  patoso: (quien: string, aQuien: string) => `${quien} se declara patoso y elige a ${aQuien} y…`,
  partidaContinua: () => 'La partida continúa.',
  revelamos: () => 'Revelamos el grimorio.',
  /** Al acabar de revelar: quién gana (una de varias, la primera más a menudo); `azar` da un número en [0, 1). */
  gana: (ganador: 'bueno' | 'malvado', azar: () => number) => {
    const frases = GANA[ganador];
    return azar() < 0.4 ? frases[0] : frases[1 + Math.min(frases.length - 2, Math.floor(azar() * (frases.length - 1)))];
  },
  /** Al revelar cada ficha: quién era, lo que recibió y cómo murió. */
  alRevelar,
  /** Jarvis no consigue hablar con su modelo y deja la partida a «Tonto y tú». */
  jarvisSeVa: () => 'Jarvis tiene que irse; os dejo con Tonto y tú, que seguirá la partida.',
  violinista: () => 'Sale el Violinista: el demonio elige en secreto a un jugador bueno y luego todos señaláis a uno de los dos.',
} as const;
