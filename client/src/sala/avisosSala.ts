import { nombreMano } from './formasMano';
import { datosAsiento } from './nombresAsiento';
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

/** «Hacen falta 3 votos» (o «1 voto»). */
export const hacenFalta = (votos: number) => `Hacen falta ${votos === 1 ? '1 voto' : `${votos} votos`}`;

export function avisosDeCambio(anterior: SalaEstado, nuevo: SalaEstado): Aviso[] {
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
    for (const id of miAntes.miembros.filter((m) => !miAhora.miembros.includes(m))) {
      avisa('conversaciones', `${nombreDe(id)} sale de la conversación.`);
    }
  } else if (miAntes && !miAhora) {
    avisa('conversaciones', 'Termina tu conversación privada.');
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
  // Invitaciones: las que me llegan y las mías que no se aceptan
  for (const i of nuevo.invitaciones) {
    if (i.para === yo && !anterior.invitaciones.some((a) => a.id === i.id)) {
      avisa('conversaciones', `${nombreDe(i.de)} te invita a una conversación privada.`);
    }
  }
  for (const i of anterior.invitaciones) {
    if (i.de !== yo || nuevo.invitaciones.some((n) => n.id === i.id)) continue;
    // Si ha entrado en mi conversación, ya se dice que se suma
    if (!miAhora?.miembros.includes(i.para)) avisa('conversaciones', `${nombreDe(i.para)} no ha aceptado la invitación.`);
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

  const forma = (p: SalaParticipante) => nombreMano(p.formaMano).toLocaleLowerCase('es');
  // Manos levantadas (las propias las avisa quien la levanta).
  for (const p of nuevo.participantes) {
    const previo = antes.get(p.id);
    if (!previo || p.id === yo || previo.manoLevantada === p.manoLevantada) continue;
    // Bajarla por levantarse del asiento no se dice (ya se dice que se levanta), ni
    // al contarse su voto (se baja sola; ya se dice que vota).
    if (!p.manoLevantada && p.rol !== 'jugador') continue;
    const votoContado = (() => {
      const v = nuevo.nominacion?.votacion;
      const pasoAntes = anterior.nominacion?.votacion?.paso ?? 0;
      return !!v && v.orden.slice(pasoAntes, v.paso).some((id) => nuevo.asientos.find((a) => a.id === id)?.ocupante === p.id);
    })();
    if (!p.manoLevantada && votoContado) continue;
    avisa('manos', p.manoLevantada ? `${p.nombre} levanta la mano (${forma(p)}).` : `${p.nombre} baja la mano.`);
  }
  // Cambio de forma con la mano levantada (con ella bajada no se ve).
  for (const p of nuevo.participantes) {
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
  for (const a of nuevo.asientos) {
    const previo = antesAsiento.get(a.id);
    if (!previo || cambioFase) continue;
    const q = quien(nuevo, a.id);
    if (previo.muerto !== a.muerto) {
      if (q === null) avisa('muertes', a.muerto ? 'Has muerto.' : 'Has revivido.');
      else avisa('muertes', `${mayuscula(q)} ha ${a.muerto ? 'muerto' : 'revivido'}.`);
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
    const necesarios = ` ${hacenFalta(nomAhora.votosNecesarios)}.`;
    if (nomAhora.desde === nomAhora.hasta) {
      avisa('nominaciones', `${sujeto} se nomina.${necesarios}`);
    } else {
      const objeto = nominacionDe(nuevo, nomAhora.hasta).replace(/^el /, 'al ');
      avisa('nominaciones', `${sujeto} nomina ${objeto.startsWith('al ') ? objeto : `a ${objeto}`}.${necesarios}`);
    }
  } else if (nomAhora && nomAntes && nomAhora.votosNecesarios !== nomAntes.votosNecesarios) {
    // La misma nominación, pero ahora hacen falta otros votos (lo cambia el narrador, o muere alguien)
    avisa('nominaciones', `Ahora ${hacenFalta(nomAhora.votosNecesarios).toLocaleLowerCase('es')}.`);
  } else if (nomAntes && !nomAhora && !seMarca && !cambioFase && !nuevo.asientos.some((a) => antesAsiento.get(a.id)?.marcado && !a.marcado)) {
    // Si se ha cerrado al poner o quitar la calavera, ya se ha dicho eso.
    avisa('nominaciones', 'Nominación cerrada.');
  }
  const votAntes = nomAntes?.votacion;
  const votAhora = nomAhora?.votacion;
  if (votAhora && !votAntes) avisa('resultadoVotacion', 'Empieza la votación.');
  // Cada ficha por la que pasa la aguja: su nombre, y si vota, el total de votos.
  // (Quien use lector pondrá una velocidad de agujas que le dé tiempo a oírlo.)
  if (votAhora) {
    const desdePaso = votAntes ? votAntes.paso : 0;
    for (const id of votAhora.orden.slice(desdePaso, votAhora.paso)) {
      const nombre = mayuscula(nominacionDe(nuevo, id));
      const resultado = votAhora.resultados[id];
      avisa('votoAVoto', typeof resultado === 'number' ? `${nombre}, ${resultado}.` : `${nombre}.`);
    }
  }
  if (votAhora?.terminada && !votAntes?.terminada) {
    avisa('resultadoVotacion', `Votación terminada: ${votAhora.votos === 1 ? '1 voto' : `${votAhora.votos} votos`}.`);
  }
  if (nomAhora?.cuentaAtrasFin && nomAhora.cuentaAtrasFin !== nomAntes?.cuentaAtrasFin) {
    avisa('cuentaAtras', 'Cuenta atrás.');
  }

  return avisos;
}
