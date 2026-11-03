import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * El paso de las fases por su socket (FaseController → FaseService → Partida):
 * quién puede, lo que contesta y lo que llega a cada uno.
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('las fases', () => {
  it('solo un narrador; anochece si no es de noche y amanece si lo es', async () => {
    expect(await arnes.pedir(ana, 'fase:noche')).toEqual({ ok: false, error: 'Solo un narrador puede hacer que anochezca.' });
    expect(await arnes.pedir(narradora, 'fase:amanecer')).toEqual({ ok: false, error: 'Solo amanece de noche.' });
    expect(await arnes.pedir(narradora, 'fase:volverAtras')).toEqual({ ok: false, error: 'En la preparación no hay a dónde volver.' });
    expect(narradora.estado.acciones).toEqual(expect.arrayContaining(['fase:noche', 'fase:limpiarGrimorio']));
    expect(ana.estado.acciones.some((a) => a.startsWith('fase:'))).toBe(false);

    expect(await arnes.pedir(narradora, 'fase:noche')).toEqual({ ok: true });
    expect(ana.estado.fase).toMatchObject({ momento: 'noche', numero: 1 });
    expect(await arnes.pedir(narradora, 'fase:noche')).toEqual({ ok: false, error: 'Ya es de noche.' });
    expect(await arnes.pedir(narradora, 'fase:amanecer')).toEqual({ ok: true });
    expect(ana.estado.fase).toMatchObject({ momento: 'dia', numero: 1 });
  });

  it('volver atrás y limpiar el grimorio', async () => {
    await arnes.hacer(narradora, 'fase:noche');
    await arnes.hacer(narradora, 'fase:amanecer');
    expect(await arnes.pedir(narradora, 'fase:volverAtras')).toEqual({ ok: true });
    expect(ana.estado.fase).toMatchObject({ momento: 'noche', numero: 1 });
    expect(await arnes.pedir(narradora, 'fase:limpiarGrimorio')).toEqual({ ok: true });
    expect(ana.estado.fase.momento).toBe('preparacion');
    expect(narradora.estado.acciones).not.toContain('fase:volverAtras');
  });
});
