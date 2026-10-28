import type { GuionResuelto, PersonajeDeGuion, TipoPersonaje } from '../../src/types/guiones';
import type { SalaLlegada } from '../../src/services/partida/Participantes';

/** Un personaje del guion con lo mínimo: su id, su tipo y sus recordatorios. */
export const personaje = (id: string, tipo: TipoPersonaje, recordatorios: string[] = []): PersonajeDeGuion => ({
  id,
  nombre: id,
  tipo,
  habilidad: '',
  icono: null,
  iconoBueno: null,
  iconoMalvado: null,
  recordatorioPrimeraNoche: null,
  recordatorioOtrasNoches: null,
  recordatorios,
  preparacion: false,
  repetible: false,
  conocido: true,
});

/**
 * Un guion pequeño con los personajes que usan los tests: aldeanos, un
 * forastero, esbirros y un demonio; los viajeros y NPCs, del catálogo (no del guion).
 */
export const guionDePrueba = (): GuionResuelto => ({
  nombre: 'Guion de prueba',
  autor: null,
  edicion: null,
  personajes: [
    personaje('washerwoman', 'townsfolk'),
    personaje('librarian', 'townsfolk'),
    personaje('investigator', 'townsfolk'),
    personaje('chef', 'townsfolk'),
    personaje('empath', 'townsfolk'),
    personaje('undertaker', 'townsfolk', ['Die Today']),
    personaje('matron', 'townsfolk'),
    personaje('virgin', 'townsfolk', ['No Ability']),
    personaje('drunk', 'outsider', ['Is The Drunk']),
    personaje('poisoner', 'minion', ['Poisoned']),
    personaje('spy', 'minion'),
    personaje('organgrinder', 'minion', ['About To Die', 'Drunk']),
    personaje('imp', 'demon', ['Dead']),
    personaje('banshee', 'townsfolk', ['Has Ability']),
    personaje('cannibal', 'townsfolk', ['Poisoned', 'Lunch']),
    personaje('leviathan', 'demon', ['1', '2', '3', '4', '5', 'Good Player Executed']),
    personaje('lilmonsta', 'demon', ['Is The Demon']),
  ],
  primeraNoche: [],
  otrasNoches: [],
  npcs: [personaje('gardener', 'fabled'), personaje('tor', 'loric'), personaje('hellslibrarian', 'loric'), personaje('revolutionary', 'fabled', ['Used'])],
  viajeros: [personaje('voudon', 'traveller'), personaje('butcher', 'traveller'), personaje('apprentice', 'traveller', ['Is The Apprentice'])],
  bootlegger: [],
  fondo: null,
  djinn: [],
});

/** Los 7 de la bolsa de una partida de 7: 5 aldeanos, 1 esbirro y 1 demonio. */
export const BOLSA_DE_SIETE = ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'poisoner', 'imp'];

export const invitado = (nombre: string): SalaLlegada => ({
  identidad: 'invitado',
  nombreBase: nombre,
  alias: '',
  conCuenta: false,
  avatarPorDefecto: '/logo-2.png',
  avatarElegido: null,
  partidasJugadas: null,
});

export const conCuenta = (userId: string, nombre: string, partidasJugadas: number | null = 20): SalaLlegada => ({
  identidad: `u:${userId}`,
  nombreBase: nombre,
  alias: '',
  conCuenta: true,
  avatarPorDefecto: null,
  avatarElegido: null,
  partidasJugadas,
});

/** Trouble Brewing, con lo que usan los tests del despertar guiado (los personajes con sus recordatorios). */
export const guionTroubleBrewing = (): GuionResuelto => ({
  ...guionDePrueba(),
  nombre: 'Trouble Brewing',
  edicion: 'troublebrewing',
  personajes: [
    personaje('washerwoman', 'townsfolk', ['Townsfolk', 'Wrong']),
    personaje('librarian', 'townsfolk', ['Outsider', 'Wrong']),
    personaje('investigator', 'townsfolk', ['Minion', 'Wrong']),
    personaje('chef', 'townsfolk'),
    personaje('empath', 'townsfolk'),
    personaje('fortuneteller', 'townsfolk', ['Red Herring']),
    personaje('undertaker', 'townsfolk', ['Die Today']),
    personaje('monk', 'townsfolk', ['Safe']),
    personaje('ravenkeeper', 'townsfolk'),
    personaje('soldier', 'townsfolk'),
    personaje('mayor', 'townsfolk'),
    personaje('virgin', 'townsfolk', ['No Ability']),
    personaje('butler', 'outsider', ['Master']),
    personaje('drunk', 'outsider', ['Is The Drunk']),
    personaje('recluse', 'outsider'),
    personaje('poisoner', 'minion', ['Poisoned']),
    personaje('spy', 'minion'),
    personaje('scarletwoman', 'minion', ['Is The Demon']),
    personaje('imp', 'demon', ['Dead']),
  ],
});
