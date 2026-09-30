import crypto from 'crypto';
import { LedgerEntry, VoteChoice, CloseReason, LedgerKind } from '../types/plaza';

/**
 * Núcleo criptográfico del registro sellado de La Plaza.
 *
 * Cada entrada del registro lleva una huella (SHA-256) que incluye la huella de
 * la entrada anterior. Alterar una entrada rompe su propia huella y, en cascada,
 * la de todas las siguientes: el registro se delata a sí mismo.
 *
 * Este fichero se mantiene deliberadamente sin dependencias externas y sin
 * acceso a base de datos, para que el script de verificación pública pueda
 * reutilizar exactamente la misma lógica fuera del servidor.
 */

/** Huella de la entrada inicial de una cadena (no hay anterior). */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Separador con el que se unen las condiciones al calcular una huella.
 *
 * Es un carácter de control (U+001F, "unit separator") que no puede aparecer en
 * un texto escrito a mano, así que dos listas distintas nunca colisionan.
 * Cambiarlo invalidaría todas las huellas existentes.
 */
const BULLET_SEPARATOR = '\u001f';

/** Campos que entran en la huella de una entrada. */
export interface HashableEntry {
  id: string;
  proposalId: string;
  sequence: number;
  kind: LedgerKind;
  choice?: VoteChoice;
  refId?: string;
  closeReason?: CloseReason;
  /** Solo en 'voto': true si sustituye a un voto anulado del mismo votante. */
  isRevote?: boolean;
  /**
   * Solo en 'apertura': huella del contenido que se somete a votación.
   *
   * Sella el título, la descripción y —si es un edicto— el texto propuesto para
   * la norma. Sin esto, el contenido de una propuesta se podría editar a mitad
   * de la votación sin romper la cadena, y la gente acabaría votando un texto
   * distinto del que leyó.
   */
  contentHash?: string;
  createdAt: Date | string;
  prevHash: string;
}

/**
 * Serializa una entrada de forma estable y calcula su huella.
 *
 * El orden y el separador son parte del contrato: cambiarlos invalidaría todas
 * las cadenas existentes y los archivos públicos ya descargados.
 *
 * El sello queda fuera a propósito: no lo conoce el servidor, y su huella se
 * guarda aparte para poder localizar el voto sin exponerlo.
 */
