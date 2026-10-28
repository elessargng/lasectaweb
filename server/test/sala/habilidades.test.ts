import { afterEach, describe, expect, it } from 'vitest';
import { SalaService } from '../../src/services/SalaService';
import type { SalaHabilidadNoche } from '../../src/contrato/sala';
import { Arnes } from './arnes';
import { guionDePrueba, guionTroubleBrewing, invitado } from './guionDePrueba';

/** El despertar guiado desde el orden de noche: cada personaje de Trouble Brewing, según su habilidad. */

/** Una mesa de Trouble Brewing con esos personajes (uno por asiento, en orden) y sus jugadores, de noche. */
function mesa(...personajes: string[]) {
  const sala = new SalaService();
  sala.cambiarGuion(guionTroubleBrewing());
  while (sala.asientos().length > personajes.length) sala.quitarAsiento();
  const ids = personajes.map((p, i) => {
    const { id } = sala.conectar(`s-${i}`, `c-${i}`, invitado(`J${i}`), () => true);
    sala.sentar(id, sala.asientos()[i].id);
    sala.cambiarPersonaje(sala.asientos()[i].id, p);
    return id;
  });
  sala.irANoche();
  const asiento = (i: number) => sala.asientos()[i];
  const fila = (personaje: string): SalaHabilidadNoche | undefined => sala.habilidadesNoche().find((h) => h.personaje === personaje);
  const recordatorio = (i: number, personaje: string, texto: string) => {
    const indice = sala.personaje(personaje)!.recordatorios.indexOf(texto);
    sala.ponerRecordatorio(asiento(i).id, { personaje, indice, texto });
  };
  const textos = (i: number) => asiento(i).recordatorios.map((r) => r.texto);
  /** Lo último que le ha mandado el narrador al de un asiento. */
  const ultimo = (i: number) => sala.despertares().find((d) => d.asiento === asiento(i).id)?.mensajes.slice(-1)[0];
  /** El de un asiento elige (como si contestara con «Jugador»). */
  const elegir = (i: number, ...elegidos: number[]) => sala.alElegirHabilidad(asiento(i).id, elegidos.map((e) => asiento(e).id));
  return { sala, ids, asiento, fila, recordatorio, textos, ultimo, elegir };
}

