import { CodiceRepository } from '../repositories/CodiceRepository';
import seed from './codiceSeed.json';

/**
 * Carga el Códice vigente en base de datos la primera vez que arranca.
 *
 * El contenido procede del Códice que hasta ahora estaba escrito directamente
 * en la página (HTML estático). Estas normas son anteriores a La Plaza y por
 * tanto no se votaron: su primera versión se marca como 'fundacional' y no
 * lleva votación asociada.
 *
 * La votación solo es obligatoria para las normas nuevas y para modificar las
 * existentes; lo que ya estaba en vigor sigue en vigor.
 *
 * Es idempotente: si ya hay normas cargadas, no hace nada.
 */
export async function seedCodice(codiceRepository: CodiceRepository): Promise<void> {
  const existing = await codiceRepository.countRules();
  if (existing > 0) {
    return;
  }

  console.log('[CODICE SEED] Cargando el Códice vigente en base de datos...');

  let sectionsCreated = 0;
  let rulesCreated = 0;

  for (const section of seed) {
    let stored = await codiceRepository.findSectionByNumber(section.number);
    if (!stored) {
      stored = await codiceRepository.createSection({
        number: section.number,
        title: section.title,
        icon: section.icon ?? undefined,
        position: section.position
      });
      sectionsCreated++;
    }

    for (const article of section.articles) {
      const already = await codiceRepository.findRuleByReference(article.reference);
      if (already) continue;

      await codiceRepository.createRule({
        sectionId: stored.id,
        reference: article.reference,
        // Todo el Códice heredado son normas permanentes, es decir edictos.
        // Los acuerdos puntuales nacen ya en La Plaza.
        kind: 'edicto',
        position: article.position,
        body: article.body,
        bullets: article.bullets ?? [],
        origin: 'fundacional',
        changeNote: 'Norma vigente desde antes de La Plaza.'
      });
      rulesCreated++;
    }
  }

  console.log(
    `[CODICE SEED] Códice cargado: ${sectionsCreated} secciones y ${rulesCreated} normas fundacionales.`
  );
}
