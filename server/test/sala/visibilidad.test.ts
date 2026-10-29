import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';
import { BOLSA_DE_SIETE } from './guionDePrueba';

/**
 * Lo que le llega a cada uno por el socket: el grimorio es secreto y cada papel
 * (narrador, jugador, visitante, visitante con el grimorio) ve una parte. Fija el
 * comportamiento de hoy para poder sacar ese filtrado de salaSocket sin cambiarlo.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;
let bea: Cliente;
let vera: Cliente;

/** El asiento i como lo ve un cliente. */
const asiento = (c: Cliente, i: number) => c.estado.asientos[i];
const idAsiento = (i: number) => narradora.estado.asientos[i].id;

/** Mete en la bolsa los 7 personajes de una partida de 7 y los reparte. */
async function repartir() {
  for (const personajeId of BOLSA_DE_SIETE) await arnes.accion(narradora, 'narrador:bolsa', { personajeId });
  await arnes.accion(narradora, 'narrador:asignarPersonajes');
}

const alDia = async () => {
  await arnes.accion(narradora, 'narrador:irANoche');
  await arnes.accion(narradora, 'narrador:amanecer');
};

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  bea = await arnes.entrar('Bea');
  vera = await arnes.entrar('Vera');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
  await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'prueba' });
  await arnes.accion(ana, 'sala:sentarse', { asientoId: idAsiento(0) });
  await arnes.accion(bea, 'sala:sentarse', { asientoId: idAsiento(1) });
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('lo que ve cada uno', () => {
  it('cada uno sabe quién es y su papel', () => {
    const rol = (c: Cliente) => c.estado.participantes.find((p) => p.id === c.id)?.rol;
    expect([rol(narradora), rol(ana), rol(bea), rol(vera)]).toEqual(['narrador', 'jugador', 'jugador', 'visitante']);
  });

  describe('los personajes de las fichas', () => {
    beforeEach(repartir);

    it('la narradora los ve todos', () => {
      expect(narradora.estado.asientos.every((a) => a.personaje !== null)).toBe(true);
    });

    it('un jugador ve el suyo y ninguno de los demás', () => {
      expect(ana.miAsiento?.personaje).toBe(asiento(narradora, 0).personaje);
      expect(ana.estado.asientos.filter((a) => a.personaje !== null)).toHaveLength(1);
    });

    it('un visitante no ve ninguno', () => {
      expect(vera.estado.asientos.every((a) => a.personaje === null && a.alineamiento === null)).toBe(true);
    });

    it('un visitante con el grimorio concedido los ve todos', async () => {
      await arnes.accion(vera, 'sala:solicitarGrimorio');
      await arnes.accion(narradora, 'narrador:accesoGrimorio', { participanteId: vera.id, conceder: true });
      expect(vera.estado.asientos).toEqual(narradora.estado.asientos);
    });

    it('el jugador no se entera de que la narradora le cambia el personaje', async () => {
      const entregado = ana.miAsiento?.personaje;
      const otro = BOLSA_DE_SIETE.find((id) => id !== entregado)!;
      await arnes.accion(narradora, 'narrador:cambiarPersonaje', { asientoId: idAsiento(0), personajeId: otro });
      expect(asiento(narradora, 0).personaje).toBe(otro);
      expect(ana.miAsiento?.personaje).toBe(entregado);
    });

    it('los recordatorios y la nota no los ve el jugador, ni en su ficha', async () => {
      await arnes.accion(narradora, 'narrador:ponerRecordatorio', { asientoId: idAsiento(0), personajeId: 'poisoner', indice: 0 });
      await arnes.accion(narradora, 'narrador:escribirNota', { asientoId: idAsiento(0), texto: 'Sospechosa' });
      expect(asiento(narradora, 0).recordatorios).toHaveLength(1);
      expect(asiento(narradora, 0).nota).toBe('Sospechosa');
      expect(ana.miAsiento).toMatchObject({ recordatorios: [], nota: null });
    });

    it('al revelar el grimorio, todos ven las fichas reveladas', async () => {
      await arnes.accion(narradora, 'narrador:revelarGrimorio', { ganador: 'bueno' });
      await arnes.accion(narradora, 'narrador:revelarFicha', { asientoId: idAsiento(1) });
      expect(asiento(vera, 1).personaje).toBe(asiento(narradora, 1).personaje);
      expect(asiento(vera, 2).personaje).toBeNull();
    });
  });

  it('los viajeros son públicos', async () => {
    await arnes.accion(narradora, 'narrador:cambiarPersonaje', { asientoId: idAsiento(5), personajeId: 'voudon' });
    expect(asiento(ana, 5).personaje).toBe('voudon');
    expect(asiento(vera, 5).personaje).toBe('voudon');
  });

  it('con el Gardener, nadie ve su personaje hasta que la narradora los entrega', async () => {
    await arnes.accion(narradora, 'narrador:npc', { personajeId: 'gardener' });
    await repartir();
    expect(ana.estado.fichasRetenidas).toBe(true);
    expect(ana.miAsiento?.personaje).toBeNull();
    await arnes.accion(narradora, 'narrador:entregarFichas');
    expect(ana.miAsiento?.personaje).toBe(asiento(narradora, 0).personaje);
  });

  it('con Tor, el jugador no sabe quién es hasta que muere', async () => {
    await arnes.accion(narradora, 'narrador:npc', { personajeId: 'tor' });
    await repartir();
    expect(ana.miAsiento?.personaje).toBeNull();
    await alDia();
    await arnes.accion(narradora, 'narrador:cambiarVida', { asientoId: idAsiento(0), muerto: true });
    expect(ana.miAsiento?.personaje).toBe(asiento(narradora, 0).personaje);
  });

  it('la bolsa, el registro de votaciones y los recordatorios de noche son solo de la narradora', async () => {
    await repartir();
    await alDia();
    await arnes.accion(narradora, 'narrador:nominar', { desde: idAsiento(0), hasta: idAsiento(1) });
    await arnes.accion(narradora, 'narrador:recordatorio', { id: 'imp', activo: false });
    expect(narradora.estado.bolsa).toHaveLength(7);
    expect(narradora.estado.votaciones).toHaveLength(1);
    expect(narradora.estado.recordatoriosNoche).toEqual({ imp: false });
    for (const c of [ana, vera]) {
      expect(c.estado.bolsa).toEqual([]);
      expect(c.estado.votaciones).toEqual([]);
      expect(c.estado.recordatoriosNoche).toEqual({});
    }
  });

  it('los faroles de la narradora los ven ella y los visitantes, no los jugadores', async () => {
    await arnes.accion(narradora, 'narrador:farol', { posicion: 0, personajeId: 'chef' });
    expect(narradora.estado.faroles[0]).toBe('chef');
    expect(vera.estado.faroles[0]).toBe('chef');
    expect(ana.estado.faroles).toEqual([null, null, null]);
  });

  it('el farol que usa un jugador: solo uno de los suyos; lo ven él y la narradora, no los demás', async () => {
    await arnes.accion(ana, 'jugador:farol', { posicion: 0, personajeId: 'chef' });
    await arnes.accion(ana, 'jugador:farol', { posicion: 1, personajeId: 'empath' });
    expect((await arnes.intentar(ana, 'jugador:usarFarol', { personajeId: 'monk' })).ok).toBe(false);
    await arnes.accion(ana, 'jugador:usarFarol', { personajeId: 'empath' });
    expect(asiento(ana, 0).farolEnUso).toBe('empath');
    expect(asiento(narradora, 0).farolEnUso).toBe('empath');
    expect(asiento(bea, 0).farolEnUso).toBeNull();
    // Al quitarlo de sus faroles, deja de usarlo
    await arnes.accion(ana, 'jugador:farol', { posicion: 1, personajeId: null });
    expect(asiento(ana, 0).farolEnUso).toBeNull();
    // Y puede dejar de usar uno sin quitarlo
    await arnes.accion(ana, 'jugador:usarFarol', { personajeId: 'chef' });
    await arnes.accion(ana, 'jugador:usarFarol', { personajeId: null });
    expect(asiento(narradora, 0).farolEnUso).toBeNull();
  });

  it('la muerte pendiente de la noche solo la ve quien ve el grimorio', async () => {
    await arnes.accion(narradora, 'narrador:irANoche');
    await arnes.accion(narradora, 'narrador:cambiarVida', { asientoId: idAsiento(1), muerto: true });
    expect(asiento(narradora, 1).muertePendiente).toBe(true);
    expect(asiento(bea, 1).muertePendiente).toBe(false);
    expect(asiento(ana, 1).muertePendiente).toBe(false);
  });

  it('un despertar lo ven la narradora y el jugador despierto, nadie más', async () => {
    await arnes.accion(narradora, 'narrador:irANoche');
    await arnes.accion(narradora, 'narrador:despertar', { asientoId: idAsiento(0) });
    expect(narradora.estado.despertares).toHaveLength(1);
    // El jugador no se entera hasta que la narradora le manda algo
    expect(ana.estado.despertares).toEqual([]);
    expect(ana.estado.acciones).not.toContain('despertar:enviar');
    await arnes.accion(narradora, 'despertar:enviar', { asientoId: idAsiento(0), ficha: 'entendido' });
    expect(ana.estado.despertares).toHaveLength(1);
    expect(bea.estado.despertares).toEqual([]);
    expect(vera.estado.despertares).toEqual([]);
  });

  it('la narradora manda lo mismo a varios: despierta a los que aún no lo estaban', async () => {
    await arnes.accion(narradora, 'narrador:irANoche');
    await arnes.accion(narradora, 'narrador:despertar', { asientoId: idAsiento(0) });
    await arnes.accion(narradora, 'despertar:enviar', { asientoIds: [idAsiento(0), idAsiento(1)], tarjeta: 'habilidad' });
    expect(narradora.estado.despertares.map((d) => d.asiento)).toEqual([idAsiento(0), idAsiento(1)]);
    for (const c of [ana, bea]) expect(c.estado.despertares[0].mensajes).toMatchObject([{ autor: 'narrador', tarjeta: 'habilidad' }]);
    expect(vera.estado.despertares).toEqual([]);
    // A uno solo, solo en su despertar
    const cerrado = await arnes.intentar(narradora, 'despertar:enviar', { asientoId: idAsiento(2), ficha: 'si' });
    expect(cerrado).toEqual({ ok: false, error: 'Ese despertar ya no está abierto.' });
  });

  it('de noche, el señalamiento solo lo ven la narradora y quien señala', async () => {
    await arnes.accion(narradora, 'narrador:irANoche');
    await arnes.accion(narradora, 'narrador:senalamiento', { mensaje: '', segundos: null, senaladores: [idAsiento(0)], objetivos: [] });
    expect(narradora.estado.senalamiento).not.toBeNull();
    expect(ana.estado.senalamiento).not.toBeNull();
    expect(bea.estado.senalamiento).toBeNull();
    expect(vera.estado.senalamiento).toBeNull();
  });

  it('en una votación secreta (Organ Grinder), quien no ve el grimorio no ve las manos ni el recuento', async () => {
    await arnes.accion(narradora, 'narrador:cambiarPersonaje', { asientoId: idAsiento(4), personajeId: 'organgrinder' });
    await alDia();
    await arnes.accion(narradora, 'narrador:nominar', { desde: idAsiento(0), hasta: idAsiento(1) });
    await arnes.accion(ana, 'sala:levantarMano', { levantada: true });
    const manoDeAna = (c: Cliente) => c.estado.participantes.find((p) => p.id === ana.id)?.manoLevantada;
    expect(manoDeAna(narradora)).toBe(true);
    expect(manoDeAna(ana)).toBe(true);
    expect(manoDeAna(bea)).toBe(false);
    expect(narradora.estado.nominacion).toMatchObject({ privada: true, votosNecesarios: 4 });
    expect(bea.estado.nominacion).toMatchObject({ privada: true, votosNecesarios: 0, votosNecesariosPorDefecto: 0 });
  });

  it('las acciones que llegan dependen del papel', () => {
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['narrador:irANoche', 'narrador:bolsa']));
    expect(ana.estado.acciones).toContain('sala:levantarMano');
    expect(ana.estado.acciones.some((a) => a.startsWith('narrador:'))).toBe(false);
    expect(vera.estado.acciones).toEqual(expect.arrayContaining(['sala:sentarse', 'sala:solicitarGrimorio']));
    expect(vera.estado.acciones).not.toContain('sala:levantarMano');
  });
});

describe('permisos', () => {
  it('un jugador no puede hacer cosas de narrador', async () => {
    expect(await arnes.intentar(ana, 'narrador:irANoche')).toEqual({ ok: false, error: 'Solo un narrador puede hacer que anochezca.' });
  });

  it('no puede haber dos narradores por su cuenta', async () => {
    expect(await arnes.intentar(vera, 'sala:hacerseNarrador')).toEqual({ ok: false, error: 'La sala ya tiene narrador.' });
  });

  it('quien ha visto el grimorio no puede sentarse', async () => {
    await arnes.accion(vera, 'sala:solicitarGrimorio');
    await arnes.accion(narradora, 'narrador:accesoGrimorio', { participanteId: vera.id, conceder: true });
    const r = await arnes.intentar(vera, 'sala:sentarse', { asientoId: idAsiento(3) });
    expect(r).toEqual({ ok: false, error: 'Quien ha visto el grimorio del narrador no puede sentarse en la mesa.' });
  });

  it('una acción que no existe', async () => {
    expect(await arnes.intentar(ana, 'sala:volar')).toEqual({ ok: false, error: 'Acción desconocida.' });
  });
});
