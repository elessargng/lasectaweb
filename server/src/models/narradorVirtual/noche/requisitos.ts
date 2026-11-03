import type { HabilidadNoche } from '../../partida/DespertarGuiado';
import { NUM_FAROLES } from '../../compartido/jugador';
import type { ContextoEtapa } from '../etapas/Etapa';
import { describirPersonaje, opcionesDeAsientos } from '../grimorio';
import { indiceRecordatorio, tipoReal } from '../plazaDeJuego';
import { identidadDe } from '../../partida/Grimorio';
import type { Jugador } from '../../partida/Jugador';

/**
 * Lo que falta en el grimorio antes de despertar a alguien, como lo pondría el
 * narrador (con lo que decida su estrategia). Lo que no le toca poner (el «Is The
 * Demon» de la Mujer Escarlata, el «Die Today» del Enterrador sin ejecución), no se
 * pone: ese no despierta.
 */

/** El tipo del personaje que enseña cada recordatorio de «uno de estos dos es…» (Lavandera, Bibliotecario, Investigador). */
const TIPO_DEL_CORRECTO: Record<string, string> = { townsfolk: 'townsfolk', outsider: 'outsider', minion: 'minion' };

/** Pone un recordatorio de un personaje (por su texto) en un asiento. */
export async function ponerRecordatorio(ctx: ContextoEtapa, jugadorId: string, personaje: string, texto: string): Promise<boolean> {
  const indice = indiceRecordatorio(ctx.juego, personaje, texto);
  if (indice < 0) return false;
  return (await ctx.plaza.ponerRecordatorio(jugadorId, personaje, indice)).ok;
}

/**
 * Los faroles del demonio, si faltan: buenos que no están en juego, de uno en
 * uno, con un forastero como mucho (al azar, los forasteros pesan entre todos lo
 * que un aldeano). Lo decide su estrategia.
 */
export async function ponerFaroles(ctx: ContextoEtapa): Promise<boolean> {
  const { partida } = ctx.juego;
  if (partida.faroles.faroles().filter(Boolean).length >= NUM_FAROLES) return false;
  const enJuego = new Set(partida.plaza().flatMap((a) => [a.personaje, identidadDe(a)]).filter(Boolean));
  const libres = (partida.guion.actual()?.personajes ?? []).filter((p) => (p.tipo === 'townsfolk' || p.tipo === 'outsider') && !enJuego.has(p.id));
  const forasteros = libres.filter((p) => p.tipo === 'outsider').length;
  const faroles: string[] = [];
  for (let i = 0; i < NUM_FAROLES; i++) {
    const conForastero = faroles.some((f) => partida.guion.personaje(f)?.tipo === 'outsider');
    const opciones = libres
      .filter((p) => !faroles.includes(p.id) && !(conForastero && p.tipo === 'outsider'))
      .map((p) => ({
        clave: p.id,
        descripcion: describirPersonaje(ctx.juego, p.id),
        valor: p.id,
        ...(p.tipo === 'outsider' ? { rasgos: ['forastero' as const], peso: 1 / forasteros } : {}),
      }));
    if (!opciones.length) break;
    faroles.push(
      await ctx.decidir({
        motivo: 'farol',
        pregunta: `El farol ${i + 1} del demonio: un personaje bueno que no está en juego por el que hacerse pasar.`,
        opciones,
      }),
    );
  }
  for (const [posicion, personajeId] of faroles.entries()) await ctx.plaza.prepararFarol(posicion, personajeId);
  return faroles.length > 0;
}

/** Le despierta y le dice «cero» (no hay nadie que enseñarle). La fila no queda hecha: no hace falta. */
async function decirCero(ctx: ContextoEtapa, jugadorId: string): Promise<false> {
  if ((await ctx.plaza.despertar(jugadorId)).ok) {
    await ctx.plaza.enviarDespertar(jugadorId, { ficha: 'cero' });
  }
  return false;
}

/**
 * Cumple lo que falta de una fila del orden de noche. Devuelve si ha puesto algo
 * (y entonces se vuelve a preparar) o false si no le toca (esa fila no se despierta).
 */
export async function cumplirRequisitos(ctx: ContextoEtapa, fila: HabilidadNoche): Promise<boolean> {
  const { partida } = ctx.juego;
  let puesto = false;
  const faltan = fila.avisos.flatMap((a) => (a.tipo === 'faltaRecordatorio' ? [a] : []));
  if (fila.avisos.some((a) => a.tipo === 'faltanFaroles')) puesto = (await ponerFaroles(ctx)) || puesto;
  const jugadores = partida.plaza();
  const yo = jugadores.find((a) => a.id === fila.jugador);
  const otros = jugadores.filter((a) => a.id !== fila.jugador);
  // El correcto antes que el «Wrong» (que no puede caer en el mismo)
  let correcto: Jugador | null = null;
  for (const { personaje, texto } of [...faltan].sort((a, b) => Number(a.texto === 'Wrong') - Number(b.texto === 'Wrong'))) {
    const clave = texto.toLowerCase();
    let elegido: Jugador | null = null;
    if (clave === 'red herring') {
      // La Pitonisa: un bueno cualquiera (puede ser ella)
      const buenos = jugadores.filter((a) => partida.grimorio.alineamiento(a) !== 'malvado');
      elegido = buenos.length
        ? await ctx.decidir({
            motivo: 'redHerring',
            pregunta: 'El Red Herring de la Pitonisa: un jugador bueno que le saldrá como el demonio.',
            opciones: opcionesDeAsientos(ctx.juego, buenos),
          })
        : null;
    } else if (TIPO_DEL_CORRECTO[clave]) {
      const deEseTipo = otros.filter((a) => tipoReal(ctx.juego, a) === TIPO_DEL_CORRECTO[clave]);
      // Nadie de ese tipo (el Bibliotecario sin forasteros, aunque haya un Espía): «cero»
      if (!deEseTipo.length && yo) return decirCero(ctx, yo.id);
      elegido = await ctx.decidir({
        motivo: 'correcto',
        pregunta: `El jugador de verdad que se le enseña a ${describirPersonaje(ctx.juego, personaje)} («${texto}»).`,
        opciones: opcionesDeAsientos(ctx.juego, deEseTipo),
      });
      correcto = elegido;
    } else if (clave === 'wrong') {
      const posibles = otros.filter((a) => a.id !== correcto?.id && !a.recordatorios.some((r) => r.personaje === personaje));
      elegido = posibles.length
        ? await ctx.decidir({
            motivo: 'incorrecto',
            pregunta: `El otro jugador que se le enseña a ${describirPersonaje(ctx.juego, personaje)}, que no es ese personaje («Wrong»).`,
            opciones: opcionesDeAsientos(ctx.juego, posibles),
          })
        : null;
    }
    if (!elegido || !yo) return puesto;
    puesto = (await ponerRecordatorio(ctx, elegido.id, personaje, texto)) || puesto;
  }
  return puesto;
}
