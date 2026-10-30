import type { SalaAsiento, SalaEnvioDespertar } from '../../../contrato/sala';
import { droison } from '../../partida/reglas/ReglaPersonaje';
import type { SalaService } from '../../SalaService';
import { FRASES, type MuerteRevelada, type NocheRevelada } from '../frases';
import { contextoNoche, nombreDeAsiento, tipoReal } from '../mesaDeJuego';
import { numeroDe } from '../noche/informacionFalsa';

/** Lo que hizo alguien una noche: a quiénes eligió, lo que le dio el narrador (y si era falso) y si estaba droison. */
interface NocheApuntada {
  noche: number;
  /** Cada elección, sus asientos (la Pitonisa elige dos de una vez). */
  eligio: string[][];
  infos: { envio: SalaEnvioDespertar; falsa: boolean }[];
  droison: 'envenenado' | 'borracho' | null;
}

/**
 * Lo que pasa en la partida, apuntado para contarlo al revelar el grimorio: lo que
 * elige y la información que recibe cada uno cada noche (y si era falsa o estaba
 * envenenado) y cómo y cuándo muere. Los despertares se cierran al amanecer, así
 * que se apunta al amanecer.
 */
export interface Cronica {
  /** Por asiento, sus noches (solo las que eligió o recibió algo). */
  noches: Map<string, NocheApuntada[]>;
  /** Las falsas (droison y mentira) de esta noche, por asiento, hasta apuntarlas al amanecer. */
  falsas: Set<string>;
  muertes: Map<string, MuerteRevelada>;
  /** Por asiento, el personaje que tenía antes de pasar a ser el Imp (la Mujer Escarlata, el esbirro del Imp que se mata). */
  antes: Map<string, string>;
  /** La última noche que se ha jugado. */
  ultimaNoche: number;
}

export const cronicaNueva = (): Cronica => ({ noches: new Map(), falsas: new Set(), muertes: new Map(), antes: new Map(), ultimaNoche: 0 });

/** Si un mensaje del narrador es información (un número, un sí o un no, un alineamiento, «Este jugador es»). */
const esInformacion = (m: SalaEnvioDespertar): boolean =>
  numeroDe(m) !== null || ['si', 'no', 'bueno', 'malvado'].includes(m.ficha ?? '') || m.tarjeta === 'esteJugadorEs';

/**
 * Al amanecer (antes de cerrar los despertares): lo que ha elegido cada uno esta
 * noche (lo que contesta a «Haz una elección»; por un asiento libre, el narrador),
 * la información que ha dado a los buenos, quién estaba droison y quién ha muerto
 * y por qué (el demonio, si lo ha elegido).
 */
export function apuntarNoche(cronica: Cronica, sala: SalaService): void {
  const noche = sala.fase().numero;
  cronica.ultimaNoche = noche;
  const asientos = sala.asientos();
  const despertares = sala.despertares();
  const ctx = contextoNoche(sala);
  for (const { asiento, mensajes } of despertares) {
    const a = asientos.find((x) => x.id === asiento);
    if (!a) continue;
    // Cada elección: lo primero con jugadores que llega tras pedírsela
    const eligio: string[][] = [];
    mensajes.forEach((m, i) => {
      if (m.autor !== 'narrador' || !m.eleccion) return;
      const respuesta = mensajes.slice(i + 1).find((r) => r.ficha === 'jugador' && r.jugadores.length);
      if (respuesta) eligio.push(respuesta.jugadores);
    });
    const infos =
      sala.alineamientoEfectivo(a) === 'malvado'
        ? []
        : mensajes
            .filter((m) => m.autor === 'narrador' && !m.eleccion && esInformacion(m))
            .map((envio) => ({ envio, falsa: cronica.falsas.has(asiento) }));
    if (!eligio.length && !infos.length) continue;
    const lista = cronica.noches.get(asiento) ?? [];
    lista.push({ noche, eligio, infos, droison: droison(ctx, a) });
    cronica.noches.set(asiento, lista);
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
  const noches: NocheRevelada[] = (cronica.noches.get(asiento.id) ?? []).map((n) => ({
    noche: n.noche,
    eligio: n.eligio.map((ids) => listaConA(ids.map(nombre))),
    infos: n.infos.map(({ envio, falsa }) => ({ que: describirInformacion(envio, nombre, nombreP), falsa })),
    // El Borracho ya lo dice «creía que era…»
    envenenado: n.droison === 'envenenado',
  }));
  const muerte = asiento.muerto ? (cronica.muertes.get(asiento.id) ?? null) : null;
  // Despierta cada noche con su información y murió antes de que acabara: dejó de recibirla
  const ficha = asiento.personaje;
  const antes = cronica.antes.get(asiento.id);
  const conInformacion = noches.some((n) => n.infos.length > 0);
  const cadaNoche = !!ficha && conInformacion && (sala.guion()?.otrasNoches ?? []).includes(ficha);
  const antesDelFinal = !!muerte && (muerte.momento === 'noche' || muerte.numero < cronica.ultimaNoche);
  return FRASES.alRevelar({
    nombre: nombreDeAsiento(sala, asiento.id),
    personaje: identidad ? nombreP(identidad) : null,
    creia: ficha && identidad && ficha !== identidad ? nombreP(ficha) : null,
    antes: antes ? nombreP(antes) : null,
    noches,
    muerte,
    sinMasInformacion: cadaNoche && antesDelFinal,
  });
}

/** «a Ana», «a Ana y a Luis». */
const listaConA = (nombres: string[]) => {
  const conA = nombres.map((n) => `a ${n}`);
  return conA.length <= 1 ? (conA[0] ?? '') : `${conA.slice(0, -1).join(', ')} y ${conA[conA.length - 1]}`;
};

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
