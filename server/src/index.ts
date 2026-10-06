import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Intentar cargar el archivo .env desde múltiples rutas para garantizar compatibilidad (dev, prod, PM2, dist, etc.)
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

let loaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`[ENV] Cargado archivo de entorno desde: ${envPath}`);
    loaded = true;
    break;
  }
}

if (!loaded) {
  dotenv.config();
  console.log('[ENV] Cargando entorno con configuración por defecto.');
}

import express from 'express';
import cors from 'cors';
import { UserRepository } from './repositories/UserRepository';
import { RoleRequestRepository } from './repositories/RoleRequestRepository';
import { UserService } from './services/UserService';
import { AuthController } from './controllers/AuthController';
import { ThreadRepository } from './repositories/ThreadRepository';
import { ThreadService } from './services/ThreadService';
import { ThreadController } from './controllers/ThreadController';
import { authenticateJWT, optionalAuthenticateJWT } from './middlewares/auth';
import { DatabaseRepository } from './repositories/DatabaseRepository';
import { seedAdminUser } from './utils/seeder';
import { VillacuervosRepository } from './repositories/VillacuervosRepository';
import { VillacuervosService } from './services/VillacuervosService';
import { VillacuervosController } from './controllers/VillacuervosController';
import { TwitterRepository } from './repositories/TwitterRepository';
import { InstagramRepository } from './repositories/InstagramRepository';
import { SocialMediaService } from './services/SocialMediaService';
import { VigilanteService } from './services/VigilanteService';
import { LibraryRepository } from './repositories/LibraryRepository';
import { LibraryService } from './services/LibraryService';
import { LibraryController } from './controllers/LibraryController';
import { libraryUpload } from './middlewares/upload';
import { User } from './models/User';
import { PlazaRepository } from './repositories/PlazaRepository';
import { PlazaService } from './services/PlazaService';
import { PlazaController } from './controllers/PlazaController';
import { PlazaVigilanteService } from './services/PlazaVigilanteService';
import { CodiceRepository } from './repositories/CodiceRepository';
import { CodiceService } from './services/CodiceService';
import { CodiceController } from './controllers/CodiceController';
import { seedCodice } from './utils/codiceSeeder';
import { RitualRepository } from './repositories/RitualRepository';
import { RitualSignupRepository } from './repositories/RitualSignupRepository';
import { RitualService } from './services/RitualService';
import { RitualController } from './controllers/RitualController';
import { sendPlazaIntegrityAlert, sendPlazaResultAnnouncement } from './utils/mailer';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve profile picture uploads statically
const uploadDirSetting = process.env.UPLOAD_DIR || './uploads';
const uploadPath = path.isAbsolute(uploadDirSetting)
  ? uploadDirSetting
  : path.resolve(process.cwd(), uploadDirSetting);
app.use('/uploads', express.static(uploadPath));

// Initialize dependencies
const userRepository = new UserRepository();
const roleRequestRepository = new RoleRequestRepository();
const userService = new UserService(userRepository, roleRequestRepository);
const authController = new AuthController(userService);

const threadRepository = new ThreadRepository();
const threadService = new ThreadService(threadRepository);
const threadController = new ThreadController(threadService);

const villacuervosRepository = new VillacuervosRepository();
const villacuervosService = new VillacuervosService(villacuervosRepository, userRepository);
const villacuervosController = new VillacuervosController(villacuervosService);

const ritualRepository = new RitualRepository();
const ritualSignupRepository = new RitualSignupRepository();
const ritualService = new RitualService(ritualRepository, userRepository, villacuervosService, ritualSignupRepository);
const ritualController = new RitualController(ritualService);

const twitterRepository = new TwitterRepository();
const instagramRepository = new InstagramRepository();
const socialMediaService = new SocialMediaService(twitterRepository, instagramRepository);
const vigilanteService = new VigilanteService(villacuervosService, socialMediaService);

const libraryRepository = new LibraryRepository();
const libraryService = new LibraryService(libraryRepository, userRepository);
const libraryController = new LibraryController(libraryService);

const plazaRepository = new PlazaRepository();
const plazaService = new PlazaService(plazaRepository);
const plazaController = new PlazaController(plazaService);

const codiceRepository = new CodiceRepository();
const codiceService = new CodiceService(codiceRepository, plazaRepository);
const codiceController = new CodiceController(codiceService);

// Dependencia mutua: La Plaza aplica al Códice lo que se aprueba, y el Códice
// consulta las votaciones para mostrar de dónde viene cada versión.
plazaService.setCodiceService(codiceService);
// Y el Códice no aplica ni da por buena ninguna votación sin verificarla antes.
codiceService.setProposalVerifier((proposalId) => plazaService.verifyProposal(proposalId));

