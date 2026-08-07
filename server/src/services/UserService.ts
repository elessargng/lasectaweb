import { UserRepository } from '../repositories/UserRepository';
import { User } from '../models/User';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendConfirmationEmail } from '../utils/mailer';
import { RoleRequestRepository } from '../repositories/RoleRequestRepository';
import { RoleRequest } from '../models/RoleRequest';

export class UserService {
  constructor(
    private userRepository: UserRepository,
    private roleRequestRepository: RoleRequestRepository
  ) {}

  async registerUser(userData: Omit<User, 'id' | 'passwordHash' | 'createdAt' | 'isConfirmed' | 'confirmationToken' | 'confirmationTokenExpires' | 'roles'>, passwordPlain: string): Promise<{ message: string }> {
    const existing = await this.userRepository.findByUsername(userData.username);
    if (existing) {
      throw new Error('El usuario ya existe');
    }
    
    const passwordHash = await bcrypt.hash(passwordPlain, 10);
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const confirmationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const user: User = {
      ...userData,
      id: Date.now().toString(),
      passwordHash,
      isConfirmed: false,
      confirmationToken,
      confirmationTokenExpires,
      roles: [], // Adepto base sin roles específicos
      createdAt: new Date(),
    };
    
    await this.userRepository.save(user);
    
    try {
      await sendConfirmationEmail(user.email, user.username, confirmationToken);
    } catch (emailError) {
      console.error('Error al enviar el correo de confirmación:', emailError);
      // We don't fail the registration if email sending fails in dev, but in production we might want to.
      // For user friendliness, we will keep going, since the link is printed in console.
    }
    
    return { 
      message: 'Registro realizado con éxito. Por favor, revisa tu correo electrónico para confirmar tu cuenta.'
    };
  }

  async loginUser(username: string, passwordPlain: string): Promise<{ user: Partial<User>, token: string }> {
    const cleanUsername = (username || '').trim();
    const user = await this.userRepository.findByUsername(cleanUsername);
    if (!user) {
      console.log(`[LOGIN INTENTO FALLIDO] No existe ningún usuario registrado como: "${cleanUsername}"`);
      throw new Error('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) {
      console.log(`[LOGIN INTENTO FALLIDO] Contraseña no coincide para el usuario: "${user.username}"`);
      throw new Error('Credenciales inválidas');
    }

    if (!user.isConfirmed) {
      console.log(`[LOGIN INTENTO FALLIDO] El usuario "${user.username}" no está confirmado.`);
      throw new Error('Por favor, confirma tu correo electrónico antes de iniciar sesión.');
    }


    const JWT_SECRET = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash: _, confirmationToken: __, confirmationTokenExpires: ___, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token
    };
  }

  async confirmUser(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new Error('Token de confirmación no proporcionado.');
    }

    const user = await this.userRepository.findByConfirmationToken(token);
    if (!user) {
      throw new Error('Enlace de confirmación no válido.');
    }

    if (user.isConfirmed) {
      return { message: 'La cuenta ya ha sido confirmada anteriormente.' };
    }

    if (user.confirmationTokenExpires && user.confirmationTokenExpires < new Date()) {
      throw new Error('El enlace de confirmación ha expirado.');
    }

    user.isConfirmed = true;
    user.confirmationToken = undefined;
    user.confirmationTokenExpires = undefined;

    await this.userRepository.update(user);

