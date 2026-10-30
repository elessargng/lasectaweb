import { NUM_FAROLES, type SalaAsiento, type SalaEnvioDespertar } from '../../../contrato/sala';
import { falta, listoVarios, tarjeta, tipoDe, type ContextoNoche, type HabilidadNocturna, type Resultado } from './HabilidadNocturna';
import type { TramoNoche } from './HabilidadNocturna';

/**
 * La primera noche, los esbirros y el demonio se conocen (filas «Esbirros» y
 * «Demonios» del orden de noche). Solo con 7 jugadores o más: los viajeros no
 * cuentan; los asientos libres, sí.
 */
const JUGADORES_MINIMOS = 7;

const pocosJugadores = (ctx: ContextoNoche) => ctx.mesa().filter((a) => tipoDe(ctx, a) !== 'traveller').length < JUGADORES_MINIMOS;

/** Los malvados se conocen la primera noche y el demonio recibe sus faroles: con menos de 7 jugadores (teensy), no. */
export const malvadosSeConocen = (ctx: ContextoNoche) => !pocosJugadores(ctx);

/** Los de un tipo de verdad (no el de su ficha). */
const deTipo = (ctx: ContextoNoche, tipo: string) => ctx.mesa().filter((a) => tipoDe(ctx, a) === tipo);

const ids = (asientos: SalaAsiento[]) => asientos.map((a) => a.id);

/** Despierta a todos los de un tipo: a cada uno se le manda lo suyo. No eligen. */
abstract class InformacionMalvada implements HabilidadNocturna {
  readonly eleccion = null;
  readonly despiertaAlMorir = false;
  readonly tramo: TramoNoche = 'malvados';

  constructor(
    /** La fila del orden de noche (y de su ficha recordatorio). */
    readonly personaje: 'esbirros' | 'demonios',
    private readonly tipo: 'minion' | 'demon',
  ) {}

  despiertan(ctx: ContextoNoche): SalaAsiento[] {
    return deTipo(ctx, this.tipo);
  }

  preparar(ctx: ContextoNoche, asiento: SalaAsiento): Resultado {
    if (pocosJugadores(ctx)) return falta([{ tipo: 'pocosJugadores' }]);
    return this.informar(ctx, asiento);
  }

  alElegir(): Resultado {
    return falta([]);
  }

  /** Lo que se le manda. */
  protected abstract informar(ctx: ContextoNoche, asiento: SalaAsiento): Resultado;
}

/** Cada esbirro ve quién es el demonio y quiénes son los esbirros (si hay más). */
class Esbirros extends InformacionMalvada {
  constructor() {
    super('esbirros', 'minion');
  }

  protected informar(ctx: ContextoNoche): Resultado {
    const demonios = deTipo(ctx, 'demon');
    const esbirros = deTipo(ctx, 'minion');
    const envios: SalaEnvioDespertar[] = [
      ...(demonios.length ? [tarjeta('demonio', { jugadores: ids(demonios) })] : []),
      ...(esbirros.length > 1 ? [tarjeta('esbirros', { jugadores: ids(esbirros) })] : []),
    ];
    return listoVarios(envios);
  }
}

/** El demonio ve a sus esbirros y 3 personajes buenos que no están en juego (los faroles del narrador). */
class Demonios extends InformacionMalvada {
  constructor() {
    super('demonios', 'demon');
  }

  protected informar(ctx: ContextoNoche): Resultado {
    const faroles = ctx.faroles().filter((id): id is string => !!id);
    if (faroles.length < NUM_FAROLES) return falta([{ tipo: 'faltanFaroles' }]);
    const esbirros = deTipo(ctx, 'minion');
    return listoVarios([
      ...(esbirros.length ? [tarjeta('esbirros', { jugadores: ids(esbirros) })] : []),
      tarjeta('noEnJuego', { personajes: faroles }),
    ]);
  }
}

export const esbirros = new Esbirros();
export const demonios = new Demonios();
