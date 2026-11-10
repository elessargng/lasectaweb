import { describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/models/SalaDeJuego';
import { ConversacionService } from '../../src/services/conversaciones/ConversacionService';
import { conSemilla, guionDePrueba, invitado } from './guionDePrueba';

const siempreViva = () => true;

/** Una sala de día (la preparación) con una narradora y los jugadores dados, sentados en orden. */
function montar(...nombres: string[]) {
  const juego = new SalaDeJuego(conSemilla(1));
  const { sala, partida } = juego;
  partida.cambiarGuion(guionDePrueba());
  const narradora = sala.participantes.conectar('socket-n', 'cliente-n', invitado('Narradora'), siempreViva).id;
  sala.participantes.cambiarRol(narradora, 'narrador');
  const ids = nombres.map((nombre, i) => {
    const { id } = sala.participantes.conectar(`socket-${nombre}`, `cliente-${nombre}`, invitado(nombre), siempreViva);
    expect(sala.sentar(id, partida.plaza()[i].id)).toBeNull();
    return id;
  });
  return { conversaciones: new ConversacionService(juego), narradora, ids };
}

describe('llamar al narrador', () => {
  it('si conversa con otros, se le llama (no se pide unirse) y al aceptar deja la suya por una nueva', () => {
    const { conversaciones: c, narradora, ids } = montar('Ana', 'Bea', 'Ciro');
    const [ana, bea, ciro] = ids;
    c.responder(bea, c.invitar(narradora, bea).id, true);
    c.responder(ciro, c.invitar(narradora, ciro).id, true);
    expect(c.lista().map((x) => x.miembros)).toEqual([[narradora, bea, ciro]]);

    const llamada = c.invitar(ana, narradora);
    expect(llamada.conversacion).toBeUndefined();
    c.responder(narradora, llamada.id, true);

    expect(c.lista().map((x) => x.miembros)).toEqual([[bea, ciro], [ana, narradora]]);
  });

  it('las llamadas que le hacen siguen pendientes aunque entre en otra', () => {
    const { conversaciones: c, narradora, ids } = montar('Ana', 'Bea');
    const [ana, bea] = ids;
    const deAna = c.invitar(ana, narradora);
    const deBea = c.invitar(bea, narradora);
    c.responder(narradora, deAna.id, true);
    expect(c.invitacionesDe(narradora).map((i) => i.id)).toEqual([deBea.id]);
    c.responder(narradora, deBea.id, true);
    // Ana se queda sola en la suya, hasta que salga
    expect(c.lista().map((x) => x.miembros)).toEqual([[ana], [bea, narradora]]);
  });

  it('a un jugador que conversa no se le llama: se pide unirse', () => {
    const { conversaciones: c, ids } = montar('Ana', 'Bea', 'Ciro');
    const [ana, bea, ciro] = ids;
    c.responder(bea, c.invitar(ana, bea).id, true);
    expect(() => c.invitar(ciro, ana)).toThrow('ya está en otra conversación');
  });
});
