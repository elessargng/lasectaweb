import { Request, Response } from 'express';
import { GuionService } from '../services/guiones/GuionService';

/** Rutas HTTP del catálogo de personajes y de los guiones. Solo traduce HTTP ↔ servicio. */
export class GuionController {
  constructor(private guionService: GuionService) {}

  /** GET /api/personajes: el catálogo (copia local sincronizada). */
  personajes = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.guionService.catalogo());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  /** GET /api/guiones/predeterminados: los guiones que se pueden elegir sin cargar un archivo. */
  predeterminados = (_req: Request, res: Response): void => {
    res.status(200).json(this.guionService.predeterminados());
  };
}
