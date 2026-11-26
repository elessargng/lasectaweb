import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Arnes, Cliente } from './arnes';

/**
 * Deshacer (la historia de la partida, ver Historia): una partida jugada por los
 * servicios de la sala, de la preparación a la revelación; tras cada caso de uso
 * que cambia la partida, deshacerlo la deja exactamente como estaba (y se vuelve
 * a hacer, para seguir).
 */

let arnes: Arnes;
let narradora: Cliente;
let ana: Cliente;
let bea: Cliente;

const idAsiento = (i: number) => narradora.estado.plaza[i].id;

/**
 * Cómo está todo lo que se deshace, en JSON: el guion, por su nombre (no se
 * copia); la fase, sin los reinicios (nunca bajan, ver Fases.restaurar).
 */
const foto = () => {
  type Partida = { guion: { nombre: string } | null; fase: { reinicios: number } };
  const { partida, ...resto } = arnes.juego.partida.historia.instantanea() as { partida: Partida };
  const { reinicios: _, ...fase } = partida.fase;
  return JSON.stringify({ ...resto, partida: { ...partida, guion: partida.guion?.nombre ?? null, fase } });
};

beforeEach(async () => {
  arnes = await Arnes.crear();
  narradora = await arnes.entrar('Nora');
  ana = await arnes.entrar('Ana');
  bea = await arnes.entrar('Bea');
  await arnes.accion(narradora, 'sala:hacerseNarrador');
});

afterEach(async () => {
  await arnes.cerrar();
});

describe('deshacer', () => {
  it('cada caso de uso que cambia la partida se deshace del todo', async () => {
    const pasos: [Cliente, string, () => unknown][] = [
      [narradora, 'preparacion:guion', () => ({ predeterminado: 'prueba' })],
      [ana, 'sala:sentarse', () => ({ jugadorId: idAsiento(0) })],
      [bea, 'sala:sentarse', () => ({ jugadorId: idAsiento(1) })],
      [narradora, 'grimorio:personaje', () => ({ jugadorId: idAsiento(0), personajeId: 'chef' })],
      [narradora, 'grimorio:personaje', () => ({ jugadorId: idAsiento(1), personajeId: 'imp' })],
      [narradora, 'grimorio:personaje', () => ({ jugadorId: idAsiento(2), personajeId: 'poisoner' })],
      [narradora, 'grimorio:nota', () => ({ jugadorId: idAsiento(0), texto: 'Sospechosa' })],
      [narradora, 'faroles:preparar', () => ({ posicion: 0, personajeId: 'empath' })],
      [narradora, 'fase:noche', () => undefined],
      [narradora, 'noche:despertar', () => ({ jugadorId: idAsiento(0) })],
      [narradora, 'noche:enviar', () => ({ jugadorId: idAsiento(0), tarjeta: 'noEnJuego', personajes: ['empath', 'librarian', 'investigator'] })],
      [narradora, 'grimorio:recordatorio', () => ({ jugadorId: idAsiento(0), personajeId: 'poisoner', indice: 0 })],
      [narradora, 'grimorio:vida', () => ({ jugadorId: idAsiento(2), muerto: true })],
      [narradora, 'noche:recordatorio', () => ({ id: 'imp', activo: false })],
      [narradora, 'fase:amanecer', () => undefined],
      [narradora, 'grimorio:confirmarMuerte', () => ({ jugadorId: idAsiento(2) })],
      [narradora, 'dia:nominar', () => ({ desde: idAsiento(0), hasta: idAsiento(1) })],
      [narradora, 'dia:marcar', () => ({ jugadorId: idAsiento(1), marcado: true })],
      [narradora, 'dia:ejecutar', () => ({ jugadorId: idAsiento(1) })],
      [narradora, 'revelacion:empezar', () => ({ ganador: 'bueno' })],
    ];
    let deshechos = 0;
    for (const [cliente, uso, datos] of pasos) {
      const antes = foto();
      const ultimo = arnes.juego.partida.historia.ultimo();
      expect(await arnes.pedir(cliente, uso, datos()), uso).toMatchObject({ ok: true });
      if (arnes.juego.partida.historia.ultimo() === ultimo) {
        // No ha cambiado la partida (sentarse es de la sala): no hay nada que deshacer
        expect(foto(), uso).toEqual(antes);
        continue;
      }
      expect(narradora.estado.deshacer, uso).toBe(uso);
      expect(await arnes.pedir(narradora, 'fase:deshacer'), uso).toEqual({ ok: true, valor: uso });
      expect(foto(), uso).toEqual(antes);
      deshechos += 1;
      // Se vuelve a hacer, para seguir la partida
      expect(await arnes.pedir(cliente, uso, datos()), uso).toMatchObject({ ok: true });
    }
    expect(deshechos).toBe(pasos.length - 2);
  });

  it('deshacer no levanta a nadie: quien se sienta dónde no es de la partida', async () => {
    await arnes.hacer(narradora, 'preparacion:guion', { predeterminado: 'prueba' });
    await arnes.hacer(narradora, 'grimorio:personaje', { jugadorId: idAsiento(0), personajeId: 'chef' });
    await arnes.accion(ana, 'sala:sentarse', { jugadorId: idAsiento(0) });
    expect(await arnes.pedir(narradora, 'fase:deshacer')).toEqual({ ok: true, valor: 'grimorio:personaje' });
    expect(narradora.estado.plaza[0].participanteId).toBe(ana.id);
  });
});
