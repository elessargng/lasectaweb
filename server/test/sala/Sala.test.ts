import { describe, expect, it } from 'vitest';
import { Sala, SALA_ASIENTOS } from '../../src/services/sala/Sala';
import { invitado } from './guionDePrueba';

const siempreViva = () => true;

/** Una sala con los jugadores dados sentados en los primeros asientos, en orden. */
function salaConJugadores(...nombres: string[]) {
  const sala = new Sala();
  const ids = nombres.map((nombre, i) => {
    const { id } = sala.participantes.conectar(`socket-${nombre}`, `cliente-${nombre}`, invitado(nombre), siempreViva);
    expect(sala.sentar(id, sala.asientos()[i].id)).toBeNull();
    return id;
  });
  const movimientos: Map<string, string>[] = [];
  sala.alMover((destino) => movimientos.push(destino));
  return { sala, ids, movimientos };
}

describe('Sala', () => {
  it('empieza con los asientos iniciales, todos libres', () => {
    const sala = new Sala();
    expect(sala.asientos()).toHaveLength(SALA_ASIENTOS.inicial);
    expect(sala.asientos().every((a) => a.jugador.participanteId === null)).toBe(true);
  });

  it('al sentarse se pasa a jugador y al levantarse, a visitante', () => {
    const { sala, ids } = salaConJugadores('Ana');
    expect(sala.participantes.buscar(ids[0])?.rol).toBe('jugador');
    expect(sala.asientoDe(ids[0])?.id).toBe(sala.asientos()[0].id);
    sala.levantar(ids[0]);
    expect(sala.participantes.buscar(ids[0])?.rol).toBe('visitante');
    expect(sala.asientoDe(ids[0])).toBeNull();
  });

  it('no sienta en un asiento ocupado ni en uno que no existe', () => {
    const { sala } = salaConJugadores('Ana');
    const { id } = sala.participantes.conectar('socket-Bea', 'cliente-Bea', invitado('Bea'), siempreViva);
    expect(sala.sentar(id, sala.asientos()[0].id)).toBe('Ese asiento ya está ocupado.');
    expect(sala.sentar(id, 'no-existe')).toBe('Ese asiento ya no existe.');
  });

  it('el asiento se libera solo cuando su jugador deja de serlo', () => {
    const { sala, ids } = salaConJugadores('Ana');
    sala.participantes.cambiarRol(ids[0], 'narrador');
    expect(sala.asientos()[0].jugador.participanteId).toBeNull();
  });

  it('al quitar el último asiento, quien estaba sentado vuelve a visitante', () => {
    const { sala, ids } = salaConJugadores(...['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    sala.quitarAsiento();
    expect(sala.asientos()).toHaveLength(SALA_ASIENTOS.inicial - 1);
    expect(sala.participantes.buscar(ids[6])?.rol).toBe('visitante');
  });

  it('al mover a un ocupante a un asiento ocupado, se intercambian y avisa', () => {
    const { sala, ids, movimientos } = salaConJugadores('Ana', 'Bea');
    const [uno, dos] = sala.asientos();
    expect(sala.moverOcupante(uno.id, dos.id)).toBeNull();
    expect(uno.jugador.participanteId).toBe(ids[1]);
    expect(dos.jugador.participanteId).toBe(ids[0]);
    expect(movimientos).toEqual([new Map([[uno.id, dos.id], [dos.id, uno.id]])]);
  });

  it('mover a un asiento libre deja libre el de origen; al mismo, no hace nada ni avisa', () => {
    const { sala, ids, movimientos } = salaConJugadores('Ana');
    const [uno, , tres] = sala.asientos();
    expect(sala.moverOcupante(uno.id, uno.id)).toBeNull();
    expect(movimientos).toHaveLength(0);
    expect(sala.moverOcupante(uno.id, tres.id)).toBeNull();
    expect(uno.jugador.participanteId).toBeNull();
    expect(tres.jugador.participanteId).toBe(ids[0]);
    expect(sala.moverOcupante(uno.id, tres.id)).toBe('Ya no hay nadie en ese asiento.');
  });

  it('al levantarse, su jugador se queda en el asiento sin nadie, y quien se sienta pasa a jugarlo', () => {
    const { sala, ids } = salaConJugadores('Ana');
    const [uno] = sala.asientos();
    const jugador = uno.jugador;
    jugador.morir(false);
    sala.levantar(ids[0]);
    expect(uno.jugador).toBe(jugador);
    expect(jugador.ocupante).toEqual({ tipo: 'vacio' });
    const bea = sala.participantes.conectar('s-bea', 'c-bea', invitado('Bea'), siempreViva).id;
    expect(sala.sentar(bea, uno.id)).toBeNull();
    expect(uno.jugador).toBe(jugador);
    expect(jugador.ocupante).toEqual({ tipo: 'humano', participanteId: bea });
    expect(jugador.muerto).toBe(true);
  });

  it('al cambiarse de silla se lleva a su jugador; el de la otra silla pasa a la suya', () => {
    const { sala } = salaConJugadores('Ana');
    const [uno, , tres] = sala.asientos();
    const [deAna, libre] = [uno.jugador, tres.jugador];
    sala.moverOcupante(uno.id, tres.id);
    expect(tres.jugador).toBe(deAna);
    expect(uno.jugador).toBe(libre);
  });

  it('al mezclar, cada uno sigue sentado una vez y el aviso dice dónde ha ido', () => {
    const { sala, ids, movimientos } = salaConJugadores('Ana', 'Bea', 'Carlos');
    const antes = new Map(sala.asientos().map((a) => [a.id, a.jugador.participanteId]));
    expect(sala.mezclar()).toBe(3);
    const ocupantes = sala.asientos().flatMap((a) => a.jugador.participanteId ?? []);
    expect([...ocupantes].sort()).toEqual([...ids].sort());
    const [destino] = movimientos;
    for (const [desde, hasta] of destino) expect(sala.asiento(hasta)?.jugador.participanteId).toBe(antes.get(desde));
  });

  it('los vecinos son el ocupado más cercano a cada lado, saltando los libres', () => {
    // Ana (0), Carlos (2), Dani (3) y Bea (5): Ana tiene a Carlos a un lado y a Bea al otro
    const { sala, ids } = salaConJugadores('Ana', 'Bea', 'Carlos', 'Dani');
    sala.moverOcupante(sala.asientos()[1].id, sala.asientos()[5].id);
    expect(sala.sonVecinos(ids[0], ids[2])).toBe(true);
    expect(sala.sonVecinos(ids[0], ids[1])).toBe(true);
    expect(sala.sonVecinos(ids[0], ids[3])).toBe(false);
  });
});
