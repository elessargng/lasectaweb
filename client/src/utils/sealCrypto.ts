/**
 * Criptografía del sello, en el navegador.
 *
 * El sello se genera aquí y NO se envía nunca entero al servidor. De él se
 * derivan dos tokens independientes:
 *
 *   T_urna  = HMAC(sello, "urna")   -> localiza el voto en el registro
 *   T_censo = HMAC(sello, "censo")  -> localiza la participación
 *
 * El servidor guarda solo las huellas de ambos, en dos tablas sin nada en
 * común. Anular un voto y recuperar el turno son dos llamadas distintas con
 * tokens distintos, así que quien consiga un sello ajeno podrá destruir ese
 * voto pero no apropiarse del turno de quien lo emitió.
 *
 * Debe mantenerse en paralelo con server/src/utils/ledger.ts: el diccionario y
 * el método de derivación son un contrato entre ambos.
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

const SEAL_NUMBERS = [
  'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO',
  'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS',
  'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
  'CIEN', 'MIL', 'CERO', 'CENTENA', 'DECENA', 'MILLAR', 'DOBLE', 'TRIPLE'
];

const SEAL_SIGILS = [
  'SELLADO', 'ATADO', 'GRABADO', 'INSCRITO', 'JURADO', 'FIRMADO', 'TRAZADO', 'MARCADO',
  'GUARDADO', 'CUSTODIO', 'CERRADO', 'FIJADO', 'ANOTADO', 'LABRADO', 'PRENDIDO', 'ASENTADO',
  'CONSIGNADO', 'REFRENDADO', 'RUBRICADO', 'ESCULPIDO', 'TALLADO', 'ACUNADO', 'CINCELADO', 'IMPRESO'
];

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normaliza un sello escrito a mano.
 *
 * Debe coincidir exactamente con normalizeSeal del servidor: si difieren, los
 * tokens derivados no cuadrarían y el sello no encontraría su voto.
 */
export function normalizeSeal(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Genera un sello nuevo al azar, con entropía del navegador. */
export async function generateSeal(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const source = toHex(digest);

  const noun = parseInt(source.slice(0, 8), 16) % SEAL_NOUNS.length;
  const adjective = parseInt(source.slice(8, 16), 16) % SEAL_ADJECTIVES.length;
  const number = parseInt(source.slice(16, 24), 16) % SEAL_NUMBERS.length;
  const sigil = parseInt(source.slice(24, 32), 16) % SEAL_SIGILS.length;

  return `${SEAL_NOUNS[noun]} ${SEAL_ADJECTIVES[adjective]} ${SEAL_NUMBERS[number]} ${SEAL_SIGILS[sigil]}`;
}

/** Deriva del sello los dos tokens. Ver la nota de cabecera. */
export async function deriveTokens(seal: string): Promise<{ urna: string; censo: string }> {
  const normalized = normalizeSeal(seal);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalized),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sign = async (label: string) =>
    toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(label)));

  return { urna: await sign('urna'), censo: await sign('censo') };
}
