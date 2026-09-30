import { Request, Response } from 'express';
import { PlazaService } from '../services/PlazaService';
import { AuthRequest } from '../middlewares/auth';

/**
 * Express 5 tipa req.params como string | string[]. Todas las rutas de La Plaza
 * usan un único :id, así que se normaliza en un sitio en lugar de repetir la
 * conversión en cada manejador.
 */
function proposalId(req: Request | AuthRequest): string {
  const raw = (req.params as Record<string, string | string[]>).id;
  return Array.isArray(raw) ? raw[0] : raw;
}

export class PlazaController {
  constructor(private plazaService: PlazaService) {}

  // ---------------------------------------------------------------- Propuestas

  /** Cualquier persona registrada puede convocar una votación. */
  createProposal = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }

      const {
        title,
        description,
        kind,
        mode,
        targetAction,
        targetRuleId,
        proposedBody,
        proposedBullets,
        proposedSectionId
      } = req.body ?? {};

      const proposal = await this.plazaService.createProposal({
        authorId: userId,
        title,
        description,
        kind: kind ?? 'acuerdo',
        mode: mode ?? 'normal',
        // Solo se pasa si la propuesta pretende cambiar el Códice: un acuerdo
        // puntual (una compra, una fecha) no toca las normas.
        target: targetAction
          ? { targetAction, targetRuleId, proposedBody, proposedBullets, proposedSectionId }
          : undefined
      });

      res.status(201).json(proposal);
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo crear la propuesta.' });
    }
  };

  listProposals = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      res.json(await this.plazaService.listProposals(status));
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudieron listar las propuestas.' });
    }
  };

  getProposal = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const id = proposalId(req);
      const detail = await this.plazaService.getProposalDetail(id, req.user?.id);
      if (!detail) {
        res.status(404).json({ error: 'La propuesta no existe.' });
        return;
      }
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? 'No se pudo obtener la propuesta.' });
    }
  };

  // --------------------------------------------------------------------- Voto

  castVote = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }

      const id = proposalId(req);
      const { choice, seal } = req.body ?? {};
      // El sello lo genera el navegador y viaja una sola vez: el servidor
      // deriva y guarda las huellas de sus dos tokens, y lo descarta.
      const result = await this.plazaService.castVote(id, userId, choice, seal);

      // El sello no se devuelve: lo generó el cliente y ya lo tiene. El
      // servidor solo conserva las huellas de sus dos tokens.
      res.status(201).json({ votacionCerrada: result.closed });
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo registrar el voto.' });
    }
  };

  /**
   * Comprueba un sello. En modo secreto, esta operación anula el voto, así que
   * el cliente debe haber pedido confirmación explícita antes de llamar.
   */
  checkReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
      const { urnaToken } = req.body ?? {};
      if (typeof urnaToken !== 'string' || !urnaToken.trim()) {
        res.status(400).json({ error: 'Escribe las palabras de tu sello.' });
        return;
      }

      const id = proposalId(req);
      // Llega el token de urna, no el sello: el servidor nunca ve el sello
      // entero. No hace falta identificarse —el token es la credencial— y
      // tampoco serviría de nada: esta llamada solo toca la urna.
      const lookup = await this.plazaService.checkReceipt(id, urnaToken);

      if (!lookup.found) {
        res.status(404).json({
          encontrado: false,
          mensaje: 'Este sello no consta en el registro. Comprueba las palabras, y si son correctas avisa en La Plaza.'
        });
        return;
      }

      res.json({
        encontrado: true,
        voto: lookup.choice,
        sellado: lookup.sealedAt,
        anulado: lookup.annulled,
        puedeVolverAVotar: lookup.canRevote
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo comprobar el sello.' });
    }
  };

  /**
   * Segunda fase de la anulación: devuelve el turno de voto.
   *
   * Deliberadamente separada de checkReceipt y con otro token, para que el
   * servidor no pueda relacionar el voto destruido con la persona rehabilitada.
   */
  releaseTurn = async (req: Request, res: Response): Promise<void> => {
    try {
      const { censoToken } = req.body ?? {};
      if (typeof censoToken !== 'string' || !censoToken.trim()) {
        res.status(400).json({ error: 'Falta el token de censo.' });
        return;
      }

      const released = await this.plazaService.releaseTurn(proposalId(req), censoToken);
      res.json({ rehabilitado: released });
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo recuperar el turno de voto.' });
    }
  };

  // ------------------------------------------------------- Registro y auditoría

  /** Archivo público de una votación cerrada. Descargable como JSON. */
  getPublicRecord = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = proposalId(req);
      const record = await this.plazaService.getPublicRecord(id);

      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', `attachment; filename="votacion-${id}.json"`);
      }
      res.json(record);
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo obtener el registro.' });
    }
  };

  /** Verificación de integridad. Cualquiera puede pedirla, sin autenticarse. */
  verifyProposal = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = proposalId(req);
      const result = await this.plazaService.verifyProposal(id);
      res.status(result.ok ? 200 : 409).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo verificar la votación.' });
    }
  };

  // --------------------------------------------------------------- Comentarios

  addComment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }

      const id = proposalId(req);
      const { body } = req.body ?? {};
      const comment = await this.plazaService.addComment(id, userId, body);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(400).json({ error: error.message ?? 'No se pudo publicar el comentario.' });
    }
  };
}
