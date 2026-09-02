import { Request, Response } from 'express';
import { LibraryService } from '../services/LibraryService';
import { AuthRequest } from '../middlewares/auth';
import { parseAllowedRoles } from '../utils/libraryAccess';

export class LibraryController {
  constructor(private libraryService: LibraryService) {}

  public getTree = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const tree = await this.libraryService.getTree(req.user?.id);
      res.status(200).json(tree);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al obtener La Biblioteca.' });
    }
  };

  public createSection = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { name, parentId, position, icon, accessLevel, allowedRoles } = req.body;
      const section = await this.libraryService.createSection(req.user.id, {
        name,
        parentId,
        position: position ? Number(position) : undefined,
        icon,
        accessLevel,
        allowedRoles: parseAllowedRoles(allowedRoles)
      });
      res.status(201).json(section);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public updateSection = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      const { name, parentId, position, icon, accessLevel, allowedRoles } = req.body;
      const updated = await this.libraryService.updateSection(req.user.id, id as string, {
        name,
        parentId,
        position: position !== undefined ? Number(position) : undefined,
        icon,
        accessLevel,
        allowedRoles: parseAllowedRoles(allowedRoles)
      });
      res.status(200).json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public deleteSection = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      await this.libraryService.deleteSection(req.user.id, id as string);
      res.status(200).json({ message: 'Sección eliminada correctamente.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public createDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { sectionId, title, description, position, label, accessLevel, allowedRoles } = req.body;
      const file = req.file;

      const parsedAllowedRoles = parseAllowedRoles(allowedRoles);

      const doc = await this.libraryService.createDocument(
        req.user.id,
        {
          sectionId,
          title,
          description,
          position: position ? Number(position) : undefined,
          label,
          accessLevel,
          allowedRoles: parsedAllowedRoles
        },
        file
      );
      res.status(201).json(doc);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      const { sectionId, title, description, position, accessLevel, allowedRoles } = req.body;

      const parsedAllowedRoles = parseAllowedRoles(allowedRoles);

      const doc = await this.libraryService.updateDocument(req.user.id, id as string, {
        sectionId,
        title,
        description,
        position: position !== undefined ? Number(position) : undefined,
        accessLevel,
        allowedRoles: parsedAllowedRoles
      });
      res.status(200).json(doc);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      await this.libraryService.deleteDocument(req.user.id, id as string);
      res.status(200).json({ message: 'Documento eliminado correctamente.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  // --- ENLACES ---
  public createLink = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { sectionId, title, url, description, position, accessLevel, allowedRoles } = req.body;

      const parsedAllowedRoles = parseAllowedRoles(allowedRoles);

      const link = await this.libraryService.createLink(req.user.id, {
        sectionId,
        title,
        url,
        description,
        position: position ? Number(position) : undefined,
        accessLevel,
        allowedRoles: parsedAllowedRoles
      });
      res.status(201).json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public updateLink = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      const { sectionId, title, url, description, position, accessLevel, allowedRoles } = req.body;

      const parsedAllowedRoles = parseAllowedRoles(allowedRoles);

      const link = await this.libraryService.updateLink(req.user.id, id as string, {
        sectionId,
        title,
        url,
        description,
        position: position !== undefined ? Number(position) : undefined,
        accessLevel,
        allowedRoles: parsedAllowedRoles
      });
      res.status(200).json(link);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public deleteLink = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      await this.libraryService.deleteLink(req.user.id, id as string);
      res.status(200).json({ message: 'Enlace eliminado correctamente.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  // --- PARTIDAS POV ---
  public getPovMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const match = await this.libraryService.getPovMatchById(id as string, req.user?.id);
      res.status(200).json(match);
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Error al obtener la partida POV.' });
    }
  };

  public createPovMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { sectionId, title, description, position, accessLevel, allowedRoles, povs } = req.body;
      const parsedAllowedRoles = parseAllowedRoles(allowedRoles);

      const match = await this.libraryService.createPovMatch(req.user.id, {
        sectionId,
        title,
        description,
        position: position !== undefined ? Number(position) : undefined,
        accessLevel,
        allowedRoles: parsedAllowedRoles,
        povs: Array.isArray(povs) ? povs : []
      });
      res.status(201).json(match);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public updatePovMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      const { sectionId, title, description, position, accessLevel, allowedRoles, povs } = req.body;
      const parsedAllowedRoles = parseAllowedRoles(allowedRoles);

      const match = await this.libraryService.updatePovMatch(req.user.id, id as string, {
        sectionId,
        title,
        description,
        position: position !== undefined ? Number(position) : undefined,
        accessLevel,
        allowedRoles: parsedAllowedRoles,
        povs: povs !== undefined && Array.isArray(povs) ? povs : undefined
      });
      res.status(200).json(match);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public deletePovMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params;
      await this.libraryService.deletePovMatch(req.user.id, id as string);
      res.status(200).json({ message: 'Partida POV eliminada correctamente.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public addVersion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params; // documentId
      const { label } = req.body;
      const file = req.file;

      const version = await this.libraryService.addVersion(req.user.id, id as string, label, file);
      res.status(201).json(version);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public deleteVersion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado.' });
        return;
      }
      const { id } = req.params; // versionId
      await this.libraryService.deleteVersion(req.user.id, id as string);
      res.status(200).json({ message: 'Versión eliminada correctamente.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public downloadVersion = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params; // versionId
      const info = await this.libraryService.getVersionDownloadInfo(id as string, req.user?.id);
      
      if (req.query.inline === 'true') {
        res.setHeader('Content-Type', info.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(info.originalFilename)}"`);
        res.sendFile(info.absolutePath);
        return;
      }

      res.setHeader('Content-Type', info.mimeType);
      res.download(info.absolutePath, info.originalFilename);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  };
}
