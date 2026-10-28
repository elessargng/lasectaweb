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

export const FRASES = {
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
  ejecutado: (quien: string) => `${quien} es ejecutada, muere y nos vamos a dormir.`,
  ejecutadoYFinal: (quien: string) => `${quien} es ejecutada, muere, y revelamos grimorio.`,
  nadieEjecutado: () => 'Nadie es ejecutado y nos vamos a dormir.',
  nadieEjecutadoYFinal: () => 'Nadie es ejecutado y revelamos el grimorio.',
  /** Alguien se declara Exterminador y dispara: si muere o no pasa nada. */
  disparo: (quien: string, aQuien: string, muere: boolean) => `${quien} se declara exterminador y dispara a ${aQuien}. ${muere ? `${aQuien} muere.` : 'No pasa nada.'}`,
  revelamos: () => 'Revelamos el grimorio.',
  violinista: () => 'Sale el Violinista: el demonio elige en secreto a un jugador bueno y luego todos señaláis a uno de los dos.',
} as const;
