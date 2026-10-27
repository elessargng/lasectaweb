import { nombreMano } from './formasMano';
import type { PersonajeMostrado } from './guiones';
import { datosAsiento } from './nombresAsiento';
import { anuncioReloj } from './reloj';
import type { TipoAviso } from './avisosConfig';
import type { SalaEstado, SalaParticipante, SalaFase } from './useSala';

/**
 * Qué decirle al lector cuando cambia la sala por algo que han hecho otros:
 * quién narra, quién entra o sale narrando, quién se sienta o se levanta, quién
 * levanta o baja la mano; qué fichas mueren, reviven o llevan la calavera, y las
 * nominaciones (con su cuenta atrás y su votación). Solo frases cortas (van a un aria-live polite) y casi nunca
 * sobre uno mismo, que tiene sus propios avisos (foco, «Te han levantado»…);
 * sí se dice si uno muere o revive.
 *
 * Los cambios de sitio de quien ya estaba sentado (mezclar, mover) no se dicen
 * uno a uno: serían una ráfaga.
 */
/** Un aviso para el lector, con su tipo (para que cada uno elija cuáles quiere: avisosConfig). */
export interface Aviso {
  tipo: TipoAviso;
  texto: string;
}

/** «Preparación», «Noche 2», «Día 2». */
export const nombreFase = (f: SalaFase) =>
  f.momento === 'preparacion' ? 'Preparación' : `${f.momento === 'noche' ? 'Noche' : 'Día'} ${f.numero}`;

/**
 * La votación es secreta para quien recibe el estado (Organ Grinder): no ve los
 * votos que hacen falta, ni el recuento, ni quién vota salvo él, ni las manos de los
 * demás. Los narradores y quien ve el grimorio lo ven todo.
 */
export function votacionOculta(e: SalaEstado): boolean {
  if (!e.nominacion?.privada) return false;
  const yo = e.participantes.find((p) => p.id === e.yo);
  return !(yo?.rol === 'narrador' || (yo?.rol === 'visitante' && yo.accesoGrimorio === 'concedido'));
}

/** «Hacen falta 3 votos» (o «1 voto»). */
export const hacenFalta = (votos: number) => `Hacen falta ${votos === 1 ? '1 voto' : `${votos} votos`}`;

/**
 * Quien vigila la mano de alguien (`vigilados`) oye al momento cuándo la levanta
 * o la baja (manosVigiladas); aquí no se repite.
 */
