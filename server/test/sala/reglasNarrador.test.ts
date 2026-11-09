import { describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/models/SalaDeJuego';
import { SALA_ASIENTOS } from '../../src/models/sala/Sala';
import { MAX_RECORDATORIOS } from '../../src/models/partida/Grimorio';
import { MAX_REPETIDOS } from '../../src/models/partida/Bolsa';
import { NPC_GARDENER, NPC_POPE } from '../../src/models/partida/personajesEspeciales';
import { BOLSA_DE_SIETE, guionDePrueba, conSemilla } from './guionDePrueba';

/**
 * Las reglas de lo que el narrador hace a mano (la bolsa, las fichas, los
 * recordatorios, la calavera, los asientos): son del dominio, y se prueban sin sala.
 */
function partidaDePrueba() {
  const juego = new SalaDeJuego(conSemilla(1));
  juego.partida.cambiarGuion(guionDePrueba());
  const asiento = (i: number) => juego.partida.plaza()[i];
  return { ...juego, asiento };
}

describe('la bolsa', () => {
  it('solo admite personajes del guion de los tipos que se reparten', () => {
    const { partida } = partidaDePrueba();
    expect(partida.bolsa.meterOSacar('nadie')).toBe('Ese personaje no está en el guion.');
    expect(partida.bolsa.meterOSacar('gardener')).toMatch(/^En la bolsa solo van/);
    expect(partida.bolsa.meterOSacar('chef')).toBeNull();
    expect(partida.bolsa.fichas()).toEqual(['chef']);
    expect(partida.bolsa.meterOSacar('chef')).toBeNull();
    expect(partida.bolsa.fichas()).toEqual([]);
  });

  it('un aldeano solo va repetido con el Pope en juego, y hasta el máximo', () => {
    const { partida } = partidaDePrueba();
    expect(partida.bolsa.ponerEnBolsa('chef', 2)).toBe('Solo con el Pope puede haber aldeanos o forasteros repetidos.');
    partida.alternarNpc(NPC_POPE);
    expect(partida.bolsa.ponerEnBolsa('chef', 2)).toBeNull();
    expect(partida.bolsa.fichas()).toEqual(['chef', 'chef']);
    expect(partida.bolsa.ponerEnBolsa('chef', MAX_REPETIDOS + 1)).toBe('Cantidad desconocida.');
    // Un esbirro, ni con el Pope
    expect(partida.bolsa.ponerEnBolsa('poisoner', 2)).toBe('Solo con el Pope puede haber aldeanos o forasteros repetidos.');
  });

  it('al llenarla al azar no van viajeros ni repetidos sin el Pope', () => {
    const { partida } = partidaDePrueba();
    expect(partida.bolsa.llenar(['chef', 'voudon'])).toMatch(/^En la bolsa al azar solo van/);
    expect(partida.bolsa.llenar(['chef', 'chef'])).toBe('Solo con el Pope puede haber aldeanos o forasteros repetidos.');
    expect(partida.bolsa.llenar(BOLSA_DE_SIETE)).toBeNull();
    expect(partida.bolsa.fichas()).toEqual(BOLSA_DE_SIETE);
  });

  it('se reparte si hay tantos personajes como asientos; con el Gardener, se retienen', () => {
    const { partida } = partidaDePrueba();
    expect(partida.repartirPersonajes()).toBe('En la bolsa tiene que haber 7 personajes y hay 0.');
    partida.bolsa.llenar(BOLSA_DE_SIETE);
    partida.alternarNpc(NPC_GARDENER);
    expect(partida.repartirPersonajes()).toBeNull();
    expect(partida.entregas.fichasRetenidas()).toBe(true);
    expect(partida.plaza().map((a) => a.personaje).sort()).toEqual([...BOLSA_DE_SIETE].sort());
  });
});

describe('las fichas y los recordatorios del grimorio', () => {
  it('en una ficha solo va un personaje del guion que se pueda jugar', () => {
    const { partida, asiento } = partidaDePrueba();
    expect(partida.grimorio.elegirPersonaje('nadie', 'chef')).toBe('Ese asiento ya no existe.');
    expect(partida.grimorio.elegirPersonaje(asiento(0).id, 'nadie')).toBe('Ese personaje no está en el guion.');
    expect(partida.grimorio.elegirPersonaje(asiento(0).id, 'gardener')).toBe('Ese personaje no puede ir en una ficha.');
    expect(partida.grimorio.elegirPersonaje(asiento(0).id, 'chef')).toBeNull();
    expect(asiento(0).personaje).toBe('chef');
    expect(partida.grimorio.elegirPersonaje(asiento(0).id, null)).toBeNull();
    expect(asiento(0).personaje).toBeNull();
  });

  it('cada recordatorio de un personaje es único: ponerlo en otra ficha lo quita de la anterior', () => {
    const { partida, asiento } = partidaDePrueba();
    expect(partida.grimorio.elegirRecordatorio(asiento(0).id, 'poisoner', 1)).toBe('Ese recordatorio no existe.');
    expect(partida.grimorio.elegirRecordatorio(asiento(0).id, 'poisoner', 0)).toBeNull();
    expect(partida.grimorio.elegirRecordatorio(asiento(1).id, 'poisoner', 0)).toBeNull();
    expect(asiento(0).recordatorios).toEqual([]);
    expect(asiento(1).recordatorios.map((r) => r.texto)).toEqual(['Poisoned']);
  });

  it('un recordatorio de texto propio es corto, con un icono que exista, y no pasa del máximo por ficha', () => {
    const { partida, asiento } = partidaDePrueba();
    expect(partida.grimorio.escribirRecordatorio(asiento(0).id, '   ', null)).toBe('Escribe el texto del recordatorio.');
    expect(partida.grimorio.escribirRecordatorio(asiento(0).id, 'Ojo', 'nadie')).toBe('Ese icono no está en el guion.');
    expect(partida.grimorio.escribirRecordatorio(asiento(0).id, '  Ojo   aquí ', 'chef')).toBeNull();
    expect(asiento(0).recordatorios[0]).toMatchObject({ texto: 'Ojo aquí', icono: 'chef' });
    for (let i = 1; i < MAX_RECORDATORIOS; i++) partida.grimorio.escribirRecordatorio(asiento(0).id, `${i}`, null);
    expect(partida.grimorio.escribirRecordatorio(asiento(0).id, 'Uno más', null)).toBe(
      `Una ficha no puede llevar más de ${MAX_RECORDATORIOS} recordatorios.`,
    );
  });
});

describe('la calavera y los asientos', () => {
  it('el narrador solo ejecuta a quien lleva la calavera', () => {
    const { partida, asiento } = partidaDePrueba();
    partida.irANoche();
    partida.amanecer();
    expect(partida.ejecutarConCalavera(asiento(0).id)).toEqual({ error: 'Solo se ejecuta a quien lleva la calavera.' });
    partida.grimorio.marcar(asiento(0).id, true, null);
    expect(partida.ejecutarConCalavera(asiento(0).id)).toEqual({ final: null });
    expect(asiento(0).muerto).toBe(true);
  });

  it('la plaza no pasa del máximo de asientos ni baja del mínimo', () => {
    const { sala, partida } = partidaDePrueba();
    while (partida.plaza().length < SALA_ASIENTOS.max) expect(sala.anadirAsiento()).toBeNull();
    expect(sala.anadirAsiento()).toBe(`La plaza ya tiene el máximo de ${SALA_ASIENTOS.max} asientos.`);
    while (partida.plaza().length > SALA_ASIENTOS.min) expect(sala.quitarAsiento()).not.toBeNull();
    expect(sala.quitarAsiento()).toBeNull();
  });
});
