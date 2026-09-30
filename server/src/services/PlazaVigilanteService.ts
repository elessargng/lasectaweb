import cron, { ScheduledTask } from 'node-cron';
import { PlazaService } from './PlazaService';
import { VerificationResult } from '../types/plaza';

/**
 * Vigilante de La Plaza.
 *
 * Recorre el registro de todas las votaciones y comprueba que la cadena encaja
 * de principio a fin y que el número de votos cuadra con el de participantes.
 * Hace exactamente lo mismo que puede hacer cualquiera con el archivo público
 * descargado: la diferencia es que no se olvida de hacerlo.
 *
 * Si algo no encaja, avisa por correo a quienes administran y a quienes hayan
 * activado los avisos en su perfil.
 */
export class PlazaVigilanteService {
  private cronTask: ScheduledTask | null = null;
  /** Votaciones ya avisadas, para no repetir el aviso en cada ciclo. */
  private reported = new Set<string>();

  constructor(
    private plazaService: PlazaService,
    /**
     * Aplica al Códice las votaciones aprobadas que aún no se hayan reflejado.
     * Se pasa como función para no acoplar el vigilante al servicio completo.
     */
    private applyPendingToCodice: () => Promise<string[]>,
    /**
     * Verifica que nadie haya editado el texto de una ley por debajo. Devuelve
     * solo las normas con problemas.
     */
    private verifyCodice: () => Promise<
      Array<{ ruleId: string; reference?: string; problem?: string }>
    >,
    /**
     * Notificador de incidencias. Se inyecta para no acoplar el vigilante a un
     * canal concreto; en el arranque se le pasa el envío por correo.
     */
    private notify: (problems: VerificationResult[]) => Promise<void>
  ) {}

  start(): void {
    if (this.cronTask) {
      console.warn('[PlazaVigilante] El servicio ya está en ejecución.');
      return;
    }

    const cronExpr = (process.env.PLAZA_VIGILANTE_CRON || '0 * * * *').trim();

    const disabledValues = ['off', 'none', 'false', 'disabled', 'never', '0'];
    if (disabledValues.includes(cronExpr.toLowerCase())) {
      console.log(`[PlazaVigilante] Servicio deshabilitado por configuración (PLAZA_VIGILANTE_CRON=${cronExpr}).`);
      return;
    }

    if (!cron.validate(cronExpr)) {
      console.error(`[PlazaVigilante] Expresión PLAZA_VIGILANTE_CRON no válida: "${cronExpr}". Servicio no iniciado.`);
      return;
    }

    console.log(`[PlazaVigilante] Servicio iniciado con expresión cron: "${cronExpr}".`);

    this.cronTask = cron.schedule(cronExpr, () => {
      this.run();
    });
  }

  stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      console.log('[PlazaVigilante] Servicio detenido.');
    }
  }

  /**
   * Un ciclo completo: cierra lo que ha vencido y verifica todo el registro.
   */
  async run(): Promise<void> {
    console.log(`[PlazaVigilante] [${new Date().toLocaleTimeString('es-ES')}] Comprobando el registro de La Plaza...`);

    try {
      // 1. Cerrar las votaciones cuyo plazo ordinario ha vencido.
      const closed = await this.plazaService.closeExpiredProposals();
      for (const id of closed) {
        console.log(`[PlazaVigilante] Votación ${id} cerrada por vencimiento del plazo.`);
      }

      // 2. Trasladar al Códice lo aprobado que aún no se haya aplicado. Un
      // cierre que fallara al aplicarse en su momento se recupera aquí. Cada
      // votación se verifica antes de aplicarla: una manipulada no se aplica.
      const applied = await this.applyPendingToCodice();
      for (const id of applied) {
        console.log(`[PlazaVigilante] Votación ${id} aplicada al Códice.`);
      }

      // 2b. Reintentar los anuncios de resultado que no llegaron a salir.
      const announced = await this.plazaService.announcePendingResults();
      for (const id of announced) {
        console.log(`[PlazaVigilante] Resultado de la votación ${id} anunciado a la comunidad.`);
      }

      // 3. Verificar el Códice: que las leyes en vigor sigan siendo las que se
      // aprobaron y nadie haya editado su texto directamente.
      const codiceProblems = await this.verifyCodice();
      for (const problem of codiceProblems) {
        console.error(
          `[PlazaVigilante] INCIDENCIA en la norma ${problem.reference ?? problem.ruleId} del Códice: ${problem.problem}`
        );
      }

      // 4. Verificar la integridad de todas las votaciones.
      const results = await this.plazaService.verifyAllProposals();
      const problems = results.filter((r) => !r.ok);

      if (problems.length === 0 && codiceProblems.length === 0) {
        console.log(
          `[PlazaVigilante] Todo íntegro (${results.length} votaciones y el Códice comprobados).`
        );
        return;
      }

      // Las incidencias del Códice se avisan como las de las votaciones, una
      // sola vez por norma afectada.
      const nuevasNormas = codiceProblems.filter((c) => !this.reported.has(c.ruleId));
      if (nuevasNormas.length > 0) {
        await this.notify(
          nuevasNormas.map((c) => ({
            ok: false,
            proposalId: c.ruleId,
            entriesChecked: 0,
            problem: `La norma ${c.reference ?? c.ruleId} del Códice no es la que se aprobó: ${c.problem ?? 'problema sin detallar'}`
          }))
        );
        for (const c of nuevasNormas) this.reported.add(c.ruleId);
      }

      if (problems.length === 0) return;

      // Solo se avisa de las votaciones nuevas con problemas, para no repetir
      // el aviso en cada ciclo mientras la incidencia siga sin resolverse.
      const nuevos = problems.filter((p) => !this.reported.has(p.proposalId));

      for (const problem of problems) {
        console.error(
          `[PlazaVigilante] INCIDENCIA en la votación ${problem.proposalId}: ${problem.problem}`
        );
      }

      if (nuevos.length > 0) {
        await this.notify(nuevos);
        for (const p of nuevos) {
          this.reported.add(p.proposalId);
        }
      }
    } catch (error) {
      console.error('[PlazaVigilante] Error durante la comprobación del registro:', error);
    }
  }
}
