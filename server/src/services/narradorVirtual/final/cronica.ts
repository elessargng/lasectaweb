import type { SalaAsiento, SalaEnvioDespertar } from '../../../contrato/sala';
import type { SalaService } from '../../SalaService';
import { FRASES, type InfoRevelada, type MuerteRevelada } from '../frases';
import { nombreDeAsiento, tipoReal } from '../mesaDeJuego';
import { numeroDe } from '../noche/informacionFalsa';

/**
 * Lo que pasa en la partida, apuntado para contarlo al revelar el grimorio: la
 * información que recibe cada uno cada noche (y si era falsa) y cómo y cuándo muere.
 * Los despertares se cierran al amanecer, así que se apunta al amanecer.
 */
export interface Cronica {
  /** Por asiento, lo que el narrador le dio de noche. */
  info: Map<string, { noche: number; envio: SalaEnvioDespertar; falsa: boolean }[]>;
  /** Las falsas (droison y mentira) de esta noche, por asiento, hasta apuntarlas al amanecer. */
  falsas: Set<string>;
  muertes: Map<string, MuerteRevelada>;
  /** La última noche que se ha jugado. */
  ultimaNoche: number;
}

export const cronicaNueva = (): Cronica => ({ info: new Map(), falsas: new Set(), muertes: new Map(), ultimaNoche: 0 });

/** Si un mensaje del narrador es información (un número, un sí o un no, un alineamiento, «Este jugador es»). */
const esInformacion = (m: SalaEnvioDespertar): boolean =>
  numeroDe(m) !== null || ['si', 'no', 'bueno', 'malvado'].includes(m.ficha ?? '') || m.tarjeta === 'esteJugadorEs';

/**
 * Al amanecer (antes de cerrar los despertares): la información que ha dado esta
 * noche a los buenos y quién ha muerto y por qué (el demonio, si lo ha elegido).
 */
export function apuntarNoche(cronica: Cronica, sala: SalaService): void {
  const noche = sala.fase().numero;
  cronica.ultimaNoche = noche;
  const asientos = sala.asientos();
  const despertares = sala.despertares();
  for (const { asiento, mensajes } of despertares) {
    const a = asientos.find((x) => x.id === asiento);
    if (!a || sala.alineamientoEfectivo(a) === 'malvado') continue;
    const dados = mensajes.filter((m) => m.autor === 'narrador' && !m.eleccion && esInformacion(m));
    if (!dados.length) continue;
    const lista = cronica.info.get(asiento) ?? [];
    for (const envio of dados) lista.push({ noche, envio, falsa: cronica.falsas.has(asiento) });
    cronica.info.set(asiento, lista);
  }
  cronica.falsas.clear();
  // Quién eligió a cada muerto: si fue un demonio, a sus manos (o se mató él, el Imp que pasa)
  for (const muerto of asientos.filter((a) => a.muertePendiente)) {
    const demonio = despertares.find((d) => {
      const quien = asientos.find((x) => x.id === d.asiento);
      return !!quien && tipoReal(sala, quien) === 'demon' && d.mensajes.some((m) => m.ficha === 'jugador' && m.jugadores.includes(muerto.id));
    });
    const causa = !demonio ? 'otra' : demonio.asiento === muerto.id ? 'suicidio' : 'demonio';
    cronica.muertes.set(muerto.id, { momento: 'noche', numero: noche, causa });
  }
}

/** Una muerte de día (ejecución o disparo del Exterminador). */
export function apuntarMuerteDeDia(cronica: Cronica, sala: SalaService, asiento: string, causa: 'ejecucion' | 'exterminador'): void {
  cronica.muertes.set(asiento, { momento: 'dia', numero: sala.fase().numero, causa });
}

/** Lo que se cuenta de un asiento al revelar su ficha. */
export function fraseAlRevelar(cronica: Cronica, sala: SalaService, asiento: SalaAsiento): string {
  const nombreP = (id: string) => sala.personaje(id)?.nombre ?? id;
  const nombre = (id: string) => nombreDeAsiento(sala, id);
  const identidad = sala.identidad(asiento) ?? asiento.personaje;
  const infos: InfoRevelada[] = (cronica.info.get(asiento.id) ?? []).map(({ noche, envio, falsa }) => ({
    noche,
    falsa,
    que: describirInformacion(envio, nombre, nombreP),
  }));
  const muerte = asiento.muerto ? (cronica.muertes.get(asiento.id) ?? null) : null;
  // Despierta cada noche con su información y murió antes de que acabara: dejó de recibirla
  const ficha = asiento.personaje;
  const cadaNoche = !!ficha && infos.length > 0 && (sala.guion()?.otrasNoches ?? []).includes(ficha);
  const antesDelFinal = !!muerte && (muerte.momento === 'noche' || muerte.numero < cronica.ultimaNoche);
  return FRASES.alRevelar({
    nombre: nombreDeAsiento(sala, asiento.id),
    personaje: identidad ? nombreP(identidad) : null,
    creia: ficha && identidad && ficha !== identidad ? nombreP(ficha) : null,
    infos,
    muerte,
    sinMasInformacion: cadaNoche && antesDelFinal,
  });
}

/** Una información en palabras: «un 1», «un sí», «a Ana o a Luis como Lavandera». */
function describirInformacion(envio: SalaEnvioDespertar, nombre: (asiento: string) => string, nombreP: (id: string) => string): string {
  const n = numeroDe(envio);
  if (n !== null) return `un ${n}`;
  if (envio.ficha === 'si') return 'un sí';
  if (envio.ficha === 'no') return 'un no';
  if (envio.ficha === 'bueno' || envio.ficha === 'malvado') return `«${envio.ficha}»`;
  const quienes = envio.jugadores.map((id, i) => (i === 0 ? nombre(id) : `a ${nombre(id)}`));
  const lista = quienes.length <= 1 ? (quienes[0] ?? '') : `${quienes.slice(0, -1).join(', ')} o ${quienes[quienes.length - 1]}`;
  const personajes = envio.personajes.map(nombreP).join(' o ');
  return [lista && `a ${lista}`, personajes && `como ${personajes}`].filter(Boolean).join(' ');
}
