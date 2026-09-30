#!/usr/bin/env node
/**
 * Verificador independiente de votaciones de La Plaza.
 *
 * Comprueba que el registro de una votación es íntegro, SIN depender de la web
 * que lo publicó. Ahí está su utilidad: si la comprobación solo se pudiera
 * hacer desde la propia web, habría que confiar en ella.
 *
 * USO
 *   node verificar-votacion.js registro.json [huella-esperada]
 *
 *   registro.json      Archivo descargado de la página de resultados.
 *   huella-esperada    Opcional. Si guardaste la huella final el día del
 *                      cierre, pásala aquí y se comparará con la del archivo.
 *
 * Devuelve 0 si todo encaja y 1 si algo no cuadra.
 *
 * No necesita instalar nada: solo Node.
 */

const crypto = require('crypto');
const fs = require('fs');

const GENESIS_HASH = '0'.repeat(64);

/**
 * Recalcula la huella de una entrada.
 *
 * Debe coincidir exactamente con server/src/utils/ledger.ts. El orden de los
 * campos y el separador son parte del contrato: si cambian, las cadenas ya
 * publicadas dejan de validar.
 */
function computeHash(entry) {
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
    entry.createdAt,
    entry.prevHash
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * El archivo público usa nombres en castellano. Se traducen a los campos con
 * los que se calculó la huella.
 */
/**
 * Huella del enunciado sometido a votación.
 *
 * Debe coincidir con computeProposalContentHash de server/src/utils/ledger.ts.
 */
function computeContentHash(e) {
  const payload = [
    e.titulo,
    e.descripcion ?? '',
    e.clase,
    e.modo,
    e.accionCodice ?? '',
    e.normaAfectada ?? '',
    e.textoPropuesto ?? '',
    (e.condicionesPropuestas ?? []).join(''),
    e.seccionDestino ?? ''
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function toHashable(linea, proposalId) {
  return {
    id: linea.id,
    proposalId,
    sequence: linea.posicion,
    kind: linea.tipo,
    choice: linea.opcion ?? undefined,
    refId: linea.anula ?? undefined,
    closeReason: linea.motivoCierre ?? undefined,
    isRevote: linea.esRevoto === true,
    contentHash: linea.huellaEnunciado ?? undefined,
    createdAt: linea.fecha,
    prevHash: linea.huellaAnterior
  };
}

function main() {
  const [archivo, huellaEsperada] = process.argv.slice(2);

  if (!archivo) {
    console.error('Uso: node verificar-votacion.js registro.json [huella-esperada]');
    process.exit(1);
  }

  let datos;
  try {
    datos = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch (err) {
    console.error(`No se pudo leer el archivo: ${err.message}`);
    process.exit(1);
  }

  const { propuesta, recuento, registro, votantes } = datos;

  if (!propuesta || !Array.isArray(registro)) {
    console.error('El archivo no tiene el formato esperado: faltan "propuesta" o "registro".');
    process.exit(1);
  }

  console.log('');
  console.log(`Votación: ${propuesta.titulo}`);
  console.log(`Clase: ${propuesta.clase}   Modo: ${propuesta.modo}   Estado: ${propuesta.estado}`);
  console.log(`Cerrada: ${propuesta.cerrada ?? '(sin cerrar)'}   Motivo: ${propuesta.motivoCierre ?? '-'}`);
  console.log('');

  let problemas = 0;

  // ---------------------------------------------------------- 1. La cadena
  let esperadoPrev = GENESIS_HASH;

  for (let i = 0; i < registro.length; i++) {
    const linea = registro[i];

    if (linea.posicion !== i + 1) {
      console.log(`✗ Falta una entrada o el orden es incorrecto: se esperaba la posición ${i + 1} y hay la ${linea.posicion}.`);
      problemas++;
      break;
    }

    if (linea.huellaAnterior !== esperadoPrev) {
      console.log(`✗ La entrada ${linea.posicion} no enlaza con la anterior.`);
      problemas++;
      break;
    }

    // Se recalcula la huella a partir del contenido de la entrada: si alguien
    // hubiera cambiado un voto, la huella recalculada no coincidiría.
    const recalculada = computeHash(toHashable(linea, propuesta.id));
    if (recalculada !== linea.huella) {
      console.log(`✗ La huella de la entrada ${linea.posicion} no corresponde a su contenido.`);
      problemas++;
      break;
    }

    esperadoPrev = linea.huella;
  }

  const cadenaIntegra = problemas === 0;
  if (cadenaIntegra) {
    console.log(`✓ La cadena encaja de principio a fin (${registro.length} entradas).`);
  } else {
    // Si la cadena está rota, el contenido del registro ya no es de fiar y las
    // comprobaciones que siguen pueden dar resultados engañosos.
    console.log('  (la cadena está rota: las comprobaciones siguientes son solo informativas)');
  }

  // ------------------------------------------------ 2. El enunciado votado
  const { enunciado } = datos;
  const apertura = registro.find((l) => l.tipo === 'apertura');

  if (enunciado && apertura?.huellaEnunciado) {
    const recalculada = computeContentHash(enunciado);
    if (recalculada === apertura.huellaEnunciado) {
      console.log('✓ El enunciado es el que se sometió a votación (no se editó después).');
    } else {
      console.log('✗ El enunciado ha cambiado desde que se convocó la votación.');
      console.log(`   se votó: ${apertura.huellaEnunciado}`);
      console.log(`   ahora:   ${recalculada}`);
      problemas++;
    }
  } else if (registro.length > 0) {
    console.log('  (este archivo no incluye el enunciado sellado: no se puede comprobar)');
  }

  // ------------------------------------------------------- 3. La huella final
  const huellaFinal = registro.length > 0 ? registro[registro.length - 1].huella : null;

  if (propuesta.huellaFinal && huellaFinal !== propuesta.huellaFinal) {
    console.log('✗ La huella final publicada no es la de la última entrada del registro.');
    problemas++;
  } else if (propuesta.huellaFinal) {
    console.log(`✓ La huella final coincide con la última entrada: ${huellaFinal}`);
  }

  if (huellaEsperada) {
    if (huellaEsperada.trim().toLowerCase() === String(huellaFinal).toLowerCase()) {
      console.log('✓ La huella coincide con la que guardaste: el registro no ha cambiado.');
    } else {
      console.log('✗ La huella NO coincide con la que guardaste: el registro ha cambiado.');
      console.log(`   guardada: ${huellaEsperada.trim()}`);
      console.log(`   actual:   ${huellaFinal}`);
      problemas++;
    }
  }

  // ----------------------------------------------------------- 4. El recuento
  const anuladas = new Set();
  for (const linea of registro) {
    if (linea.tipo === 'anulacion' && linea.anula) anuladas.add(linea.anula);
  }

  let si = 0;
  let no = 0;
  let revotos = 0;
  for (const linea of registro) {
    if (linea.tipo !== 'voto') continue;
    if (anuladas.has(linea.id)) continue;
    if (linea.esRevoto === true) revotos++;
    if (linea.opcion === 'si') si++;
    else if (linea.opcion === 'no') no++;
  }

  const vigentes = si + no;
  const anulacionesSinRevoto = anuladas.size - revotos;

  console.log('');
  console.log(`   Recuento recalculado: ${si} a favor, ${no} en contra (${vigentes} votos vigentes)`);
  console.log(`   Anulaciones: ${anuladas.size}, de las cuales ${anulacionesSinRevoto} sin volver a votar`);

  if (recuento) {
    if (recuento.si !== si || recuento.no !== no) {
      console.log(`✗ El recuento publicado (${recuento.si}-${recuento.no}) no coincide con el del registro (${si}-${no}).`);
      problemas++;
    } else {
      console.log('✓ El recuento publicado coincide con el del registro.');
    }
  }

  // --------------------------------------------------- 5. El resultado
  // El cierre sella el resultado (en su campo "opcion"). Debe coincidir con el
  // estado publicado y seguirse de los votos. Umbrales: los de
  // server/src/services/PlazaService.ts.
  const cierre = registro.find((l) => l.tipo === 'cierre');
  if (cierre) {
    const PLAZO_DIAS = 14;
    const VIA_RAPIDA_MIN_POSITIVOS = 15;
    const VIA_RAPIDA_MAX_NEGATIVOS = 1;
    const VIA_RAPIDA_MIN_DIAS = 3;
    const dias = (Date.parse(cierre.fecha) - Date.parse(registro[0].fecha)) / 86400000;

    let esperado;
    if (cierre.motivoCierre === 'via_rapida') {
      const cumple = si >= VIA_RAPIDA_MIN_POSITIVOS && no <= VIA_RAPIDA_MAX_NEGATIVOS && dias >= VIA_RAPIDA_MIN_DIAS;
      esperado = cumple ? 'aprobada' : null;
    } else if (cierre.motivoCierre === 'plazo') {
      esperado = dias >= PLAZO_DIAS ? (si > no ? 'aprobada' : 'rechazada') : null;
    }

    if (cierre.opcion !== propuesta.estado) {
      console.log(`✗ El estado publicado (${propuesta.estado}) no es el resultado sellado en el cierre (${cierre.opcion ?? 'ninguno'}).`);
      problemas++;
    } else if (esperado !== cierre.opcion) {
      console.log(`✗ El resultado sellado (${cierre.opcion}) no se sigue de los votos ni de las reglas de cierre (${cierre.motivoCierre}).`);
      problemas++;
    } else {
      console.log(`✓ El resultado (${cierre.opcion}) es el que dan los votos.`);
    }
  }

  // ------------------------------------------- 6. Votos frente a votantes
  if (Array.isArray(votantes)) {
    const esperados = votantes.length - anulacionesSinRevoto;
    console.log(`   Votantes en la lista: ${votantes.length}`);

    if (vigentes !== esperados) {
      console.log(`✗ Las cifras no cuadran: ${vigentes} votos vigentes frente a ${esperados} esperados`);
      console.log(`   (${votantes.length} votantes menos ${anulacionesSinRevoto} anulaciones sin revoto).`);
      problemas++;
    } else {
      console.log('✓ Los votos cuadran con la lista de votantes.');
    }
  }

  console.log('');
  if (problemas === 0) {
    console.log('RESULTADO: el registro es íntegro y las cuentas salen.');
    process.exit(0);
  } else {
    console.log(`RESULTADO: se han encontrado ${problemas} problema(s). Avisa en La Plaza.`);
    process.exit(1);
  }
}

main();
