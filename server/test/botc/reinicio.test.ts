import { afterEach, describe, expect, it } from 'vitest';
import { MemoriaPartidaEnCurso } from '../../src/repositories/PartidaEnCursoRepository';
import { VERSION_PARTIDA_GUARDADA } from '../../src/services/botc/puertos';
import { Arnes } from './arnes';
import { guionTroubleBrewing } from './guionDePrueba';

/**
 * La partida sobrevive a un reinicio del servidor: se guarda tras cada cambio y,
 * al arrancar otra vez (otro arnés con la misma base de datos), se recupera; cada
 * cuenta vuelve a su asiento o a narrar al entrar.
 */

let arnes: Arnes[] = [];
afterEach(async () => {
  await Promise.all(arnes.map((a) => a.cerrar()));
  arnes = [];
});

/** Un servidor con esa base de datos. */
const servidor = async (partidaEnCurso: MemoriaPartidaEnCurso, cambios: Parameters<typeof Arnes.crear>[0] = {}) => {
  const a = await Arnes.crear({ partidaEnCurso, ...cambios });
  arnes.push(a);
  return a;
};

describe('reinicio del servidor', () => {
  it('la partida vuelve como estaba y cada cuenta a su sitio; los invitados, no', async () => {
    const bd = new MemoriaPartidaEnCurso();
    const antes = await servidor(bd);
    const nora = await antes.entrar('Nora', { cuenta: 'nora' });
    const ana = await antes.entrar('Ana', { cuenta: 'ana' });
    const invitada = await antes.entrar('Iris');
    await antes.accion(nora, 'sala:hacerseNarrador');
    await antes.hacer(nora, 'preparacion:guion', { predeterminado: 'prueba' });
    const asiento = (i: number) => nora.estado.plaza[i].id;
    await antes.accion(ana, 'sala:sentarse', { jugadorId: asiento(0) });
    await antes.accion(invitada, 'sala:sentarse', { jugadorId: asiento(1) });
    await antes.hacer(nora, 'grimorio:personaje', { jugadorId: asiento(0), personajeId: 'chef' });
    await antes.hacer(nora, 'fase:noche');
    await antes.hacer(nora, 'grimorio:vida', { jugadorId: asiento(0), muerto: true });
    await antes.hacer(nora, 'fase:amanecer');
    const plaza = nora.estado.plaza.map((a) => a.id);
    const diario = antes.juego.partida.registro.hechos();
    await antes.servicio.guardarAhora();

    // Se reinicia: otro servidor con la misma base de datos
    const despues = await servidor(bd);
    expect(await despues.servicio.recuperar()).toBe(true);
    const { partida } = despues.juego;
    expect(partida.fases.actual()).toMatchObject({ momento: 'dia', numero: 1 });
    expect(partida.plaza().map((a) => a.id)).toEqual(plaza);
    // Murió de noche y no se ha anunciado: sigue pendiente, como antes
    expect(partida.plaza()[0]).toMatchObject({ personaje: 'chef', muertePendiente: true });
    expect(partida.guion.actual()?.nombre).toBe('Guion de prueba');
    expect(partida.registro.hechos()).toEqual(diario);
    // Lo de antes del reinicio no se puede deshacer
    expect(partida.historia.ultimo()).toBeNull();

    // Ana y Nora vuelven con su cuenta: a su asiento y a narrar; la invitada no recupera el suyo
    const ana2 = await despues.entrar('Ana', { cuenta: 'ana' });
    const nora2 = await despues.entrar('Nora', { cuenta: 'nora' });
    await despues.entrar('Iris');
    await nora2.esperarQue((e) => e.plaza[0].participanteId === ana2.id);
    expect(nora2.estado.participantes.find((p) => p.id === nora2.id)?.rol).toBe('narrador');
    expect(nora2.estado.plaza[1].participanteId).toBeNull();
    expect(nora2.estado.acciones).toContain('fase:noche');
  });

  it('sin nada guardado, o de otra versión, empieza de cero', async () => {
    const bd = new MemoriaPartidaEnCurso();
    expect(await (await servidor(bd)).servicio.recuperar()).toBe(false);
    await bd.guardar(VERSION_PARTIDA_GUARDADA + 1, {});
    expect(await (await servidor(bd)).servicio.recuperar()).toBe(false);
  });

  it('con narrador virtual, vuelve y retoma su etapa; quien lo añadió puede quitarlo al volver', async () => {
    const bd = new MemoriaPartidaEnCurso();
    const tb = () => guionTroubleBrewing();
    const conTb = { guiones: { guionPredeterminado: async () => tb(), importar: async () => tb() } };
    const antes = await servidor(bd, conTb);
    const ana = await antes.entrar('Ana', { cuenta: 'ana' });
    await antes.hacer(ana, 'narradorVirtual:anadir', { narrador: 'tontoYTu', guion: 'troublebrewing', jugadores: 7 });
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    await antes.servicio.guardarAhora();

    const despues = await servidor(bd, conTb);
    expect(await despues.servicio.recuperar()).toBe(true);
    expect(despues.juego.narrador.actual()).toMatchObject({ id: 'tontoYTu', etapa: 'esperandoJugadores', guion: 'troublebrewing', jugadores: 7 });
    const ana2 = await despues.entrar('Ana', { cuenta: 'ana' });
    await ana2.esperarQue((e) => e.narradorVirtual?.creador === ana2.id);
    expect(ana2.estado.acciones).toContain('narradorVirtual:quitar');
  });
});