describe('despertar guiado', () => {
  it('solo con Trouble Brewing, solo de noche y solo con la ficha en la mesa', () => {
    const m = mesa('poisoner', 'chef', 'imp');
    expect(m.sala.habilidadesNoche().map((h) => h.personaje).sort()).toEqual(['chef', 'imp', 'poisoner']);
    m.sala.amanecer();
    expect(m.sala.habilidadesNoche()).toEqual([]);
    m.sala.cambiarGuion(guionDePrueba());
    m.sala.irANoche();
    expect(m.sala.habilidadesNoche()).toEqual([]);
  });

  describe('eligen y marcan', () => {
    it('el Envenenador elige a uno: se le pone «Poisoned» y se le contesta «Entendido»', () => {
      const m = mesa('poisoner', 'chef', 'imp');
      expect(m.fila('poisoner')?.estado).toBe('listo');
      expect(m.sala.despertarHabilidad('poisoner')).toBeNull();
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'eleccion', eleccion: { cantidad: 1, puedeElegirse: true } });
      expect(m.fila('poisoner')?.estado).toBe('esperando');
      expect(m.sala.eleccionPendiente(m.asiento(0).id)).toEqual({ cantidad: 1, puedeElegirse: true });
      m.elegir(0, 1);
      expect(m.textos(1)).toEqual(['Poisoned']);
      expect(m.ultimo(0)).toMatchObject({ autor: 'narrador', ficha: 'entendido' });
      expect(m.fila('poisoner')?.estado).toBe('hecho');
      expect(m.sala.eleccionPendiente(m.asiento(0).id)).toBeNull();
    });

    it('el recordatorio es único: la noche siguiente pasa al nuevo elegido', () => {
      const m = mesa('poisoner', 'chef', 'imp');
      m.sala.despertarHabilidad('poisoner');
      m.elegir(0, 1);
      m.sala.amanecer();
      m.sala.irANoche();
      expect(m.fila('poisoner')?.estado).toBe('listo');
      m.sala.despertarHabilidad('poisoner');
      m.elegir(0, 2);
      expect(m.textos(1)).toEqual([]);
      expect(m.textos(2)).toEqual(['Poisoned']);
    });

    it('el Monje no puede elegirse a sí mismo', () => {
      const m = mesa('monk', 'chef', 'imp');
      m.sala.despertarHabilidad('monk');
      expect(m.ultimo(0)?.eleccion).toEqual({ cantidad: 1, puedeElegirse: false });
    });

    it('droison, se le contesta igual pero no se pone nada', () => {
      const m = mesa('monk', 'chef', 'imp');
      m.recordatorio(0, 'poisoner', 'Poisoned');
      m.sala.despertarHabilidad('monk');
      m.elegir(0, 1);
      expect(m.textos(1)).toEqual([]);
      expect(m.ultimo(0)?.ficha).toBe('entendido');
      expect(m.fila('monk')?.avisos.map((a) => a.tipo)).toEqual(['elegido', 'envenenado', 'sinEfecto']);
    });

    it('el Imp mata: «Dead» y la muerte pendiente', () => {
      const m = mesa('imp', 'chef', 'poisoner');
      m.sala.despertarHabilidad('imp');
      m.elegir(0, 1);
      expect(m.textos(1)).toEqual(['Dead']);
      expect(m.asiento(1).muertePendiente).toBe(true);
    });

    it('al protegido por el Monje, o a un Soldado, no lo mata', () => {
      const m = mesa('imp', 'chef', 'soldier', 'monk');
      m.recordatorio(1, 'monk', 'Safe');
      m.sala.despertarHabilidad('imp');
      m.elegir(0, 1);
      expect(m.asiento(1).muertePendiente).toBe(false);
      expect(m.fila('imp')?.avisos).toContainEqual({ tipo: 'protegido', asiento: m.asiento(1).id });
      m.sala.amanecer();
      m.sala.irANoche();
      m.sala.despertarHabilidad('imp');
      m.elegir(0, 2);
      expect(m.asiento(2).muertePendiente).toBe(false);
    });

    it('si elige al Alcalde, lo revisa el narrador', () => {
      const m = mesa('imp', 'mayor', 'poisoner');
      m.sala.despertarHabilidad('imp');
      m.elegir(0, 1);
      expect(m.fila('imp')?.estado).toBe('revisar');
      expect(m.asiento(1).muertePendiente).toBe(false);
      expect(m.sala.resolverHabilidad('imp', m.fila('imp')!.opciones[0].envio)).toBeNull();
      expect(m.fila('imp')?.estado).toBe('hecho');
    });

    it('si el Imp se elige a sí mismo, muere y el narrador dice quién es el nuevo', () => {
      const m = mesa('imp', 'chef', 'poisoner');
      m.sala.despertarHabilidad('imp');
      m.elegir(0, 0);
      expect(m.asiento(0).muertePendiente).toBe(true);
      expect(m.sala.nuevoImp()).toBe(m.asiento(0).id);
      expect(m.sala.elegirNuevoImp(m.asiento(2).id)).toBeNull();
      expect(m.asiento(2).personaje).toBe('imp');
      expect(m.ultimo(2)).toMatchObject({ tarjeta: 'tuEres', personajes: ['imp'], alineamiento: 'malvado' });
      expect(m.sala.nuevoImp()).toBeNull();
    });
  });

  describe('eligen y saben', () => {
    it('la Adivina necesita su «Red Herring» y dice si alguno es el demonio', () => {
      const m = mesa('fortuneteller', 'chef', 'imp', 'empath');
      expect(m.fila('fortuneteller')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'faltaRecordatorio', personaje: 'fortuneteller', texto: 'Red Herring' }] });
      m.recordatorio(3, 'fortuneteller', 'Red Herring');
      m.sala.despertarHabilidad('fortuneteller');
      expect(m.ultimo(0)?.eleccion).toEqual({ cantidad: 2, puedeElegirse: true });
      m.elegir(0, 1, 2);
      expect(m.ultimo(0)?.ficha).toBe('si');
    });

    it('con la Reclusa entre los elegidos, el narrador elige entre «Sí» y «No»', () => {
      const m = mesa('fortuneteller', 'chef', 'recluse', 'imp', 'empath');
      m.recordatorio(4, 'fortuneteller', 'Red Herring');
      m.sala.despertarHabilidad('fortuneteller');
      m.elegir(0, 1, 2);
      const f = m.fila('fortuneteller')!;
      expect(f.estado).toBe('revisar');
      expect(f.opciones.map((o) => o.envio.ficha)).toEqual(['no', 'si']);
      expect(f.opciones[1].registros).toEqual([{ asiento: m.asiento(2).id, como: 'demonio' }]);
      expect(f.avisos).toContainEqual({ tipo: 'registro', asiento: m.asiento(2).id });
    });

    it('el Ravenkeeper solo despierta si muere esta noche, y sabe quién es el elegido', () => {
      const m = mesa('ravenkeeper', 'chef', 'imp');
      expect(m.fila('ravenkeeper')?.estado).toBe('falta');
      m.sala.cambiarVida(m.asiento(0).id, true);
      expect(m.fila('ravenkeeper')?.estado).toBe('listo');
      m.sala.despertarHabilidad('ravenkeeper');
      m.elegir(0, 2);
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'esteJugadorEs', jugadores: [m.asiento(2).id], personajes: ['imp'] });
    });
  });

  describe('reciben información', () => {
    it('la Lavandera necesita sus dos recordatorios y recibe los dos jugadores y el personaje', () => {
      const m = mesa('washerwoman', 'imp', 'chef', 'empath');
      expect(m.fila('washerwoman')?.estado).toBe('falta');
      expect(m.sala.despertarHabilidad('washerwoman')).not.toBeNull();
      m.recordatorio(3, 'washerwoman', 'Wrong');
      m.recordatorio(2, 'washerwoman', 'Townsfolk');
      expect(m.fila('washerwoman')?.estado).toBe('listo');
      expect(m.sala.despertarHabilidad('washerwoman')).toBeNull();
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'esteJugadorEs', jugadores: [m.asiento(2).id, m.asiento(3).id], personajes: ['chef'] });
      expect(m.fila('washerwoman')?.estado).toBe('hecho');
    });

    it('droison, lo revisa el narrador con la información de verdad como propuesta', () => {
      const m = mesa('washerwoman', 'imp', 'chef', 'empath');
      m.recordatorio(2, 'washerwoman', 'Townsfolk');
      m.recordatorio(3, 'washerwoman', 'Wrong');
      m.recordatorio(0, 'poisoner', 'Poisoned');
      const f = m.fila('washerwoman')!;
      expect(f.estado).toBe('revisar');
      expect(f.avisos).toContainEqual({ tipo: 'envenenado' });
      expect(f.opciones[0].envio.personajes).toEqual(['chef']);
      const cambiado = { ...f.opciones[0].envio, personajes: ['empath'] };
      expect(m.sala.resolverHabilidad('washerwoman', cambiado)).toBeNull();
      expect(m.ultimo(0)?.personajes).toEqual(['empath']);
      expect(m.fila('washerwoman')?.estado).toBe('hecho');
    });

    it('el Borracho que cree ser la Lavandera, también se revisa', () => {
      const m = mesa('washerwoman', 'imp', 'chef');
      m.recordatorio(0, 'drunk', 'Is The Drunk');
      expect(m.fila('washerwoman')).toMatchObject({ estado: 'revisar', avisos: [{ tipo: 'borracho' }, expect.anything(), expect.anything()] });
    });

    it('el Bibliotecario sin forasteros en juego recibe un cero', () => {
      const m = mesa('librarian', 'imp', 'chef');
      expect(m.fila('librarian')).toMatchObject({ estado: 'listo', opciones: [{ envio: { ficha: 'cero' } }] });
    });

    it('el Chef cuenta las parejas de malvados; con la Reclusa entre dos, el narrador elige', () => {
      const m = mesa('chef', 'imp', 'poisoner', 'empath');
      expect(m.fila('chef')?.opciones.map((o) => o.envio.ficha)).toEqual(['uno']);
      const r = mesa('chef', 'imp', 'recluse', 'poisoner');
      const f = r.fila('chef')!;
      expect(f.estado).toBe('revisar');
      expect(f.opciones.map((o) => o.envio.ficha)).toEqual(['cero', 'dos']);
      expect(f.opciones.map((o) => o.registros)).toEqual([
        [{ asiento: r.asiento(2).id, como: 'bueno' }],
        [{ asiento: r.asiento(2).id, como: 'malvado' }],
      ]);
    });

    it('el Empático cuenta sus vecinos vivos malvados (saltándose a los muertos)', () => {
      const m = mesa('empath', 'chef', 'imp', 'poisoner');
      expect(m.fila('empath')?.opciones[0].envio.ficha).toBe('uno');
      m.sala.cambiarVida(m.asiento(1).id, true);
      expect(m.fila('empath')?.opciones[0].envio.ficha).toBe('dos');
    });

    it('el Enterrador necesita al ejecutado («Die Today»)', () => {
      const m = mesa('undertaker', 'chef', 'imp');
      expect(m.fila('undertaker')?.estado).toBe('falta');
      m.recordatorio(1, 'undertaker', 'Die Today');
      m.sala.despertarHabilidad('undertaker');
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'esteJugadorEs', jugadores: [m.asiento(1).id], personajes: ['chef'] });
    });

    it('el Espía recibe el grimorio', () => {
      const m = mesa('spy', 'chef', 'imp');
      m.sala.despertarHabilidad('spy');
      expect(m.sala.grimorioRecibidoPor(m.ids[0])?.fichas.map((f) => f.personaje)).toEqual(['spy', 'chef', 'imp']);
    });

    it('la Mujer Escarlata, con su «Is The Demon», sabe que es el Imp', () => {
      const m = mesa('scarletwoman', 'chef', 'imp');
      expect(m.fila('scarletwoman')?.estado).toBe('falta');
      m.recordatorio(0, 'scarletwoman', 'Is The Demon');
      m.sala.despertarHabilidad('scarletwoman');
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'tuEres', personajes: ['imp'], alineamiento: 'malvado' });
    });
  });
});

