import { describe, expect, it } from 'vitest';
import { Sala, SALA_ASIENTOS } from '../../src/models/sala/Sala';
import { invitado, conSemilla } from './guionDePrueba';

const siempreViva = () => true;

/** Una sala con los jugadores dados sentados en los primeros asientos, en orden. */
function salaConJugadores(...nombres: string[]) {
  const sala = new Sala(conSemilla(1));
  const ids = nombres.map((nombre, i) => {
    const { id } = sala.participantes.conectar(`socket-${nombre}`, `cliente-${nombre}`, invitado(nombre), siempreViva);
    expect(sala.sentar(id, sala.jugadores()[i].id)).toBeNull();
    return id;
  });
  return { sala, ids };
}

/** Quién juega a cada jugador de la plaza, en orden (null: nadie). */
const ocupantes = (sala: Sala) => sala.jugadores().map((j) => j.participanteId);

describe('Sala', () => {
  it('empieza con los asientos iniciales, cada uno con un jugador al que no juega nadie', () => {
    const sala = new Sala(conSemilla(1));
    expect(sala.jugadores()).toHaveLength(SALA_ASIENTOS.inicial);
    expect(sala.jugadores().every((j) => j.ocupante.tipo === 'vacio')).toBe(true);
  });

  it('al sentarse se pasa a jugador y al levantarse, a visitante', () => {
    const { sala, ids } = salaConJugadores('Ana');
    expect(sala.participantes.buscar(ids[0])?.rol).toBe('jugador');
    expect(sala.jugadorDe(ids[0])).toBe(sala.jugadores()[0]);
    sala.levantar(ids[0]);
    expect(sala.participantes.buscar(ids[0])?.rol).toBe('visitante');
    expect(sala.jugadorDe(ids[0])).toBeNull();
  });

  it('no sienta en un asiento ocupado ni en uno que no existe', () => {
    const { sala } = salaConJugadores('Ana');
    const { id } = sala.participantes.conectar('socket-Bea', 'cliente-Bea', invitado('Bea'), siempreViva);
    expect(sala.sentar(id, sala.jugadores()[0].id)).toBe('Ese asiento ya está ocupado.');
    expect(sala.sentar(id, 'no-existe')).toBe('Ese asiento ya no existe.');
  });

  it('el asiento se libera solo cuando su jugador deja de serlo', () => {
    const { sala, ids } = salaConJugadores('Ana');
    sala.participantes.cambiarRol(ids[0], 'narrador');
    expect(sala.jugadores()[0].participanteId).toBeNull();
  });

  it('al quitar el último asiento, quien estaba sentado vuelve a visitante', () => {
    const { sala, ids } = salaConJugadores(...['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    sala.quitarAsiento();
    expect(sala.jugadores()).toHaveLength(SALA_ASIENTOS.inicial - 1);
    expect(sala.participantes.buscar(ids[6])?.rol).toBe('visitante');
  });

  it('al levantarse, su jugador se queda en el asiento sin nadie, y quien se sienta pasa a jugarlo', () => {
    const { sala, ids } = salaConJugadores('Ana');
    const [jugador] = sala.jugadores();
    jugador.morir(false);
    sala.levantar(ids[0]);
    expect(sala.jugadores()[0]).toBe(jugador);
    expect(jugador.ocupante).toEqual({ tipo: 'vacio' });
    const bea = sala.participantes.conectar('s-bea', 'c-bea', invitado('Bea'), siempreViva).id;
    expect(sala.sentar(bea, jugador.id)).toBeNull();
    expect(jugador.ocupante).toEqual({ tipo: 'humano', participanteId: bea });
    expect(jugador.muerto).toBe(true);
  });

  it('al cambiarse de silla con otro, los dos jugadores se intercambian el asiento', () => {
    const { sala, ids } = salaConJugadores('Ana', 'Bea');
    const [ana, bea] = sala.jugadores();
    expect(sala.moverOcupante(ana.id, bea.id)).toBeNull();
    expect(sala.jugadores().slice(0, 2)).toEqual([bea, ana]);
    expect(ocupantes(sala).slice(0, 2)).toEqual([ids[1], ids[0]]);
  });

  it('a un asiento libre, se lleva a su jugador y el que no juega nadie pasa al suyo; a su propio asiento, nada', () => {
    const { sala, ids } = salaConJugadores('Ana');
    const [ana, , libre] = sala.jugadores();
    expect(sala.moverOcupante(ana.id, ana.id)).toBeNull();
    expect(sala.jugadores()[0]).toBe(ana);
    expect(sala.moverOcupante(ana.id, libre.id)).toBeNull();
    expect(sala.jugadores()[0]).toBe(libre);
    expect(sala.jugadores()[2]).toBe(ana);
    expect(ana.participanteId).toBe(ids[0]);
    expect(sala.moverOcupante(libre.id, ana.id)).toBe('Ya no hay nadie en ese asiento.');
  });

  it('al mezclar, los mismos jugadores (con quien los juega) cambian de asiento', () => {
    const { sala, ids } = salaConJugadores('Ana', 'Bea', 'Carlos');
    const antes = new Map(sala.jugadores().map((j) => [j, j.participanteId]));
    expect(sala.mezclar()).toBe(3);
    expect(new Set(sala.jugadores())).toEqual(new Set(antes.keys()));
    for (const j of sala.jugadores()) expect(j.participanteId).toBe(antes.get(j));
    expect(ocupantes(sala).flatMap((id) => id ?? []).sort()).toEqual([...ids].sort());
  });

  it('los vecinos son el ocupado más cercano a cada lado, saltando los libres', () => {
    // Ana (0), Carlos (2), Dani (3) y Bea (5): Ana tiene a Carlos a un lado y a Bea al otro
    const { sala, ids } = salaConJugadores('Ana', 'Bea', 'Carlos', 'Dani');
    sala.moverOcupante(sala.jugadores()[1].id, sala.jugadores()[5].id);
    expect(sala.sonVecinos(ids[0], ids[2])).toBe(true);
    expect(sala.sonVecinos(ids[0], ids[1])).toBe(true);
    expect(sala.sonVecinos(ids[0], ids[3])).toBe(false);
  });
});