// El resultado de cada votación se anuncia a toda la comunidad: cada buzón
// guarda una copia de la huella final que el servidor no puede tocar.
const reachableUsers = async () =>
  (await userRepository.listAll()).filter((u: User) => u.isConfirmed && !!u.email);

/** Recibe los avisos del vigilante: siempre quien administra, y quien los active. */
const receivesVigilanteAlerts = (u: User) => !!u.vigilanteAlerts || u.roles.includes('admin');

plazaService.setResultNotifier(async (result) =>
  sendPlazaResultAnnouncement(
    (await reachableUsers()).map((u) => ({ email: u.email, receivesAlerts: receivesVigilanteAlerts(u) })),
    result
  )
);

// El aviso de integridad llega siempre a quienes administran, y además a toda
// persona que lo active en su perfil: un aviso que solo llega a una persona se
// puede silenciar sin que se note. La incidencia, además, queda a la vista en
// la verificación pública de cada votación y del Códice.
const plazaVigilanteService = new PlazaVigilanteService(plazaService, () => codiceService.applyPendingProposals(), () => codiceService.verifyCodice(), async (problems) => {
  const recipients = (await reachableUsers()).filter(receivesVigilanteAlerts).map((u) => u.email);

  const incidents = await Promise.all(
    problems.map(async (p) => {
      const proposal = await plazaRepository.findProposalById(p.proposalId);
      return { proposalId: p.proposalId, title: proposal?.title, problem: p.problem };
    })
  );

  await sendPlazaIntegrityAlert(recipients, incidents);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', api: 'La Secta' });
});

app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/confirm', authController.confirm);
app.get('/api/auth/profile', authenticateJWT as express.RequestHandler, authController.getProfile as express.RequestHandler);
app.put('/api/auth/profile', authenticateJWT as express.RequestHandler, authController.updateProfile as express.RequestHandler);

// Endpoints de Roles y Panel de Gestión
app.post('/api/auth/role-request', authenticateJWT as express.RequestHandler, authController.createRoleRequest as express.RequestHandler);
app.get('/api/auth/role-requests/pending', authenticateJWT as express.RequestHandler, authController.listPendingRoleRequests as express.RequestHandler);
app.get('/api/auth/role-requests/my', authenticateJWT as express.RequestHandler, authController.listMyRoleRequests as express.RequestHandler);
app.put('/api/auth/role-requests/:requestId/resolve', authenticateJWT as express.RequestHandler, authController.resolveRoleRequest as express.RequestHandler);
app.get('/api/auth/users', authenticateJWT as express.RequestHandler, authController.listUsers as express.RequestHandler);
app.put('/api/auth/users/:userId/roles', authenticateJWT as express.RequestHandler, authController.updateUserRoles as express.RequestHandler);

app.post('/api/threads', threadController.create);
app.get('/api/threads', threadController.getAll);
app.post('/api/threads/:threadId/comments', threadController.addComment);

// Rutas de Villacuervos (Lectura pública)
app.get('/api/villacuervos/roles', villacuervosController.getRoles);
app.get('/api/villacuervos/roles/:key', villacuervosController.getRoleByKey);
app.get('/api/villacuervos/jinxes', villacuervosController.getJinxes);
app.get('/api/villacuervos/translations', villacuervosController.getTranslations);
app.get('/api/villacuervos/translations/:slug', villacuervosController.getTranslationPack);

// Rutas de Villacuervos (Escritura/Partidas - Protegidas para Narradores)
app.get('/api/villacuervos/plays/pending', villacuervosController.getPendingPlays as express.RequestHandler);
app.post('/api/villacuervos/plays', authenticateJWT as express.RequestHandler, villacuervosController.createPlay as express.RequestHandler);
app.patch('/api/villacuervos/plays/:playSlug', authenticateJWT as express.RequestHandler, villacuervosController.updatePlay as express.RequestHandler);

// Rutas de Rituales (la agenda es pública; convocar es cosa de narradores)
app.get('/api/rituals', ritualController.list);
app.get('/api/rituals/storytellers', authenticateJWT as express.RequestHandler, ritualController.listStorytellers as express.RequestHandler);
app.get('/api/rituals/:id', ritualController.get);
app.post('/api/rituals', authenticateJWT as express.RequestHandler, ritualController.create as express.RequestHandler);
app.put('/api/rituals/:id', authenticateJWT as express.RequestHandler, ritualController.update as express.RequestHandler);
app.delete('/api/rituals/:id', authenticateJWT as express.RequestHandler, ritualController.delete as express.RequestHandler);
// Apuntarse y desapuntarse: cualquier persona registrada.
app.post('/api/rituals/:id/signups', authenticateJWT as express.RequestHandler, ritualController.signUp as express.RequestHandler);
app.delete('/api/rituals/:id/signups', authenticateJWT as express.RequestHandler, ritualController.leave as express.RequestHandler);

