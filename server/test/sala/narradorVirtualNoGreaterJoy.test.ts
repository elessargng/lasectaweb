import { afterEach, describe, expect, it } from 'vitest';
import { Arnes, type Cliente } from './arnes';
import { guionNoGreaterJoy, guionTroubleBrewing } from './guionDePrueba';

/** El reloj del narrador virtual, mil veces más rápido. */
const sinEsperas = {
  programar: (ms: number, hacer: () => void) => {
    const t = setTimeout(hacer, ms / 1000);
    return () => clearTimeout(t);
  },
};

const conGuiones = () =>
  Arnes.crear({
    guiones: {
      guionPredeterminado: async (id: string) => (id === 'nogreaterjoy' ? guionNoGreaterJoy() : guionTroubleBrewing()),
      importar: async () => guionNoGreaterJoy(),
    },
    relojNarradorVirtual: sinEsperas,
  });

const NGJ = { narrador: 'tontoYTu', guion: 'nogreaterjoy', jugadores: 5 };
const HAY_DEMONIO = { tipo: 'enJuego', quien: { por: 'tipo', tipo: 'demon' } };

describe('narrador virtual con No Greater Joy', () => {
  let arnes: Arnes;
  afterEach(() => arnes?.cerrar());

  const entran = async (n: number): Promise<Cliente[]> => {
    const clientes: Cliente[] = [];
    for (let i = 1; i <= n; i++) clientes.push(await arnes.entrar(`Jugador${i}`, { cuenta: `jugador${i}` }));
    return clientes;
  };

  it('es para 5 o 6 jugadores; Trouble Brewing, para 7 o más', async () => {
    arnes = await conGuiones();
    const [ana] = await entran(1);
    expect((await arnes.pedir(ana, 'narradorVirtual:anadir', { ...NGJ, jugadores: 7 })).ok).toBe(false);
    expect((await arnes.pedir(ana, 'narradorVirtual:anadir', { ...NGJ, guion: 'troublebrewing', jugadores: 6 })).ok).toBe(false);
    expect((await arnes.pedir(ana, 'narradorVirtual:anadir', { ...NGJ, jugadores: 4 })).ok).toBe(false);
  });

  it('con 5 o 6 jugadores reparte personajes del guion: un demonio, un esbirro y el resto buenos, sin repetir', async () => {
    for (const n of [5, 6]) {
      arnes = await conGuiones();
      const jugadores = await entran(n);
      const [ana] = jugadores;
      await arnes.hacer(ana, 'narradorVirtual:anadir', { ...NGJ, jugadores: n });
      await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
      for (const [i, c] of jugadores.entries()) await arnes.accion(c, 'sala:sentarse', { jugadorId: c.estado.plaza[i].id });
      for (const c of jugadores) await c.esperarQue((e) => !!e.plaza.find((a) => a.participanteId === e.yo)?.personaje);
      const tipos = new Map(guionNoGreaterJoy().personajes.map((p) => [p.id, p.tipo]));
      // Cada uno ve el suyo (el Borracho, el aldeano que cree ser)
      const repartidos = jugadores.map((c) => c.miAsiento!.personaje!);
      expect(new Set(repartidos).size).toBe(n);
      for (const id of repartidos) expect(tipos.has(id)).toBe(true);
      expect(repartidos.filter((id) => tipos.get(id) === 'demon')).toEqual(['imp']);
      expect(repartidos.filter((id) => tipos.get(id) === 'minion')).toHaveLength(1);
      await arnes.cerrar();
    }
  });

  /** Una partida de 5 jugada hasta las nominaciones del primer día. */
  const hastaElDia = async () => {
    arnes = await conGuiones();
    const jugadores = await entran(5);
    const [ana] = jugadores;
    await arnes.hacer(ana, 'narradorVirtual:anadir', NGJ);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'esperandoJugadores');
    for (const [i, c] of jugadores.entries()) await arnes.accion(c, 'sala:sentarse', { jugadorId: c.estado.plaza[i].id });
    let seguir = true;
    const contestar = async (c: Cliente) => {
      while (seguir) {
        const ultimo = c.estado.despertares[0]?.mensajes.slice(-1)[0];
        if (ultimo?.autor === 'narrador' && ultimo.eleccion) {
          const { cantidad, puedeElegirse } = ultimo.eleccion;
          const elegidos = c.estado.plaza.filter((a) => puedeElegirse || a.participanteId !== c.id).slice(0, cantidad).map((a) => a.id);
          await arnes.pedir(c, 'noche:enviar', { ficha: 'jugador', jugadores: elegidos });
        } else if (ultimo?.autor === 'narrador') {
          await arnes.pedir(c, 'noche:enviar', { ficha: 'entendido' });
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    const contestando = jugadores.map(contestar);
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'nominaciones', 5000);
    seguir = false;
    await Promise.all(contestando);
    return jugadores;
  };

  it('es una teensy: el demonio no recibe faroles (el narrador ni los prepara)', async () => {
    await hastaElDia();
    const vera = await arnes.entrar('Vera');
    expect(vera.estado.faroles.every((f) => f === null)).toBe(true);
  }, 20_000);

  it('de día, cualquiera vivo hace una vez la pregunta del Artista: a quien no lo es ni lo cree, de broma', async () => {
    const jugadores = await hastaElDia();
    // Su ficha: la del Artista la lleva el Artista o el Borracho que cree serlo
    const artista = jugadores.find((c) => c.miAsiento?.personaje === 'artist');
    const otro = jugadores.find((c) => c.miAsiento?.personaje !== 'artist')!;
    expect(otro.estado.acciones).toContain('declarar:artista');
    // No Greater Joy no trae Exterminador: nadie puede decir serlo
    expect(otro.estado.acciones).not.toContain('declarar:exterminar');
    expect(await arnes.pedir(otro, 'declarar:exterminar', { jugadorId: artista?.miAsiento?.id ?? otro.miAsiento!.id })).toEqual({ ok: false, error: 'Ese personaje no está en este guion.' });
    expect((await arnes.pedir(otro, 'declarar:artista', { pregunta: { tipo: 'nada' } })).ok).toBe(false);
    expect(await arnes.pedir(otro, 'declarar:artista', { texto: '¿Lleva gafas el demonio?' })).toEqual({ ok: true, valor: 'broma' });
    expect(otro.estado.acciones).not.toContain('declarar:artista');
    expect((await arnes.pedir(otro, 'declarar:artista', { pregunta: HAY_DEMONIO })).ok).toBe(false);
    if (!artista) return;
    // Libre: «Tonto y tú» no la entiende, no se gasta
    expect(await arnes.pedir(artista, 'declarar:artista', { texto: '¿Lleva gafas el demonio?' })).toEqual({ ok: true, valor: 'reformular' });
    expect(artista.estado.acciones).toContain('declarar:artista');
    // Montada: sí o no (al de verdad, sano: en este guion nadie envenena, la verdad), y se gasta
    const r = await arnes.pedir(artista, 'declarar:artista', { pregunta: HAY_DEMONIO });
    expect(r.ok && ['si', 'no'].includes(r.valor ?? '')).toBe(true);
    expect(artista.estado.acciones).not.toContain('declarar:artista');
  }, 20_000);

  it('el ejecutado puede declararse Patoso hasta el amanecer: elige a un vivo y el narrador lo anuncia', async () => {
    const jugadores = await hastaElDia();
    const [ana] = jugadores;
    // Se ejecuta a uno que no es el demonio (si no, se acabaría)
    const nominado = jugadores.find((c) => c !== ana && c.miAsiento?.personaje !== 'imp')!;
    const voces: string[] = [];
    ana.socket.on('sala:voz', ({ texto }: { texto: string }) => voces.push(texto));
    await arnes.hacer(ana, 'narradorVirtual:nominar', { jugadorId: nominado.miAsiento!.id });
    await arnes.hacer(ana, 'narradorVirtual:defensa');
    await nominado.esperarQue((e) => e.narradorVirtual?.turno === 'defensa');
    await arnes.hacer(nominado, 'narradorVirtual:voto');
    await ana.esperarQue((e) => !!e.nominacion?.votacion, 6000);
    for (const c of jugadores) await arnes.intentar(c, 'sala:levantarMano', { levantada: true });
    await ana.esperarQue((e) => !e.nominacion && e.calavera?.jugadorId === nominado.miAsiento!.id, 15000);
    expect(nominado.estado.acciones).not.toContain('declarar:patoso');
    for (const c of jugadores) await arnes.pedir(c, 'narradorVirtual:listo');
    await ana.esperarQue((e) => e.narradorVirtual?.etapa === 'noche', 5000);
    await nominado.esperarQue((e) => e.acciones.includes('declarar:patoso'));
    // Solo él, y solo a un vivo que no sea él
    expect(ana.estado.acciones).not.toContain('declarar:patoso');
    expect((await arnes.pedir(nominado, 'declarar:patoso', { jugadorId: nominado.miAsiento!.id })).ok).toBe(false);
    const elegido = jugadores.find((c) => c !== nominado)!;
    await arnes.hacer(nominado, 'declarar:patoso', { jugadorId: elegido.miAsiento!.id });
    expect(nominado.estado.acciones).not.toContain('declarar:patoso');
    await ana.esperarQue((e) => e.narradorVirtual?.frase === 'La partida continúa.' || e.narradorVirtual?.etapa === 'revelando', 5000);
    expect(voces).toContain(`${nominado.nombre} se declara patoso y elige a ${elegido.nombre} y…`);
    // Solo gana el mal si es el Patoso de verdad y elige a un malvado
    const ganaElMal = nominado.miAsiento?.personaje === 'klutz' && ['imp', 'scarletwoman', 'baron'].includes(elegido.miAsiento?.personaje ?? '');
    expect(ana.estado.narradorVirtual?.etapa === 'revelando').toBe(ganaElMal);
  }, 30_000);
});
