import { Request, Response } from 'express';
import { RegistroSincronizacionesService } from '../services/sincronizacion/RegistroSincronizacionesService';

/** Rutas HTTP del estado de las sincronizaciones con fuentes externas. Solo traduce HTTP ↔ servicio. */
export class SincronizacionController {
  constructor(private registro: RegistroSincronizacionesService) {}

  /** GET /api/admin/sincronizaciones (solo administración): cómo fue la última de cada una. */
  estado = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.registro.estado());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
