import { describe, expect, it } from 'vitest';
import { SalaDeJuego } from '../../src/models/SalaDeJuego';
import { BOLSA_DE_SIETE, conSemilla, guionDePrueba, invitado } from './guionDePrueba';

/**
 * La instantánea de la partida (ver Partida.instantanea): restaurarla deja la
 * partida exactamente como estaba, sin tocar quién se sienta dónde.
 */

const siempreViva = () => true;

/** Una partida de siete con la bolsa repartida, en la preparación. */
function partidaRepartida() {
  const juego = new SalaDeJuego(conSemilla(3));
  const { sala, partida } = juego;
  partida.cambiarGuion(guionDePrueba());
  const ids = ['Ana', 'Bea', 'Carlos', 'Dani', 'Eva', 'Fran', 'Gema'].map((nombre, i) => {
    const { id } = sala.participantes.conectar(`s-${nombre}`, `c-${nombre}`, invitado(nombre), siempreViva);
    expect(sala.sentar(id, partida.plaza()[i].id)).toBeNull();
    return id;
  });
  expect(partida.bolsa.llenar(BOLSA_DE_SIETE)).toBeNull();
  expect(partida.repartirPersonajes()).toBeNull();
  return { juego, ids, asiento: (i: number) => partida.plaza()[i].id };
}

/** Lo que se compara: la instantánea en JSON (el guion, por su nombre: no se copia). */
const comoEstaba = (juego: SalaDeJuego) => {
  const { guion, ...resto } = juego.partida.instantanea();
  return { guion: guion?.nombre ?? null, ...JSON.parse(JSON.stringify(resto)) };
};

describe('instantánea de la partida', () => {
  it('restaurarla tal cual no cambia nada', () => {
    const { juego } = partidaRepartida();
    const antes = comoEstaba(juego);
    juego.partida.restaurar(juego.partida.instantanea());
    expect(comoEstaba(juego)).toEqual(antes);
  });

  it('vuelve a como estaba tras una noche y un día con muertes, recordatorios, despertares, faroles y nominaciones', () => {
    const { juego, asiento } = partidaRepartida();
    const { partida } = juego;
    partida.irANoche();
    const foto = partida.instantanea();
    const antes = comoEstaba(juego);

    // La noche: despertares, recordatorios, una muerte, faroles, una nota
    expect(partida.despertares.despertar(asiento(0))).toBeNull();
    partida.mandarDelNarrador(asiento(0), { ficha: null, tarjeta: 'tuEres', jugadores: [], personajes: ['chef'], texto: '', alineamiento: null });
    expect(partida.grimorio.elegirRecordatorio(asiento(1), 'poisoner', 0)).toBeNull();
    partida.grimorio.cambiarVida(asiento(2), true);
    expect(partida.faroles.ponerFarol(0, 'chef')).toBeNull();
    expect(partida.faroles.ponerFarolAsiento(asiento(1), 0, 'empath')).toBeNull();
    expect(partida.grimorio.escribirNota(asiento(3), 'sospechoso')).toBeNull();
    expect(partida.cambiarRecordatorio('chef', true)).toBeNull();
    // El día: la muerte se anuncia, se nomina, se marca y se ejecuta
    partida.amanecer();
    partida.grimorio.confirmarMuerte(asiento(2));
    expect(partida.nominar(asiento(4), asiento(5))).toBeNull();
    expect(partida.marcar(asiento(5), true, true)).toBeNull();
    expect(partida.ejecutarConCalavera(asiento(5))).not.toHaveProperty('error');
    expect(comoEstaba(juego)).not.toEqual(antes);

    partida.restaurar(foto);
    expect(comoEstaba(juego)).toEqual(antes);
  });

  it('no cambia quién se sienta dónde; un asiento añadido después vuelve como al principio', () => {
    const { juego, ids, asiento } = partidaRepartida();
    const { sala, partida } = juego;
    const foto = partida.instantanea();
    sala.levantarJugador(ids[0]);
    expect(sala.anadirAsiento()).toBeNull();
    const nuevo = partida.plaza()[partida.plaza().length - 1].id;
    partida.grimorio.cambiarPersonaje(nuevo, 'chef');
    partida.restaurar(foto);
    expect(partida.plaza()[0].participanteId).toBeNull();
    expect(partida.plaza().find((a) => a.id === asiento(0))?.personaje).not.toBeNull();
    expect(partida.plaza().find((a) => a.id === nuevo)?.personaje).toBeNull();
  });

  it('la instantánea es una copia: lo que cambia después no la toca', () => {
    const { juego, asiento } = partidaRepartida();
    const { partida } = juego;
    const foto = partida.instantanea();
    const enJson = JSON.stringify({ ...foto, guion: null });
    partida.grimorio.cambiarVida(asiento(0), true);
    expect(partida.grimorio.elegirRecordatorio(asiento(1), 'poisoner', 0)).toBeNull();
    expect(JSON.stringify({ ...foto, guion: null })).toEqual(enJson);
  });
});