export function computeHash(entry: HashableEntry): string {
  const createdAt =
    entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt;

  const payload = [
    entry.id,
    entry.proposalId,
    String(entry.sequence),
    entry.kind,
    entry.choice ?? '',
    entry.refId ?? '',
    entry.closeReason ?? '',
    entry.isRevote ? '1' : '',
    entry.contentHash ?? '',
    createdAt,
    entry.prevHash
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Huella del contenido que se somete a votación.
 *
 * Queda anclada en la entrada de apertura de la cadena, así que el enunciado de
 * una propuesta es inmutable desde el momento en que se convoca: cualquier
 * cambio posterior rompe la cadena desde el primer eslabón y el vigilante lo
 * detecta.
 *
 * El orden de los campos es parte del contrato, igual que en computeHash.
 */
export function computeProposalContentHash(content: {
  title: string;
  description: string;
  kind: string;
  mode: string;
  targetAction?: string;
  targetRuleId?: string;
  proposedBody?: string;
  proposedBullets?: string[];
  proposedSectionId?: string;
}): string {
  const payload = [
    content.title,
    content.description,
    content.kind,
    content.mode,
    content.targetAction ?? '',
    content.targetRuleId ?? '',
    content.proposedBody ?? '',
    // Las condiciones se serializan con un separador que no puede aparecer
    // dentro de una de ellas, para que dos listas distintas no colisionen.
    (content.proposedBullets ?? []).join(BULLET_SEPARATOR),
    content.proposedSectionId ?? ''
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Huella de una versión de una norma del Códice.
 *
 * Cada versión se encadena con la anterior de la misma norma, igual que las
 * entradas de una votación. Así el Códice tampoco se puede editar a mano: un
 * UPDATE sobre el texto de una ley rompe su cadena de versiones.
 *
 * `proposalFinalHash` liga la versión a la votación que la aprobó, de forma que
 * se pueda comprobar que el texto en vigor es exactamente el que se votó.
 */
export function computeVersionHash(version: {
  ruleId: string;
  version: number;
  body: string;
  bullets: string[];
  origin: string;
  proposalId?: string;
  proposalFinalHash?: string;
  createdAt: Date | string;
  prevHash: string;
}): string {
  const createdAt =
    version.createdAt instanceof Date ? version.createdAt.toISOString() : version.createdAt;

  const payload = [
    version.ruleId,
    String(version.version),
    version.body,
    version.bullets.join(BULLET_SEPARATOR),
    version.origin,
    version.proposalId ?? '',
    version.proposalFinalHash ?? '',
    createdAt,
    version.prevHash
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Recorre el histórico de una norma y comprueba que cada versión encaja con la
 * anterior.
 *
 * Recibe las versiones en orden ascendente (la 1 primero).
 */
export function verifyVersionChain(
  versions: Array<{
    ruleId: string;
    version: number;
    body: string;
    bullets: string[];
    origin: string;
    proposalId?: string;
    proposalFinalHash?: string;
    createdAt: Date | string;
    prevHash: string;
    hash: string;
  }>
): { ok: boolean; problem?: string; brokenAtVersion?: number } {
  let expectedPrev = GENESIS_HASH;

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i];

    if (version.version !== i + 1) {
      return {
        ok: false,
        problem: `Falta una versión o el orden es incorrecto: se esperaba la ${i + 1} y hay la ${version.version}.`,
        brokenAtVersion: version.version
      };
    }

    if (version.prevHash !== expectedPrev) {
      return {
        ok: false,
        problem: `La versión ${version.version} no enlaza con la anterior.`,
        brokenAtVersion: version.version
      };
    }

    if (computeVersionHash(version) !== version.hash) {
      return {
        ok: false,
        problem: `El texto de la versión ${version.version} no corresponde a su huella.`,
        brokenAtVersion: version.version
      };
    }

    expectedPrev = version.hash;
  }

  return { ok: true };
}

/**
 * Diccionario de sellos. Palabras del imaginario de La Secta, elegidas para que
 * se puedan leer en voz alta, apuntar en un papel y dictar por teléfono sin
 * ambigüedad.
 *
 * Se evitan palabras que suenen parecido entre sí y las que puedan confundirse
 * al dictarlas. Ampliar la lista es seguro; reordenarla o quitar entradas
 * cambiaría los sellos ya emitidos, así que solo se puede añadir al final.
 */
const SEAL_NOUNS = [
  'CUERVO', 'ABISMO', 'NIEBLA', 'CIRIO', 'GRIMORIO', 'SUDARIO', 'CALIZ', 'OSARIO',
  'ECLIPSE', 'VELO', 'CENIZA', 'ORACULO', 'CRIPTA', 'ESPEJO', 'RELIQUIA', 'UMBRAL',
  'AUGURIO', 'MORTAJA', 'PENDULO', 'SEPULCRO', 'ALTAR', 'TALISMAN', 'LAMPARA', 'CADENA',
  'CORONA', 'DAGA', 'PERGAMINO', 'CLEPSIDRA', 'BRASERO', 'AMULETO', 'CATACUMBA', 'LINTERNA',
  'BOVEDA', 'CAMPANA', 'CLAVE', 'ESTANDARTE', 'FANAL', 'GARGOLA', 'HOGUERA', 'INCIENSO'
];

const SEAL_ADJECTIVES = [
  'LUNAR', 'OSCURO', 'ANTIGUO', 'ROTO', 'SILENTE', 'ETERNO', 'OCULTO', 'FRIO',
  'PROFUNDO', 'SOMBRIO', 'SAGRADO', 'PERDIDO', 'VELADO', 'ARDIENTE', 'MUDO', 'LEJANO',
  'HUECO', 'GRIS', 'CARMESI', 'NOCTURNO', 'VACIO', 'SOLEMNE', 'ARCANO', 'YERTO',
  'TENUE', 'ADUSTO', 'FUNESTO', 'AUSTERO', 'LIVIDO', 'ESQUIVO', 'TACITO', 'AGRESTE'
];

/**
 * Números con nombre para el tercer componente. Se usan palabras en lugar de
 * cifras para que el sello completo se pueda dictar sin confundir dígitos.
 */
const SEAL_NUMBERS = [
  'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO',
  'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS',
  'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
  'CIEN', 'MIL', 'CERO', 'CENTENA', 'DECENA', 'MILLAR', 'DOBLE', 'TRIPLE'
];

/**
 * Cuarto componente. Con tres palabras el espacio era de 40.960 combinaciones,
 * suficiente en teoría pero con demasiadas colisiones por la paradoja del
 * cumpleaños (unas 290 cada 5.000 sellos). La cuarta palabra lo eleva a casi un
 * millón y las vuelve anecdóticas, a cambio de un sello algo más largo.
 */
const SEAL_SIGILS = [
  'SELLADO', 'ATADO', 'GRABADO', 'INSCRITO', 'JURADO', 'FIRMADO', 'TRAZADO', 'MARCADO',
  'GUARDADO', 'CUSTODIO', 'CERRADO', 'FIJADO', 'ANOTADO', 'LABRADO', 'PRENDIDO', 'ASENTADO',
  'CONSIGNADO', 'REFRENDADO', 'RUBRICADO', 'ESCULPIDO', 'TALLADO', 'ACUNADO', 'CINCELADO', 'IMPRESO'
];

/**
 * Espacio de combinaciones: 40 x 32 x 32 x 24 = 983.040 sellos distintos.
 * Muy por encima del volumen de votos previsible. Las colisiones que aun así
 * puedan darse se resuelven al insertar: la restricción UNIQUE del registro
 * rechaza un sello repetido dentro de la misma propuesta.
 */
export const SEAL_SPACE =
  SEAL_NOUNS.length * SEAL_ADJECTIVES.length * SEAL_NUMBERS.length * SEAL_SIGILS.length;

/**
 * Convierte un secreto en las cuatro palabras legibles del sello.
 *
 * El sello ES el secreto: quien vota lo genera en su navegador y el servidor
 * nunca lo recibe entero. De él se derivan dos tokens independientes —uno para
 * la urna y otro para el censo— de forma que anular un voto y recuperar el
 * turno sean dos operaciones que el servidor no puede relacionar entre sí.
 *
 * `attempt` permite obtener una derivación alternativa si el sello resultante
 * ya está en uso dentro de la misma propuesta.
 */
export function sealFromSecret(secret: string, attempt = 0): string {
  const source = crypto
    .createHash('sha256')
    .update(attempt === 0 ? secret : `${secret}|${attempt}`, 'utf8')
    .digest('hex');

  // Se toman tramos separados del hash para que los cuatro componentes sean
  // independientes entre sí.
  const noun = parseInt(source.slice(0, 8), 16) % SEAL_NOUNS.length;
  const adjective = parseInt(source.slice(8, 16), 16) % SEAL_ADJECTIVES.length;
  const number = parseInt(source.slice(16, 24), 16) % SEAL_NUMBERS.length;
  const sigil = parseInt(source.slice(24, 32), 16) % SEAL_SIGILS.length;

  return `${SEAL_NOUNS[noun]} ${SEAL_ADJECTIVES[adjective]} ${SEAL_NUMBERS[number]} ${SEAL_SIGILS[sigil]}`;
}

/**
 * Deriva del sello los dos tokens que lo hacen funcionar.
 *
 * - `urna`  localiza el voto en el registro, para poder anularlo.
 * - `censo` localiza la participación, para poder recuperar el turno de voto.
 *
 * Que ambos salgan del mismo sello solo lo sabe quien tiene el sello. El
 * servidor guarda únicamente sus huellas, en dos tablas sin relación: no puede
 * emparejar un voto con la persona que lo emitió ni siquiera al anularlo.
 *
 * Esta es la pieza que impide que alguien con un sello ajeno se apropie del
 * turno de voto: podrá destruir ese voto, pero el turno solo lo recupera quien
 * pueda presentar el token de censo, que va contra la fila de su propietario.
 */
export function deriveTokens(seal: string): { urna: string; censo: string } {
  // El sello se normaliza antes de derivar, para que quien lo teclee con
  // minúsculas o guiones obtenga exactamente los mismos tokens.
  const normalized = normalizeSeal(seal);
  return {
    urna: crypto.createHmac('sha256', normalized).update('urna', 'utf8').digest('hex'),
    censo: crypto.createHmac('sha256', normalized).update('censo', 'utf8').digest('hex')
  };
}

/** Huella con la que se almacena un token. El token en claro nunca se guarda. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Genera un sello nuevo al azar.
 *
 * El cliente genera el suyo en el navegador; esta versión existe para poder
 * probar el flujo completo desde el servidor, sin navegador.
 */
export function generateSeal(): string {
  return sealFromSecret(crypto.randomBytes(32).toString('hex'));
}

/**
 * Normaliza un sello introducido a mano para poder buscarlo.
 *
 * Quien lo teclea puede usar minúsculas, guiones, acentos o espacios de más;
 * todo eso debe encontrar el voto igualmente.
 */
export function normalizeSeal(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')        // guiones, puntos y cifras pasan a separador
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Recorre una cadena y comprueba que cada eslabón encaja con el anterior.
 *
 * Es la misma comprobación que ejecuta el vigilante y que puede ejecutar
 * cualquiera con el archivo público descargado.
 */
export function verifyChain(entries: LedgerEntry[]): {
  ok: boolean;
  problem?: string;
  brokenAtSequence?: number;
} {
  let expectedPrev = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.sequence !== i + 1) {
      return {
        ok: false,
        problem: `Falta una entrada o el orden es incorrecto: se esperaba la posición ${i + 1} y se encontró la ${entry.sequence}.`,
        brokenAtSequence: entry.sequence
      };
    }

    if (entry.prevHash !== expectedPrev) {
      return {
        ok: false,
        problem: `La entrada ${entry.sequence} no enlaza con la anterior.`,
        brokenAtSequence: entry.sequence
      };
    }

    const recomputed = computeHash(entry);
    if (recomputed !== entry.hash) {
      return {
        ok: false,
        problem: `La huella de la entrada ${entry.sequence} no corresponde a su contenido.`,
        brokenAtSequence: entry.sequence
      };
    }

    expectedPrev = entry.hash;
  }

  return { ok: true };
}

/**
 * Calcula el recuento vigente recorriendo la cadena.
 *
 * Un voto cuenta salvo que exista una anulación posterior que lo referencie.
 * Se calcula sobre la cadena y no con un COUNT en SQL a propósito: así el
 * recuento publicado y el que cualquiera obtiene del archivo descargado
 * proceden de la misma fuente y del mismo código.
 */
export function computeTally(entries: LedgerEntry[]): {
  si: number;
  no: number;
  total: number;
  anulacionesSinRevoto: number;
} {
  const annulled = new Set<string>();
  for (const entry of entries) {
    if (entry.kind === 'anulacion' && entry.refId) {
      annulled.add(entry.refId);
    }
  }

  let si = 0;
  let no = 0;
  let revotes = 0;
  for (const entry of entries) {
    if (entry.kind !== 'voto' || annulled.has(entry.id)) continue;
    if (entry.isRevote) revotes++;
    if (entry.choice === 'si') si++;
    else if (entry.choice === 'no') no++;
  }

  // Cada anulación libera a su autor para volver a votar. Las anulaciones que
  // no fueron seguidas de un nuevo voto son exactamente la diferencia entre el
  // número de participantes y el de votos vigentes, y son la cifra que permite
  // cuadrar las cuentas desde fuera:
  //
  //     votos vigentes = participantes - anulacionesSinRevoto
  //
  // El revoto se marca en la propia entrada al emitirla (isRevote), porque
  // desde la cadena no se puede deducir: sin identidades, un voto posterior a
  // una anulación puede ser igualmente el primer voto de otra persona.
  const anulacionesSinRevoto = annulled.size - revotes;

  return { si, no, total: si + no, anulacionesSinRevoto };
}
