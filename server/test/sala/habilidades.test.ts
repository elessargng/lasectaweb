import { afterEach, describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/services/SalaDeJuego';
import type { HabilidadNocheDto } from '../../src/contrato/despertar';
import { Arnes } from './arnes';
import { ficha } from '../../src/services/partida/habilidades/HabilidadNocturna';
import { guionDePrueba, guionTroubleBrewing, invitado } from './guionDePrueba';

/** El despertar guiado desde el orden de noche: cada personaje de Trouble Brewing, según su habilidad. */

/** Una mesa de Trouble Brewing con esos personajes (uno por asiento, en orden) y sus jugadores, de noche. */
function mesa(...personajes: string[]) {
  const juego = new SalaDeJuego();
  const { sala, partida } = juego;
  partida.cambiarGuion(guionTroubleBrewing());
  while (partida.plaza().length > personajes.length) sala.quitarAsiento();
  const ids = personajes.map((p, i) => {
    const { id } = sala.participantes.conectar(`s-${i}`, `c-${i}`, invitado(`J${i}`), () => true);
    sala.sentar(id, partida.plaza()[i].id);
    partida.grimorio.cambiarPersonaje(partida.plaza()[i].id, p);
    return id;
  });
  partida.irANoche();
  const asiento = (i: number) => partida.plaza()[i];
  const fila = (personaje: string): HabilidadNocheDto | undefined => partida.guiado.habilidadesNoche().find((h) => h.personaje === personaje);
  const recordatorio = (i: number, personaje: string, texto: string) => {
    const indice = partida.guion.personaje(personaje)!.recordatorios.indexOf(texto);
    partida.grimorio.ponerRecordatorio(asiento(i).id, { personaje, indice, texto });
  };
  const textos = (i: number) => asiento(i).recordatorios.map((r) => r.texto);
  /** Lo último que le ha mandado el narrador al de un asiento. */
  const ultimo = (i: number) => partida.despertares.despertares().find((d) => d.jugador === asiento(i).id)?.mensajes.slice(-1)[0];
  /** El de un asiento elige (como el socket: lo que contesta queda en su despertar y luego se hace lo de su habilidad). */
  const elegir = (i: number, ...elegidos: number[]) => {
    const jugadores = elegidos.map((e) => asiento(e).id);
    partida.despertares.enviar(asiento(i).id, { ...ficha('jugador'), jugadores, autor: asiento(i).id });
    partida.guiado.alElegir(asiento(i).id, jugadores);
  };
  return { juego, ids, asiento, fila, recordatorio, textos, ultimo, elegir };
}

describe('despertar guiado', () => {
  it('solo con Trouble Brewing, solo de noche y solo con la ficha en la mesa', () => {
    const m = mesa('poisoner', 'chef', 'imp');
    const { partida } = m.juego;
    expect(partida.guiado.habilidadesNoche().map((h) => h.personaje).sort()).toEqual(['chef', 'demonios', 'esbirros', 'imp', 'poisoner']);
    partida.amanecer();
    expect(partida.guiado.habilidadesNoche()).toEqual([]);
    partida.cambiarGuion(guionDePrueba());
    partida.irANoche();
    expect(partida.guiado.habilidadesNoche()).toEqual([]);
  });

  describe('eligen y marcan', () => {
    it('el Envenenador elige a uno: se le pone «Poisoned» y se le contesta «Entendido»', () => {
      const m = mesa('poisoner', 'chef', 'imp');
      const { partida } = m.juego;
      expect(m.fila('poisoner')?.estado).toBe('listo');
      expect(partida.guiado.despertar('poisoner')).toBeNull();
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'eleccion', eleccion: { cantidad: 1, puedeElegirse: true } });
      expect(m.fila('poisoner')?.estado).toBe('esperando');
      expect(partida.guiado.eleccionPendiente(m.asiento(0).id)).toEqual({ cantidad: 1, puedeElegirse: true });
      m.elegir(0, 1);
      expect(m.textos(1)).toEqual(['Poisoned']);
      expect(m.ultimo(0)).toMatchObject({ autor: 'narrador', ficha: 'entendido' });
      expect(m.fila('poisoner')?.estado).toBe('hecho');
      expect(partida.guiado.eleccionPendiente(m.asiento(0).id)).toBeNull();
    });

    it('el recordatorio es único: la noche siguiente pasa al nuevo elegido', () => {
      const m = mesa('poisoner', 'chef', 'imp');
      const { partida } = m.juego;
      partida.guiado.despertar('poisoner');
      m.elegir(0, 1);
      partida.amanecer();
      partida.irANoche();
      expect(m.fila('poisoner')?.estado).toBe('listo');
      partida.guiado.despertar('poisoner');
      m.elegir(0, 2);
      expect(m.textos(1)).toEqual([]);
      expect(m.textos(2)).toEqual(['Poisoned']);
    });

    it('el Monje no puede elegirse a sí mismo', () => {
      const m = mesa('monk', 'chef', 'imp');
      const { partida } = m.juego;
      partida.guiado.despertar('monk');
      expect(m.ultimo(0)?.eleccion).toEqual({ cantidad: 1, puedeElegirse: false });
    });

    it('droison, se le contesta igual pero no se pone nada', () => {
      const m = mesa('monk', 'chef', 'imp');
      const { partida } = m.juego;
      m.recordatorio(0, 'poisoner', 'Poisoned');
      partida.guiado.despertar('monk');
      m.elegir(0, 1);
      expect(m.textos(1)).toEqual([]);
      expect(m.ultimo(0)?.ficha).toBe('entendido');
      expect(m.fila('monk')?.avisos.map((a) => a.tipo)).toEqual(['elegido', 'envenenado', 'sinEfecto']);
    });

    it('el Imp mata: «Dead» y la muerte pendiente', () => {
      const m = mesa('imp', 'chef', 'poisoner');
      const { partida } = m.juego;
      partida.guiado.despertar('imp');
      m.elegir(0, 1);
      expect(m.textos(1)).toEqual(['Dead']);
      expect(m.asiento(1).muertePendiente).toBe(true);
    });

    it('al protegido por el Monje, o a un Soldado, no lo mata', () => {
      const m = mesa('imp', 'chef', 'soldier', 'monk');
      const { partida } = m.juego;
      m.recordatorio(1, 'monk', 'Safe');
      partida.guiado.despertar('imp');
      m.elegir(0, 1);
      expect(m.asiento(1).muertePendiente).toBe(false);
      expect(m.fila('imp')?.avisos).toContainEqual({ tipo: 'protegido', jugador: m.asiento(1).id });
      partida.amanecer();
      partida.irANoche();
      partida.guiado.despertar('imp');
      m.elegir(0, 2);
      expect(m.asiento(2).muertePendiente).toBe(false);
    });

    it('si elige al Alcalde, lo revisa el narrador', () => {
      const m = mesa('imp', 'mayor', 'poisoner');
      const { partida } = m.juego;
      partida.guiado.despertar('imp');
      m.elegir(0, 1);
      expect(m.fila('imp')?.estado).toBe('revisar');
      expect(m.asiento(1).muertePendiente).toBe(false);
      expect(partida.guiado.resolver('imp', m.fila('imp')!.opciones[0].envio)).toBeNull();
      expect(m.fila('imp')?.estado).toBe('hecho');
    });

    it('si el Imp se elige a sí mismo, muere y el narrador dice quién es el nuevo', () => {
      const m = mesa('imp', 'chef', 'poisoner');
      const { partida } = m.juego;
      partida.guiado.despertar('imp');
      m.elegir(0, 0);
      expect(m.asiento(0).muertePendiente).toBe(true);
      expect(partida.guiado.nuevoImp()).toBe(m.asiento(0).id);
      expect(partida.guiado.elegirNuevoImp(m.asiento(2).id)).toBeNull();
      expect(m.asiento(2).personaje).toBe('imp');
      expect(m.ultimo(2)).toMatchObject({ tarjeta: 'tuEres', personajes: ['imp'], alineamiento: 'malvado' });
      expect(partida.guiado.nuevoImp()).toBeNull();
    });
  });

  describe('eligen y saben', () => {
    it('la Adivina necesita su «Red Herring» y dice si alguno es el demonio', () => {
      const m = mesa('fortuneteller', 'chef', 'imp', 'empath');
      const { partida } = m.juego;
      expect(m.fila('fortuneteller')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'faltaRecordatorio', personaje: 'fortuneteller', texto: 'Red Herring' }] });
      m.recordatorio(3, 'fortuneteller', 'Red Herring');
      partida.guiado.despertar('fortuneteller');
      expect(m.ultimo(0)?.eleccion).toEqual({ cantidad: 2, puedeElegirse: true });
      m.elegir(0, 1, 2);
      // Aunque sea seguro, la revisa el narrador (que no se note por lo que tarda): «Sí», propuesto
      const f = m.fila('fortuneteller')!;
      expect(f.estado).toBe('revisar');
      expect(f.opciones.map((o) => o.envio.ficha)).toEqual(['si']);
      // Aún no se le ha contestado: lo último es lo que eligió
      expect(m.ultimo(0)?.autor).toBe(m.asiento(0).id);
      partida.guiado.resolver('fortuneteller', f.opciones[0].envio);
      expect(m.ultimo(0)?.ficha).toBe('si');
    });

    it('con la Reclusa entre los elegidos, el narrador elige entre «Sí» y «No»', () => {
      const m = mesa('fortuneteller', 'chef', 'recluse', 'imp', 'empath');
      const { partida } = m.juego;
      m.recordatorio(4, 'fortuneteller', 'Red Herring');
      partida.guiado.despertar('fortuneteller');
      m.elegir(0, 1, 2);
      const f = m.fila('fortuneteller')!;
      expect(f.estado).toBe('revisar');
      expect(f.opciones.map((o) => o.envio.ficha)).toEqual(['no', 'si']);
      expect(f.opciones[1].registros).toEqual([{ jugador: m.asiento(2).id, como: 'demonio' }]);
      expect(f.avisos).toContainEqual({ tipo: 'registro', jugador: m.asiento(2).id });
    });

    it('el Ravenkeeper solo despierta si muere esta noche, y sabe quién es el elegido', () => {
      const m = mesa('ravenkeeper', 'chef', 'imp');
      const { partida } = m.juego;
      expect(m.fila('ravenkeeper')?.estado).toBe('falta');
      partida.grimorio.cambiarVida(m.asiento(0).id, true);
      expect(m.fila('ravenkeeper')?.estado).toBe('listo');
      partida.guiado.despertar('ravenkeeper');
      m.elegir(0, 2);
      const f = m.fila('ravenkeeper')!;
      expect(f.estado).toBe('revisar');
      partida.guiado.resolver('ravenkeeper', f.opciones[0].envio);
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'esteJugadorEs', jugadores: [m.asiento(2).id], personajes: ['imp'] });
    });
  });

  describe('reciben información', () => {
    it('la Lavandera necesita sus dos recordatorios y recibe los dos jugadores y el personaje', () => {
      const m = mesa('washerwoman', 'imp', 'chef', 'empath');
      const { partida } = m.juego;
      expect(m.fila('washerwoman')?.estado).toBe('falta');
      expect(partida.guiado.despertar('washerwoman')).not.toBeNull();
      m.recordatorio(3, 'washerwoman', 'Wrong');
      m.recordatorio(2, 'washerwoman', 'Townsfolk');
      expect(m.fila('washerwoman')?.estado).toBe('listo');
      expect(partida.guiado.despertar('washerwoman')).toBeNull();
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'esteJugadorEs', jugadores: [m.asiento(2).id, m.asiento(3).id], personajes: ['chef'] });
      expect(m.fila('washerwoman')?.estado).toBe('hecho');
    });

    it('droison, lo revisa el narrador con la información de verdad como propuesta', () => {
      const m = mesa('washerwoman', 'imp', 'chef', 'empath');
      const { partida } = m.juego;
      m.recordatorio(2, 'washerwoman', 'Townsfolk');
      m.recordatorio(3, 'washerwoman', 'Wrong');
      m.recordatorio(0, 'poisoner', 'Poisoned');
      const f = m.fila('washerwoman')!;
      expect(f.estado).toBe('revisar');
      expect(f.avisos).toContainEqual({ tipo: 'envenenado' });
      expect(f.opciones[0].envio.personajes).toEqual(['chef']);
      const cambiado = { ...f.opciones[0].envio, personajes: ['empath'] };
      expect(partida.guiado.resolver('washerwoman', cambiado)).toBeNull();
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
        [{ jugador: r.asiento(2).id, como: 'bueno' }],
        [{ jugador: r.asiento(2).id, como: 'malvado' }],
      ]);
    });

    it('el Empático cuenta sus vecinos vivos malvados (saltándose a los muertos)', () => {
      const m = mesa('empath', 'chef', 'imp', 'poisoner');
      const { partida } = m.juego;
      expect(m.fila('empath')?.opciones[0].envio.ficha).toBe('uno');
      partida.grimorio.cambiarVida(m.asiento(1).id, true);
      expect(m.fila('empath')?.opciones[0].envio.ficha).toBe('dos');
    });

    it('el Enterrador necesita al ejecutado («Die Today»)', () => {
      const m = mesa('undertaker', 'chef', 'imp');
      const { partida } = m.juego;
      expect(m.fila('undertaker')?.estado).toBe('falta');
      m.recordatorio(1, 'undertaker', 'Die Today');
      partida.guiado.despertar('undertaker');
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'esteJugadorEs', jugadores: [m.asiento(1).id], personajes: ['chef'] });
    });

    it('el Espía recibe el grimorio', () => {
      const m = mesa('spy', 'chef', 'imp');
      const { partida } = m.juego;
      partida.guiado.despertar('spy');
      expect(partida.entregas.grimorioRecibidoPor(m.ids[0])?.fichas.map((f) => f.personaje)).toEqual(['spy', 'chef', 'imp']);
    });

    it('la Mujer Escarlata, con su «Is The Demon», sabe que es el Imp', () => {
      const m = mesa('scarletwoman', 'chef', 'imp');
      const { partida } = m.juego;
      expect(m.fila('scarletwoman')?.estado).toBe('falta');
      m.recordatorio(0, 'scarletwoman', 'Is The Demon');
      partida.guiado.despertar('scarletwoman');
      expect(m.ultimo(0)).toMatchObject({ tarjeta: 'tuEres', personajes: ['imp'], alineamiento: 'malvado' });
    });
  });

  describe('esbirros y demonio', () => {
    const SIETE = ['imp', 'poisoner', 'spy', 'chef', 'empath', 'monk', 'soldier'];
    /** Los mensajes que le han mandado al de un asiento. */
    const mensajes = (m: ReturnType<typeof mesa>, i: number) => m.juego.partida.despertares.despertares().find((d) => d.jugador === m.asiento(i).id)?.mensajes ?? [];

    it('con menos de 7 jugadores no se despiertan', () => {
      const m = mesa('imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier');
      expect(m.fila('esbirros')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'pocosJugadores' }] });
      expect(m.fila('demonios')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'pocosJugadores' }] });
    });

    it('cada esbirro ve al demonio y, cuando dice «Entendido», a los esbirros', () => {
      const m = mesa(...SIETE);
      const { partida } = m.juego;
      expect(m.fila('esbirros')).toMatchObject({ estado: 'listo', jugador: m.asiento(1).id, jugadores: [m.asiento(1).id, m.asiento(2).id] });
      expect(partida.guiado.despertar('esbirros')).toBeNull();
      for (const i of [1, 2]) {
        // Una cosa cada vez: lo segundo espera a que entienda lo primero
        expect(mensajes(m, i)).toMatchObject([{ autor: 'narrador', tarjeta: 'demonio', jugadores: [m.asiento(0).id], guiado: true }]);
        partida.guiado.alEntender(m.asiento(i).id);
        expect(mensajes(m, i)).toMatchObject([
          { autor: 'narrador', tarjeta: 'demonio', jugadores: [m.asiento(0).id], guiado: true },
          { autor: 'narrador', tarjeta: 'esbirros', jugadores: [m.asiento(1).id, m.asiento(2).id], guiado: true },
        ]);
      }
      expect(m.fila('esbirros')?.estado).toBe('hecho');
      expect(partida.despertares.despertares().map((d) => d.jugador)).toEqual([m.asiento(1).id, m.asiento(2).id]);
    });

    it('el demonio, con los 3 faroles, ve a sus esbirros y, cuando dice «Entendido», los faroles', () => {
      const m = mesa(...SIETE);
      const { partida } = m.juego;
      expect(m.fila('demonios')).toMatchObject({ estado: 'falta', avisos: [{ tipo: 'faltanFaroles' }] });
      ['washerwoman', 'librarian', 'mayor'].forEach((id, i) => partida.faroles.ponerFarol(i, id));
      expect(m.fila('demonios')?.estado).toBe('listo');
      partida.guiado.despertar('demonios');
      expect(mensajes(m, 0)).toMatchObject([{ tarjeta: 'esbirros', jugadores: [m.asiento(1).id, m.asiento(2).id], guiado: true }]);
      partida.guiado.alEntender(m.asiento(0).id);
      expect(mensajes(m, 0)).toMatchObject([
        { tarjeta: 'esbirros', jugadores: [m.asiento(1).id, m.asiento(2).id], guiado: true },
        { tarjeta: 'noEnJuego', personajes: ['washerwoman', 'librarian', 'mayor'], guiado: true },
      ]);
      // Solo una vez: otro «Entendido» ya no manda nada
      partida.guiado.alEntender(m.asiento(0).id);
      expect(mensajes(m, 0)).toHaveLength(2);
    });

    it('una cosa cada vez: al Envenenador no se le pide elegir hasta que entiende quién es su demonio', () => {
      const m = mesa(...SIETE);
      const { partida } = m.juego;
      partida.guiado.despertar('esbirros');
      partida.guiado.despertar('poisoner');
      // La petición espera en su cola: aún no se le ha pedido (no puede contestar eligiendo)
      expect(m.ultimo(1)).toMatchObject({ tarjeta: 'demonio' });
      expect(partida.guiado.eleccionPendiente(m.asiento(1).id)).toBeNull();
      partida.guiado.alEntender(m.asiento(1).id);
      expect(m.ultimo(1)).toMatchObject({ tarjeta: 'esbirros' });
      expect(partida.guiado.eleccionPendiente(m.asiento(1).id)).toBeNull();
      partida.guiado.alEntender(m.asiento(1).id);
      expect(m.ultimo(1)).toMatchObject({ tarjeta: 'eleccion', eleccion: { cantidad: 1 } });
      expect(partida.guiado.eleccionPendiente(m.asiento(1).id)).not.toBeNull();
      // Elige, y la respuesta (del mismo despertar) le llega ya
      m.elegir(1, 4);
      expect(m.ultimo(1)?.ficha).toBe('entendido');
    });

    it('los viajeros no cuentan como jugadores', () => {
      const m = mesa('imp', 'poisoner', 'chef', 'empath', 'monk', 'soldier', 'voudon');
      expect(m.fila('esbirros')?.avisos).toEqual([{ tipo: 'pocosJugadores' }]);
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
    const asientos = () => narradora.estado.plaza;
    await arnes.accion(ana, 'sala:sentarse', { jugadorId: asientos()[0].id });
    await arnes.accion(narradora, 'narrador:cambiarPersonaje', { jugadorId: asientos()[0].id, personajeId: 'poisoner' });
    await arnes.accion(narradora, 'narrador:irANoche');
    expect(narradora.estado.habilidadesNoche.find((h) => h.personaje === 'poisoner')?.estado).toBe('listo');
    expect(ana.estado.habilidadesNoche).toEqual([]);

    await arnes.accion(narradora, 'narrador:despertarHabilidad', { personajeId: 'poisoner' });
    expect(ana.estado.despertares[0].mensajes.slice(-1)[0]?.eleccion).toEqual({ cantidad: 1, puedeElegirse: true });
    const dos = await arnes.intentar(ana, 'despertar:enviar', { ficha: 'jugador', jugadores: [asientos()[1].id, asientos()[2].id] });
    expect(dos).toEqual({ ok: false, error: 'Elige un jugador.' });
    expect((await arnes.intentar(ana, 'despertar:enviar', { ficha: 'entendido' })).ok).toBe(false);
    await arnes.accion(ana, 'despertar:enviar', { ficha: 'jugador', jugadores: [asientos()[1].id] });
    expect(narradora.estado.plaza[1].recordatorios.map((r) => r.texto)).toEqual(['Poisoned']);
    expect(ana.estado.despertares[0].mensajes.slice(-1)[0]).toMatchObject({ autor: 'narrador', ficha: 'entendido' });
  });

  it('a lo demás de su habilidad, el jugador solo contesta «Entendido» o con un texto', async () => {
    arnes = await Arnes.crear({
      guiones: { guionPredeterminado: async () => guionTroubleBrewing(), importar: async () => guionTroubleBrewing() },
    });
    const narradora = await arnes.entrar('Nora');
    const ana = await arnes.entrar('Ana');
    await arnes.accion(narradora, 'sala:hacerseNarrador');
    await arnes.accion(narradora, 'narrador:cambiarGuion', { predeterminado: 'troublebrewing' });
    const asientos = () => narradora.estado.plaza;
    await arnes.accion(ana, 'sala:sentarse', { jugadorId: asientos()[0].id });
    await arnes.accion(narradora, 'narrador:cambiarPersonaje', { jugadorId: asientos()[0].id, personajeId: 'chef' });
    await arnes.accion(narradora, 'narrador:irANoche');

    await arnes.accion(narradora, 'narrador:despertarHabilidad', { personajeId: 'chef' });
    expect(ana.estado.despertares[0].mensajes.slice(-1)[0]).toMatchObject({ autor: 'narrador', guiado: true });
    const si = await arnes.intentar(ana, 'despertar:enviar', { ficha: 'si' });
    expect(si).toEqual({ ok: false, error: 'Contesta «Entendido» o escribe un mensaje al narrador.' });
    await arnes.accion(ana, 'despertar:enviar', { ficha: 'personalizado', texto: '¿Seguro?' });
    await arnes.accion(ana, 'despertar:enviar', { ficha: 'entendido' });

    // Si después el narrador le manda algo a mano, contesta con lo que quiera
    await arnes.accion(narradora, 'despertar:enviar', { jugadorId: asientos()[0].id, tarjeta: 'habilidad' });
    expect(ana.estado.despertares[0].mensajes.slice(-1)[0]).toMatchObject({ autor: 'narrador', guiado: false });
    await arnes.accion(ana, 'despertar:enviar', { ficha: 'si' });
  });
});
