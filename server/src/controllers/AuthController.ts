import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { AuthRequest } from '../middlewares/auth';

export class AuthController {
  constructor(private userService: UserService) {}

  register = async (req: Request, res: Response) => {
    try {
      const { password, ...userData } = req.body;
      const result = await this.userService.registerUser(userData, password);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { username, password, remember } = req.body;
      const result = await this.userService.loginUser(username, password, remember === true);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  };

  getProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const profile = await this.userService.getProfile(req.user.id);
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  };

  updateProfile = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const profileData = req.body;
      const updatedProfile = await this.userService.updateProfile(req.user.id, profileData);
      res.status(200).json(updatedProfile);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  confirm = async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      const result = await this.userService.confirmUser(token);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  forgotPassword = async (req: Request, res: Response) => {
    try {
      const result = await this.userService.requestPasswordReset(req.body?.email);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body ?? {};
      const result = await this.userService.resetPassword(token, password);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  createRoleRequest = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const { requestedRole } = req.body;
      const result = await this.userService.createRoleRequest(req.user.id, requestedRole);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  listPendingRoleRequests = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const result = await this.userService.listPendingRoleRequests(req.user.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  listMyRoleRequests = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const result = await this.userService.listAllRoleRequestsForUser(req.user.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  resolveRoleRequest = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const { requestId } = req.params;
      const { approve } = req.body;
      const result = await this.userService.resolveRoleRequest(requestId as string, approve, req.user.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  listUsers = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const result = await this.userService.listUsers(req.user.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  updateUserRoles = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
      }
      const { userId } = req.params;
      const { roles } = req.body;
      const result = await this.userService.updateUserRoles(userId as string, roles, req.user.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
