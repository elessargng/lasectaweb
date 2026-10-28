/** Lo que dice el narrador virtual (en voz alta y escrito junto a su cuadro). */

/** «Ana», «Ana y a Bea», «Ana, a Bea y a Carla» (detrás de «salvo a…»). */
const listaConA = (nombres: string[]) => {
  const conA = nombres.map((n, i) => (i === 0 ? n : `a ${n}`));
  return conA.length <= 1 ? (conA[0] ?? '') : `${conA.slice(0, -1).join(', ')} y ${conA[conA.length - 1]}`;
};

export const FRASES = {
  primeraNoche: () => 'Noche uno, nos vamos a dormir.',
  /** El primer día: los minutos de los privados. */
  primerDia: (minutos: number) =>
    `Buenos días plaza, hay un demonio entre vosotros que me ha matado durante la noche, encontradlo y ejecutadlo, tenéis ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
  /** Los demás días: quién ha muerto esta noche. */
  buenosDias: (muertos: string[]) =>
    muertos.length === 0
      ? 'Buenos días a todo el mundo, nadie nos ha dejado esta noche.'
      : `Buenos días a todo el mundo salvo a ${listaConA(muertos)}, que ${muertos.length === 1 ? 'nos ha dejado' : 'nos han dejado'}.`,
  nomina: (quien: string, aQuien: string) => `${quien} nomina a ${aQuien}, acusación ${quien}.`,
  /** Los votos para marcar; con una marca ya puesta, cuántos empatarían con ella. */
  votosNecesarios: (votos: number, aQuien: string, hayMarca: boolean) =>
    `Hacen falta ${votos} votos para marcar a ${aQuien}${hayMarca ? `, ${votos - 1} votos empatarían la votación anterior` : ''}.`,
  ejecutado: (quien: string) => `${quien} es ejecutada, muere y nos vamos a dormir.`,
  ejecutadoYFinal: (quien: string) => `${quien} es ejecutada, muere, y revelamos grimorio.`,
  nadieEjecutado: () => 'Nadie es ejecutado y nos vamos a dormir.',
  nadieEjecutadoYFinal: () => 'Nadie es ejecutado y revelamos el grimorio.',
  /** El Exterminador dispara: si muere o no pasa nada. */
  disparo: (quien: string, aQuien: string, muere: boolean) => `${quien} dispara a ${aQuien}. ${muere ? `${aQuien} muere.` : 'No pasa nada.'}`,
  revelamos: () => 'Revelamos el grimorio.',
  violinista: () => 'Sale el Violinista: el demonio elige en secreto a un jugador bueno y luego todos señaláis a uno de los dos.',
} as const;