// Rutas de La Biblioteca
app.get('/api/library/tree', optionalAuthenticateJWT as express.RequestHandler, libraryController.getTree as express.RequestHandler);
app.post('/api/library/sections', authenticateJWT as express.RequestHandler, libraryController.createSection as express.RequestHandler);
app.put('/api/library/sections/:id', authenticateJWT as express.RequestHandler, libraryController.updateSection as express.RequestHandler);
app.delete('/api/library/sections/:id', authenticateJWT as express.RequestHandler, libraryController.deleteSection as express.RequestHandler);

app.post('/api/library/documents', authenticateJWT as express.RequestHandler, libraryUpload.single('file'), libraryController.createDocument as express.RequestHandler);
app.put('/api/library/documents/:id', authenticateJWT as express.RequestHandler, libraryController.updateDocument as express.RequestHandler);
app.delete('/api/library/documents/:id', authenticateJWT as express.RequestHandler, libraryController.deleteDocument as express.RequestHandler);


// Rutas del Códice (lectura pública: las normas son de todos)
app.get('/api/codice', codiceController.getCodice);
app.get('/api/codice/sections', codiceController.listSections);
app.get('/api/codice/rules/:id/history', codiceController.getRuleHistory as express.RequestHandler);
// Verificación del Códice: comprueba que el texto de las leyes en vigor es el
// que se aprobó. Pública, como la verificación de las votaciones.
app.get('/api/codice/verify', codiceController.verifyCodice);

// Rutas de La Plaza
// Lectura abierta: el registro y la verificación son públicos por diseño, y
// cualquiera debe poder comprobar una votación sin necesidad de tener cuenta.
app.get('/api/plaza/proposals', plazaController.listProposals);
app.get('/api/plaza/proposals/:id', optionalAuthenticateJWT as express.RequestHandler, plazaController.getProposal as express.RequestHandler);
app.get('/api/plaza/proposals/:id/record', plazaController.getPublicRecord as express.RequestHandler);
app.get('/api/plaza/proposals/:id/verify', plazaController.verifyProposal as express.RequestHandler);

// Escritura: cualquier persona registrada puede convocar, votar y comentar.
app.post('/api/plaza/proposals', authenticateJWT as express.RequestHandler, plazaController.createProposal as express.RequestHandler);
app.post('/api/plaza/proposals/:id/vote', authenticateJWT as express.RequestHandler, plazaController.castVote as express.RequestHandler);
app.post('/api/plaza/proposals/:id/comments', authenticateJWT as express.RequestHandler, plazaController.addComment as express.RequestHandler);

// Comprobar un sello no requiere identificarse: el sello es la credencial.
app.post('/api/plaza/proposals/:id/check-receipt', plazaController.checkReceipt as express.RequestHandler);
// Segunda fase de la anulación, contra el censo. Va sin autenticar y por
// separado a propósito: el token es la credencial, y así el servidor no puede
// relacionar quién recupera el turno con qué voto se destruyó.
app.post('/api/plaza/proposals/:id/release-turn', plazaController.releaseTurn as express.RequestHandler);

app.post('/api/library/links', authenticateJWT as express.RequestHandler, libraryController.createLink as express.RequestHandler);
app.put('/api/library/links/:id', authenticateJWT as express.RequestHandler, libraryController.updateLink as express.RequestHandler);
app.delete('/api/library/links/:id', authenticateJWT as express.RequestHandler, libraryController.deleteLink as express.RequestHandler);

app.get('/api/library/pov-matches/:id', optionalAuthenticateJWT as express.RequestHandler, libraryController.getPovMatch as express.RequestHandler);
app.post('/api/library/pov-matches', authenticateJWT as express.RequestHandler, libraryController.createPovMatch as express.RequestHandler);
app.put('/api/library/pov-matches/:id', authenticateJWT as express.RequestHandler, libraryController.updatePovMatch as express.RequestHandler);
app.delete('/api/library/pov-matches/:id', authenticateJWT as express.RequestHandler, libraryController.deletePovMatch as express.RequestHandler);

app.post('/api/library/documents/:id/versions', authenticateJWT as express.RequestHandler, libraryUpload.single('file'), libraryController.addVersion as express.RequestHandler);
app.delete('/api/library/versions/:id', authenticateJWT as express.RequestHandler, libraryController.deleteVersion as express.RequestHandler);
app.get(['/api/library/versions/:id/download', '/api/library/versions/:id/download/:filename'], optionalAuthenticateJWT as express.RequestHandler, libraryController.downloadVersion as express.RequestHandler);

// Initialize database then start server
DatabaseRepository.getInstance()
  .then(async () => {
    console.log('Database initialized successfully');
    
    // Seed admin user if configured
    await seedAdminUser(userRepository);
    
    // Arrancar el servicio de vigilancia de partidas
    vigilanteService.start();
    await seedCodice(codiceRepository);
    plazaVigilanteService.start();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database', err);
  });

