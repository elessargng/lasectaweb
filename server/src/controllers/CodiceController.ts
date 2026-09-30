import { Request, Response } from 'express';
import { CodiceService } from '../services/CodiceService';

function ruleId(req: Request): string {
  const raw = (req.params as Record<string, string | string[]>).id;
  return Array.isArray(raw) ? raw[0] : raw;
}

export class CodiceController {
  constructor(private codiceService: CodiceService) {}

  /** El Códice completo. Lectura pública: las normas son de todos. */
  getCodice = async (req: Request, res: Response): Promise<void> => {
    try {
      const includeRepealed = req.query.derogadas === '1';
      res.json(await this.codiceService.getCodice(includeRepealed));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudo cargar el Códice.' });
    }
  };

  listSections = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json(await this.codiceService.listSections());
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudieron cargar las secciones.' });
    }
  };

  /**
   * Verifica el Códice completo. Lectura pública: cualquiera debe poder
   * comprobar que las leyes en vigor son las que se votaron.
   */
  verifyCodice = async (_req: Request, res: Response): Promise<void> => {
    try {
      const problems = await this.codiceService.verifyCodice();
      res.status(problems.length === 0 ? 200 : 409).json({
        ok: problems.length === 0,
        normasConProblemas: problems
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudo verificar el Códice.' });
    }
  };

  /** Histórico de una norma, con la votación que aprobó cada versión. */
  getRuleHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const history = await this.codiceService.getRuleHistory(ruleId(req));
      if (!history) {
        res.status(404).json({ error: 'La norma no existe.' });
        return;
      }
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudo cargar el histórico.' });
    }
  };
}
