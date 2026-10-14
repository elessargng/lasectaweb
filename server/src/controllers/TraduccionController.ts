import { Request, Response } from 'express';
import { TraduccionService } from '../services/traducciones/TraduccionService';
import { GENEROS, GENERO_POR_DEFECTO } from '../types/guiones';

/** Rutas HTTP de los idiomas de los personajes. Solo traduce HTTP ↔ servicio. */
export class TraduccionController {
  constructor(private traduccionService: TraduccionService) {}

  /** GET /api/idiomas: los idiomas en los que se pueden ver los personajes. */
  idiomas = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await this.traduccionService.disponibles());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  /**
   * GET /api/idiomas/:id/traducciones?genero=masculino|femenino: las
   * traducciones de los personajes a ese idioma (el género, en los que lo distinguen).
   */
  traducciones = async (req: Request, res: Response): Promise<void> => {
    try {
      const genero = GENEROS.find((g) => g === req.query.genero) ?? GENERO_POR_DEFECTO;
      const resultado = await this.traduccionService.deIdioma(String(req.params.id), genero);
      if (!resultado) {
        res.status(404).json({ error: 'Idioma no encontrado' });
        return;
      }
      // Cambian como mucho una vez por semana
      res.set('Cache-Control', 'public, max-age=3600');
      res.status(200).json(resultado);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
