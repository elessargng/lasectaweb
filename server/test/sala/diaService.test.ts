import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * El día por su socket (DiaController → DiaService → Partida y Nominaciones): quién
 * puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;
const nominar = (c: Cliente, desde: unknown, hasta: unknown) => arnes.pedir(c, 'dia:nominar', { desde, hasta });

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
  await arnes.hacer(narradora, 'preparacion:guion', { predeterminado: 'prueba' });
  await arnes.accion(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
});

afterEach(async () => {
  await arnes.cerrar();
});

const alDia = async () => {
  await arnes.hacer(narradora, 'fase:noche');
  await arnes.hacer(narradora, 'fase:amanecer');
};

describe('el día', () => {
  it('solo se nomina de día y solo un narrador; sin nominación, no se maneja', async () => {
    expect(await nominar(narradora, idAsiento(0), idAsiento(1))).toEqual({ ok: false, error: 'Solo se nomina de día.' });
    await alDia();
    expect(await nominar(ana, idAsiento(0), idAsiento(1))).toEqual({ ok: false, error: 'Solo un narrador puede abrir una nominación.' });
    expect(await arnes.pedir(narradora, 'dia:cerrarNominacion')).toEqual({ ok: false, error: 'No hay ninguna nominación abierta.' });
    expect(await arnes.pedir(narradora, 'dia:ejecutar', { jugadorId: idAsiento(1) })).toEqual({ ok: false, error: 'Nadie lleva la calavera.' });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['dia:nominar', 'dia:marcar', 'dia:darPalabra']));
    expect(narradora.estado.acciones).not.toContain('dia:cuentaAtras');
    expect(ana.estado.acciones.some((a) => a.startsWith('dia:'))).toBe(false);
  });

  it('nominar, los votos que hacen falta, la cuenta atrás y cerrar; lo que no se entiende ni llega al servicio', async () => {
    await alDia();
    expect(await nominar(narradora, idAsiento(0), 3)).toEqual({ ok: false, error: 'Ese asiento ya no existe.' });
    expect(await nominar(narradora, idAsiento(0), 'no-existe')).toEqual({ ok: false, error: 'Ese asiento ya no existe.' });
    expect(await nominar(narradora, idAsiento(0), idAsiento(1))).toEqual({ ok: true });
    expect(ana.estado.nominacion).toMatchObject({ desde: idAsiento(0), hasta: idAsiento(1) });

    expect(await arnes.pedir(narradora, 'dia:votosNecesarios', { votos: 8 })).toEqual({ ok: false, error: 'Los votos tienen que ser de 1 a 7.' });
    expect(await arnes.pedir(narradora, 'dia:votosNecesarios', { votos: '2' })).toEqual({ ok: false, error: 'Indica cuántos votos hacen falta.' });
    expect(await arnes.pedir(narradora, 'dia:votosNecesarios', { votos: 2 })).toEqual({ ok: true });
    expect(ana.estado.nominacion!.votosNecesarios).toBe(2);

    expect(await arnes.pedir(narradora, 'dia:cuentaAtras')).toEqual({ ok: true });
    expect(await arnes.pedir(narradora, 'dia:cuentaAtras')).toEqual({ ok: false, error: 'La cuenta atrás ya está en marcha.' });
    expect(await arnes.pedir(narradora, 'dia:reiniciarVotacion')).toEqual({ ok: true });
    expect(await arnes.pedir(narradora, 'dia:cerrarNominacion')).toEqual({ ok: true });
    expect(ana.estado.nominacion).toBeNull();
  });

  it('la calavera: marcar, desmarcar y ejecutar a quien la lleva', async () => {
    await alDia();
    await arnes.hacer(narradora, 'dia:nominar', { desde: idAsiento(0), hasta: idAsiento(1) });
    expect(await arnes.pedir(narradora, 'dia:marcar', { jugadorId: idAsiento(1), marcado: 'sí' })).toEqual({ ok: false, error: 'Estado desconocido.' });
    expect(await arnes.pedir(narradora, 'dia:marcar', { jugadorId: idAsiento(1), marcado: true })).toEqual({ ok: true });
    expect(ana.estado.calavera).toMatchObject({ jugadorId: idAsiento(1) });
    // Marcar desde la nominación la cierra
    expect(ana.estado.nominacion).toBeNull();
    expect(await arnes.pedir(narradora, 'dia:desmarcar')).toEqual({ ok: true });
    expect(ana.estado.calavera).toBeNull();

    await arnes.hacer(narradora, 'dia:marcar', { jugadorId: idAsiento(2), marcado: true, cerrarNominacion: false });
    expect(await arnes.pedir(narradora, 'dia:ejecutar', { jugadorId: idAsiento(3) })).toEqual({ ok: false, error: 'Solo se ejecuta a quien lleva la calavera.' });
    expect(await arnes.pedir(narradora, 'dia:ejecutar', { jugadorId: idAsiento(2) })).toEqual({ ok: true });
    expect(ana.estado.plaza[2].muerto).toBe(true);
  });

  it('ejecutar al último demonio no anochece: contesta que parece ganar el bueno', async () => {
    await arnes.hacer(narradora, 'grimorio:personaje', { jugadorId: idAsiento(1), personajeId: 'imp' });
    await arnes.hacer(narradora, 'grimorio:personaje', { jugadorId: idAsiento(2), personajeId: 'chef' });
    await alDia();
    const ejecutar = async (i: number) => {
      await arnes.hacer(narradora, 'dia:marcar', { jugadorId: idAsiento(i), marcado: true, cerrarNominacion: false });
      return arnes.pedir(narradora, 'dia:ejecutar', { jugadorId: idAsiento(i) });
    };
    // Con el demonio vivo, nada que proponer: anochece
    expect(await ejecutar(2)).toEqual({ ok: true });
    expect(ana.estado.fase.momento).toBe('noche');
    await arnes.hacer(narradora, 'fase:amanecer');
    expect(await ejecutar(1)).toEqual({ ok: true, valor: 'ganaBueno' });
    expect(ana.estado.fase.momento).toBe('dia');
  });

  it('dar la palabra, a alguien que está en la sala', async () => {
    await alDia();
    await arnes.hacer(narradora, 'dia:nominar', { desde: idAsiento(0), hasta: idAsiento(1) });
    expect(await arnes.pedir(narradora, 'dia:darPalabra', { participanteId: 'nadie' })).toEqual({ ok: false, error: 'Esa persona ya no está en la sala.' });
    expect(await arnes.pedir(narradora, 'dia:darPalabra', { participanteId: ana.id })).toEqual({ ok: true });
    expect(ana.estado.palabra).toBe(ana.id);
  });
});