export function avisosDeCambio(
  anterior: SalaEstado,
  nuevo: SalaEstado,
  vigilados: Set<string> = new Set(),
  /** Los personajes del guion: para el nombre de una mano que es un personaje. */
  personajes?: Map<string, PersonajeMostrado>,
): Aviso[] {
  const yo = nuevo.yo;
  const antes = new Map(anterior.participantes.map((p) => [p.id, p]));
  const ahora = new Map(nuevo.participantes.map((p) => [p.id, p]));
  const narra = (p?: SalaParticipante) => p?.rol === 'narrador';
  const avisos: Aviso[] = [];
  const avisa = (tipo: TipoAviso, texto: string) => {
    avisos.push({ tipo, texto });
  };

  // Narradores: quién empieza o deja de narrar, entra, se va o pierde la conexión.
  for (const p of nuevo.participantes) {
    const previo = antes.get(p.id);
    if (!narra(p)) continue;
    if (p.id === yo) {
      if (!narra(previo)) avisa('narradores', 'Ahora eres narrador.');
    } else if (!previo) {
      avisa('narradores', `${p.nombre}, que narra, ha entrado en la sala.`);
    } else if (!narra(previo)) {
      avisa('narradores', `${p.nombre} ahora narra.`);
    } else if (previo.conectado && !p.conectado) {
      avisa('narradores', `${p.nombre}, que narra, ha perdido la conexión.`);
    } else if (!previo.conectado && p.conectado) {
      avisa('narradores', `${p.nombre}, que narra, ha vuelto.`);
    }
  }
  const narrabanAntes = anterior.participantes.filter((p) => narra(p));
  const quedanNarradores = nuevo.participantes.some((p) => narra(p));
  for (const p of narrabanAntes) {
    const actual = ahora.get(p.id);
    if (narra(actual)) continue;
    if (p.id === yo) avisa('narradores', 'Ya no eres narrador.');
    else if (!actual) avisa('narradores', `${p.nombre}, que narraba, se ha ido de la sala.`);
    else if (quedanNarradores) avisa('narradores', `${p.nombre} ya no narra.`);
  }
  if (narrabanAntes.length > 0 && !quedanNarradores) avisa('narradores', 'La sala se ha quedado sin narrador.');

  // Ver el grimorio del narrador: a los narradores, quién lo pide; al visitante, la respuesta.
  const soyNarrador = narra(ahora.get(yo));
  for (const p of nuevo.participantes) {
    const previo = antes.get(p.id);
    if (!previo || previo.accesoGrimorio === p.accesoGrimorio) continue;
    if (p.id === yo) {
      if (p.accesoGrimorio === 'concedido') avisa('accesoGrimorio', 'El narrador te deja ver su grimorio.');
      else if (p.accesoGrimorio === 'ninguno' && p.rol === 'visitante') {
        // Concedido y perdido: se ha limpiado el grimorio (otra partida)
        avisa(
          'accesoGrimorio',
          previo.accesoGrimorio === 'concedido' ? 'Ya no ves el grimorio del narrador.' : 'El narrador no te deja ver su grimorio.',
        );
      }
    } else if (soyNarrador && p.accesoGrimorio === 'solicitado') {
      avisa('accesoGrimorio', `${p.nombre} pide ver el grimorio.`);
    }
  }

  // Conversaciones privadas: la propia (con quién, quién entra y sale, cuándo acaba)
  // y las de los demás (quién con quién, al empezar).
  const nombreDe = (id: string) => ahora.get(id)?.nombre ?? antes.get(id)?.nombre ?? 'Alguien';
  const lista = (ids: string[]) => {
    const n = ids.map(nombreDe);
    return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
  };
  const suConversacion = (e: SalaEstado, id: string) =>
    e.conversaciones.find((c) => c.miembros.includes(id) || c.oyentes.includes(id));
  const miAntes = suConversacion(anterior, yo);
  const miAhora = suConversacion(nuevo, yo);
  if (miAhora && miAhora.id !== miAntes?.id) {
    avisa(
      'conversaciones',
      miAhora.oyentes.includes(yo)
        ? `Escuchas la conversación de ${lista(miAhora.miembros)}.`
        : `Estás en una conversación privada con ${lista(miAhora.miembros.filter((id) => id !== yo))}.`,
    );
  } else if (miAhora && miAntes) {
    for (const id of miAhora.miembros.filter((m) => !miAntes.miembros.includes(m))) {
      avisa('conversaciones', `${nombreDe(id)} se suma a la conversación.`);
    }
    // Si me quedo sin nadie más, la conversación sigue: se dice, porque hay que salir a mano.
    const sinNadie = miAhora.miembros.length === 1 && miAhora.miembros[0] === yo && miAntes.miembros.length > 1;
    const salen = miAntes.miembros.filter((m) => !miAhora.miembros.includes(m));
    salen.forEach((id, i) => {
      const ultimo = sinNadie && i === salen.length - 1;
      avisa('conversaciones', `${nombreDe(id)} sale de la conversación${ultimo ? ' y no queda nadie más' : ''}.`);
    });
  } else if (miAntes && !miAhora) {
    // Quien escuchaba (visitante, o siguiendo a un jugador) vuelve a la mesa
    const escuchaba = miAntes.oyentes.includes(yo);
    const sigue = nuevo.conversaciones.some((c) => c.id === miAntes.id);
    avisa(
      'conversaciones',
      !escuchaba
        ? 'Termina tu conversación privada.'
        : sigue
          ? 'Dejas de escuchar la conversación.'
          : 'Termina la conversación que escuchabas.',
    );
  }
  for (const c of nuevo.conversaciones) {
    if (c.miembros.includes(yo) || anterior.conversaciones.some((a) => a.id === c.id)) continue;
    avisa('conversaciones', `${lista(c.miembros)} conversan en privado.`);
  }
  // Quién entra a escuchar (solo les llega a narradores y visitantes)
  for (const c of nuevo.conversaciones) {
    const previos = anterior.conversaciones.find((a) => a.id === c.id)?.oyentes ?? [];
    for (const id of c.oyentes.filter((o) => o !== yo && !previos.includes(o))) {
      avisa('conversaciones', `${nombreDe(id)} escucha la conversación de ${lista(c.miembros)}.`);
    }
  }
  // Las invitaciones y peticiones que me llegan se avisan en SalaJuego (con la tecla
  // para cogerlas). Aquí solo las mías que no se aceptan.
  for (const i of anterior.invitaciones) {
    if (i.de !== yo || nuevo.invitaciones.some((n) => n.id === i.id)) continue;
    if (i.conversacion) {
      // Si ya estoy en ella, ya se ha dicho con quién
      if (miAhora?.id === i.conversacion) continue;
      avisa(
        'conversaciones',
        nuevo.conversaciones.some((c) => c.id === i.conversacion)
          ? 'No te han aceptado en la conversación.'
          : 'Ha terminado la conversación a la que pedías unirte.',
      );
      continue;
    }
    // Si ha entrado en mi conversación, ya se dice que se suma
    if (miAhora?.miembros.includes(i.para)) continue;
    // Si ha entrado en otra (y la veo), la llamada se ha cancelado sola
    const enOtra = nuevo.conversaciones.some((c) => c.miembros.includes(i.para));
    avisa(
      'conversaciones',
      enOtra
        ? `Se cancela tu llamada a ${nombreDe(i.para)}: ha entrado en otra conversación.`
        : `${nombreDe(i.para)} no ha aceptado la invitación.`,
    );
  }

  // Asientos: quién se sienta y quién se levanta (o se va y lo deja libre).
  const asientoDe = (e: SalaEstado, id: string) => e.asientos.findIndex((a) => a.ocupante === id) + 1;
  for (const a of anterior.asientos) {
    if (!a.ocupante || a.ocupante === yo || asientoDe(nuevo, a.ocupante)) continue;
    const quien = antes.get(a.ocupante);
    const actual = ahora.get(a.ocupante);
    const numero = asientoDe(anterior, a.ocupante);
    if (!quien) continue;
    if (!actual) avisa('asientos', `${quien.nombre} se ha ido y deja libre el asiento ${numero}.`);
    // Si se ha levantado para narrar, ya se ha dicho que ahora narra.
    else if (!narra(actual)) avisa('asientos', `${quien.nombre} se levanta del asiento ${numero}.`);
  }
  for (const a of nuevo.asientos) {
    if (!a.ocupante || a.ocupante === yo || asientoDe(anterior, a.ocupante)) continue;
    const quien = ahora.get(a.ocupante);
    if (quien) avisa('asientos', `${quien.nombre} se sienta en el asiento ${asientoDe(nuevo, a.ocupante)}.`);
  }

  const forma = (p: SalaParticipante) => nombreMano(p.formaMano, personajes).toLocaleLowerCase('es');
  // La propia, bajada sola al empezar una nominación por no tener ya voto
  const miMano = { antes: antes.get(yo)?.manoLevantada, ahora: ahora.get(yo)?.manoLevantada };
  const nominacionNueva =
    !!nuevo.nominacion && (nuevo.nominacion.desde !== anterior.nominacion?.desde || nuevo.nominacion.hasta !== anterior.nominacion?.hasta);
  if (miMano.antes && !miMano.ahora && nominacionNueva) {
    const mio = nuevo.asientos.find((a) => a.ocupante === yo);
    if (mio?.muerto && mio.votoGastado) avisa('miMano', 'Se te baja la mano: ya no te queda voto.');
  }
  // Manos levantadas (las propias las avisa quien la levanta). Con la votación secreta, las
  // de los demás no se ven (ni se dice que aparecen o desaparecen al abrirla o cerrarla)
  const manosOcultas = votacionOculta(anterior) || votacionOculta(nuevo);
  for (const p of nuevo.participantes) {
    if (manosOcultas) break;
    const previo = antes.get(p.id);
    if (!previo || p.id === yo || previo.manoLevantada === p.manoLevantada || vigilados.has(p.id)) continue;
    // Bajarla por cambiar de papel (levantarse del asiento, dejar de narrar) no se dice
    // (ya se dice eso), ni al contarse su voto (se baja sola; ya se dice que vota).
    if (!p.manoLevantada && p.rol !== previo.rol) continue;
    const votoContado = (() => {
      const v = nuevo.nominacion?.votacion;
      const pasoAntes = anterior.nominacion?.votacion?.paso ?? 0;
      return !!v && v.orden.slice(pasoAntes, v.paso).some((id) => nuevo.asientos.find((a) => a.id === id)?.ocupante === p.id);
    })();
    if (!p.manoLevantada && votoContado) continue;
    avisa('manos', p.manoLevantada ? (p.dosManos ? `${p.nombre} levanta las dos manos.` : `${p.nombre} levanta la mano (${forma(p)}).`) : `${p.nombre} baja la mano.`);
  }
  // De una mano a dos, o de dos a una (sigue con la mano levantada)
  for (const p of nuevo.participantes) {
    if (manosOcultas) break;
    const previo = antes.get(p.id);
    if (!previo || p.id === yo || !p.manoLevantada || !previo.manoLevantada || !!previo.dosManos === !!p.dosManos || vigilados.has(p.id)) continue;
    avisa('manos', p.dosManos ? `${p.nombre} levanta las dos manos.` : `${p.nombre} baja una mano.`);
  }
  // Cambio de forma con la mano levantada (con ella bajada no se ve).
  for (const p of nuevo.participantes) {
    if (manosOcultas) break;
    const previo = antes.get(p.id);
    if (!previo || p.id === yo || !p.manoLevantada || !previo.manoLevantada || previo.formaMano === p.formaMano) continue;
    avisa('manos', `${p.nombre} cambia la mano a ${forma(p)}.`);
  }

  // Noche y día. Al limpiar el grimorio, un aviso y nada de cada ficha (revive todo el mundo).
  const limpio = nuevo.fase.reinicios !== anterior.fase.reinicios;
  const cambioFase =
    limpio || nuevo.fase.momento !== anterior.fase.momento || nuevo.fase.numero !== anterior.fase.numero;
  if (limpio) avisa('fase', 'Grimorio limpio: preparación de la partida.');
  else if (cambioFase) avisa('fase', `${nombreFase(nuevo.fase)}.`);

  // Fichas: quién (o qué asiento) muere, revive o lleva la calavera (al cambiar de
  // fase se quita la calavera: ya se ha dicho que anochece).
  // «Bea» si hay alguien sentado; si no, «la ficha del asiento 3». A uno mismo, «Has muerto».
  const quien = (e: SalaEstado, asientoId: string) => {
    const { numero, ocupante } = datosAsiento(e, asientoId);
    return ocupante ? (ocupante.id === yo ? null : ocupante.nombre) : `la ficha del asiento ${numero}`;
  };
  const mayuscula = (t: string) => t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
  const antesAsiento = new Map(anterior.asientos.map((a) => [a.id, a]));
  const seMarca = nuevo.asientos.some((a) => a.marcado && !antesAsiento.get(a.id)?.marcado);
  // Los muertos que acaban de votar: eso ya lo dice la votación (y que gastan su voto)
  const votacionAntes = anterior.nominacion?.votacion;
  const votacionAhora = nuevo.nominacion?.votacion;
  const recienVotados = new Set(votacionAhora ? votacionAhora.orden.slice(votacionAntes?.paso ?? 0, votacionAhora.paso) : []);
  // Varios muertos recuperan el voto a la vez (el Barquero): un solo aviso
  const recuperan = nuevo.asientos.filter((a) => {
    const previo = antesAsiento.get(a.id);
    return previo?.muerto && a.muerto && previo.votoGastado && !a.votoGastado;
  });
  if (!cambioFase && recuperan.length > 1) avisa('muertes', 'Los muertos recuperan su voto.');
  for (const a of nuevo.asientos) {
    const previo = antesAsiento.get(a.id);
    if (!previo || cambioFase) continue;
    const q = quien(nuevo, a.id);
    if (previo.muerto !== a.muerto) {
      if (q === null) avisa('muertes', a.muerto ? 'Has muerto.' : 'Has revivido.');
      else avisa('muertes', `${mayuscula(q)} ha ${a.muerto ? 'muerto' : 'revivido'}.`);
    } else if (a.muerto && previo.votoGastado !== a.votoGastado && !recienVotados.has(a.id) && !(recuperan.length > 1 && !a.votoGastado)) {
      if (q === null) avisa('muertes', a.votoGastado ? 'Pierdes tu voto.' : 'Recuperas tu voto.');
      else avisa('muertes', `${mayuscula(q)} ${a.votoGastado ? 'pierde' : 'recupera'} su voto.`);
    }
    if (previo.marcado !== a.marcado) {
      // Al pasar la calavera a otra ficha, basta con decir a cuál.
      // Al morir se le quita sola: basta con decir que ha muerto.
      if (a.marcado) avisa('calavera', `Calavera para ${q ?? 'ti'}.`);
      else if (!seMarca && !(a.muerto && !previo.muerto)) avisa('calavera', `Se quita la calavera a ${q ?? 'ti'}.`);
    }
  }

  // Nominación: de qué ficha a qué ficha, la cuenta atrás y el cierre.
  const nomAntes = anterior.nominacion;
  const nomAhora = nuevo.nominacion;
  const nominacionDe = (e: SalaEstado, id: string) => {
    const { numero, ocupante } = datosAsiento(e, id);
    return ocupante ? ocupante.nombre : `el asiento ${numero}`;
  };
  if (nomAhora && (nomAhora.desde !== nomAntes?.desde || nomAhora.hasta !== nomAntes?.hasta)) {
    const sujeto = mayuscula(nominacionDe(nuevo, nomAhora.desde));
    // Votación secreta: no se sabe cuántos votos hacen falta
    const necesarios = votacionOculta(nuevo) ? ' Votación secreta.' : ` ${hacenFalta(nomAhora.votosNecesarios)}.`;
    if (nomAhora.expulsion) {
      // Un viajero: no es una nominación, se pide su expulsión
      const objeto = nominacionDe(nuevo, nomAhora.hasta).replace(/^el /, 'al ');
      const quien = nomAhora.desde === nomAhora.hasta ? 'su propia expulsión' : `expulsar ${objeto.startsWith('al ') ? objeto : `a ${objeto}`}`;
      avisa('nominaciones', `${sujeto} pide ${quien}.${necesarios}`);
    } else if (nomAhora.desde === nomAhora.hasta) {
      avisa('nominaciones', `${sujeto} se nomina.${necesarios}`);
    } else {
      const objeto = nominacionDe(nuevo, nomAhora.hasta).replace(/^el /, 'al ');
      avisa('nominaciones', `${sujeto} nomina ${objeto.startsWith('al ') ? objeto : `a ${objeto}`}.${necesarios}`);
    }
  } else if (nomAhora && nomAntes && !votacionOculta(nuevo) && !votacionOculta(anterior) && nomAhora.votosNecesarios !== nomAntes.votosNecesarios) {
    // La misma nominación, pero ahora hacen falta otros votos (lo cambia el narrador, o muere alguien)
    avisa('nominaciones', `Ahora ${hacenFalta(nomAhora.votosNecesarios).toLocaleLowerCase('es')}.`);
  } else if (nomAntes && !nomAhora && !seMarca && !cambioFase && !nuevo.asientos.some((a) => antesAsiento.get(a.id)?.marcado && !a.marcado)) {
    // Si se ha cerrado al poner o quitar la calavera, ya se ha dicho eso.
    avisa('nominaciones', nomAntes.expulsion ? 'Expulsión cerrada.' : 'Nominación cerrada.');
  }
  const votAntes = nomAntes?.votacion;
  const votAhora = nomAhora?.votacion;
  if (votAhora && !votAntes) avisa('resultadoVotacion', 'Empieza la votación.');
  // Cada ficha por la que pasa la aguja: su nombre, y si vota, el total de votos.
  // (Quien use lector pondrá una velocidad de agujas que le dé tiempo a oírlo.)
  const secreta = votacionOculta(nuevo);
  if (votAhora) {
    const desdePaso = votAntes ? votAntes.paso : 0;
    for (const id of votAhora.orden.slice(desdePaso, votAhora.paso)) {
      const nombre = mayuscula(nominacionDe(nuevo, id));
      const resultado = votAhora.resultados[id];
      // Votación secreta: de los demás, solo por dónde va la aguja; de uno mismo, si vota
      if (secreta) {
        const mio = nuevo.asientos.find((a) => a.id === id)?.ocupante === yo;
        avisa('votoAVoto', mio ? (typeof resultado === 'number' ? 'Tu voto cuenta.' : 'No votas.') : `${nombre}.`);
        continue;
      }
      // Un muerto que vota gasta su único voto: se dice (su vela se apaga)
      // (la Banshee con su habilidad, o con el Voudon vivo, no lo gasta)
      const gastado = (e: SalaEstado) => !!e.asientos.find((a) => a.id === id)?.votoGastado;
      const gasta = typeof resultado === 'number' && gastado(nuevo) && !gastado(anterior) ? ', gasta su voto' : '';
      // Si su voto no vale 1 (Banshee, Burócrata, Ladrón), se dice cuánto
      const valor = votAhora.valores?.[id];
      const cuanto = valor !== undefined ? ` (su voto vale ${valor})` : '';
      avisa('votoAVoto', typeof resultado === 'number' ? `${nombre}, ${resultado}${cuanto}${gasta}.` : `${nombre}.`);
    }
  }
  if (votAhora?.terminada && !votAntes?.terminada) {
    avisa(
      'resultadoVotacion',
      secreta ? 'Votación terminada.' : `Votación terminada: ${votAhora.votos === 1 ? '1 voto' : `${votAhora.votos} votos`}.`,
    );
  }
  if (nomAhora?.cuentaAtrasFin && nomAhora.cuentaAtrasFin !== nomAntes?.cuentaAtrasFin) {
    avisa('cuentaAtras', 'Cuenta atrás.');
  }

  // El reloj del narrador: al ponerlo (o cambiarlo) y si lo quitan antes de acabar
  // (el final lo avisa el propio reloj, que es quien sabe cuándo llega)
  const relojAntes = anterior.reloj;
  const relojAhora = nuevo.reloj;
  if (relojAhora && relojAhora.inicio !== relojAntes?.inicio) {
    avisa('reloj', anuncioReloj(Math.round((relojAhora.fin - relojAhora.inicio) / 1000), relojAhora.mensaje));
  } else if (relojAntes && !relojAhora && relojAntes.fin > nuevo.ahora) {
    avisa('reloj', 'Reloj quitado.');
  }

  return avisos;
}

/** Las manos que se vigilan: siempre que la levantan o la bajan, para leerlo al momento (assertive). */
export function manosVigiladas(
  anterior: SalaEstado,
  nuevo: SalaEstado,
  vigilados: Set<string>,
  personajes?: Map<string, PersonajeMostrado>,
): string[] {
  const textos: string[] = [];
  for (const p of nuevo.participantes) {
    const previo = anterior.participantes.find((x) => x.id === p.id);
    if (!vigilados.has(p.id) || !previo || (previo.manoLevantada === p.manoLevantada && !!previo.dosManos === !!p.dosManos)) continue;
    textos.push(
      p.manoLevantada
        ? p.dosManos
          ? `${p.nombre} levanta las dos manos.`
          : previo.manoLevantada
            ? `${p.nombre} baja una mano.`
            : `${p.nombre} levanta la mano (${nombreMano(p.formaMano, personajes).toLocaleLowerCase('es')}).`
        : `${p.nombre} baja la mano.`,
    );
  }
  return textos;
}