    return { message: 'Cuenta confirmada con éxito. Ya puedes iniciar sesión.' };
  }

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    const { passwordHash: _, confirmationToken: __, confirmationTokenExpires: ___, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, updateData: Partial<User>): Promise<Partial<User>> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');

    const updatedUser = {
      ...user,
      ...updateData,
      id: user.id // Asegurar que el ID no cambia
    };

    const savedUser = await this.userRepository.update(updatedUser);
    const { passwordHash: _, confirmationToken: __, confirmationTokenExpires: ___, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }

  // LOGICA DE ROLES Y SOLICITUDES
  async createRoleRequest(userId: string, requestedRole: 'editor' | 'narrador'): Promise<RoleRequest> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    if (user.roles.includes(requestedRole)) {
      throw new Error(`Ya posees el rol de ${requestedRole}.`);
    }

    const userRequests = await this.roleRequestRepository.listAllForUser(userId);
    const hasPending = userRequests.some(
      (r) => r.requestedRole === requestedRole && r.status === 'pending'
    );

    if (hasPending) {
      throw new Error(`Ya tienes una solicitud pendiente para ser ${requestedRole}.`);
    }

    const req: RoleRequest = {
      id: 'req-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      userId,
      requestedRole,
      status: 'pending',
      createdAt: new Date()
    };

    return await this.roleRequestRepository.save(req);
  }

  async listPendingRoleRequests(actorUserId: string): Promise<RoleRequest[]> {
    const actor = await this.userRepository.findById(actorUserId);
    if (!actor) {
      throw new Error('Usuario no encontrado.');
    }

    if (!actor.roles.includes('admin') && !actor.roles.includes('narrador')) {
      throw new Error('No tienes permisos para ver solicitudes de rol.');
    }

    return await this.roleRequestRepository.listPending();
  }

  async listAllRoleRequestsForUser(userId: string): Promise<RoleRequest[]> {
    return await this.roleRequestRepository.listAllForUser(userId);
  }

  async resolveRoleRequest(requestId: string, approve: boolean, actorUserId: string): Promise<{ message: string }> {
    const actor = await this.userRepository.findById(actorUserId);
    if (!actor) {
      throw new Error('Actor no encontrado.');
    }

    if (!actor.roles.includes('admin') && !actor.roles.includes('narrador')) {
      throw new Error('No tienes permisos para resolver solicitudes de rol.');
    }

    const request = await this.roleRequestRepository.findById(requestId);
    if (!request) {
      throw new Error('Solicitud no encontrada.');
    }

    if (request.status !== 'pending') {
      throw new Error('Esta solicitud ya ha sido resuelta.');
    }

    if (approve) {
      request.status = 'approved';
      const targetUser = await this.userRepository.findById(request.userId);
      if (targetUser) {
        if (!targetUser.roles.includes(request.requestedRole)) {
          targetUser.roles.push(request.requestedRole);
          await this.userRepository.update(targetUser);
        }
      }
    } else {
      request.status = 'rejected';
    }

    await this.roleRequestRepository.update(request);
    return { message: `Solicitud ${approve ? 'aprobada' : 'rechazada'} correctamente.` };
  }

  async listUsers(actorUserId: string): Promise<Partial<User>[]> {
    const actor = await this.userRepository.findById(actorUserId);
    if (!actor) {
      throw new Error('Actor no encontrado.');
    }

    if (!actor.roles.includes('admin') && !actor.roles.includes('narrador') && !actor.roles.includes('editor')) {
      throw new Error('No tienes permisos para listar usuarios.');
    }

    const allUsers = await this.userRepository.listAll();
    return allUsers.map(({ passwordHash, confirmationToken, confirmationTokenExpires, ...userWithoutSec }) => userWithoutSec);
  }

  async updateUserRoles(targetUserId: string, newRoles: ('editor' | 'narrador' | 'admin')[], actorUserId: string): Promise<Partial<User>> {
    const actor = await this.userRepository.findById(actorUserId);
    if (!actor) {
      throw new Error('Actor no encontrado.');
    }

    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error('Usuario destino no encontrado.');
    }

    // Validar permisos del actor
    const isActorAdmin = actor.roles.includes('admin');
    const isActorNarrador = actor.roles.includes('narrador');

    if (!isActorAdmin && !isActorNarrador) {
      throw new Error('No tienes permisos para modificar roles.');
    }

    // Un narrador no puede asignar ni quitar el rol de administrador
    if (!isActorAdmin && isActorNarrador) {
      const hasAdminInNew = newRoles.includes('admin');
      const hasAdminInOld = targetUser.roles.includes('admin');
      if (hasAdminInNew !== hasAdminInOld) {
        throw new Error('Los Narradores no pueden asignar ni revocar el rol de Administrador.');
      }
    }

    targetUser.roles = newRoles;
    const updatedUser = await this.userRepository.update(targetUser);
    
    const { passwordHash: _, confirmationToken: __, confirmationTokenExpires: ___, ...userWithoutSec } = updatedUser;
    return userWithoutSec;
  }
}