describe('despertar guiado por el socket', () => {
  let arnes: Arnes;
  afterEach(() => arnes?.cerrar());

  it('el jugador solo puede contestar con quien elige su habilidad', async () => {
    arnes = await Arnes.crear({
      guiones: { guionPredeterminado: async () => guionTroubleBrewing(), importar: async () => guionTroubleBrewing() },
    });
    const narradora = await arnes.entrar('Nora');
    const ana = await arnes.entrar('Ana');
    await arnes.accion(narradora, 'sala:hacerseNarrador');
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'troublebrewing' });
    const asientos = () => narradora.estado.asientos;
    await arnes.accion(ana, 'sala:sentarse', { asientoId: asientos()[0].id });
    await arnes.accion(narradora, 'narrador:cambiarPersonaje', { asientoId: asientos()[0].id, personajeId: 'poisoner' });
    await arnes.accion(narradora, 'narrador:irANoche');
    expect(narradora.estado.habilidadesNoche.find((h) => h.personaje === 'poisoner')?.estado).toBe('listo');
    expect(ana.estado.habilidadesNoche).toEqual([]);

    await arnes.accion(narradora, 'narrador:despertarHabilidad', { personajeId: 'poisoner' });
    expect(ana.estado.despertares[0].mensajes.slice(-1)[0]?.eleccion).toEqual({ cantidad: 1, puedeElegirse: true });
    const dos = await arnes.intentar(ana, 'despertar:enviar', { ficha: 'jugador', jugadores: [asientos()[1].id, asientos()[2].id] });
    expect(dos).toEqual({ ok: false, error: 'Elige un jugador.' });
    expect((await arnes.intentar(ana, 'despertar:enviar', { ficha: 'entendido' })).ok).toBe(false);
    await arnes.accion(ana, 'despertar:enviar', { ficha: 'jugador', jugadores: [asientos()[1].id] });
    expect(narradora.estado.asientos[1].recordatorios.map((r) => r.texto)).toEqual(['Poisoned']);
    expect(ana.estado.despertares[0].mensajes.slice(-1)[0]).toMatchObject({ autor: 'narrador', ficha: 'entendido' });
  });
});
