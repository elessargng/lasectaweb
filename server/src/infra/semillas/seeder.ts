import bcrypt from 'bcrypt';
import { UserRepository } from '../../repositories/UserRepository';
import { User } from '../../models/User';

export async function seedAdminUser(userRepository: UserRepository): Promise<void> {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lasecta.com';
  const adminRealName = process.env.ADMIN_REAL_NAME || 'Gran Inquisidor';

  if (!adminUsername || !adminPassword) {
    console.log('Seed: ADMIN_USERNAME or ADMIN_PASSWORD not set in env. Skipping admin seeding.');
    return;
  }

  try {
    const existingUser = await userRepository.findByUsername(adminUsername);
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    if (existingUser) {
      // Update existing admin details to match .env configurations
      existingUser.passwordHash = passwordHash;
      existingUser.email = adminEmail;
      existingUser.realName = adminRealName;
      existingUser.isConfirmed = true;
      existingUser.roles = ['admin'];
      
      await userRepository.update(existingUser);
      console.log(`Seed: Admin user "${adminUsername}" credentials updated from .env.`);
      return;
    }

    const adminUser: User = {
      id: 'admin-' + Date.now(),
      username: adminUsername,
      realName: adminRealName,
      botcUsername: '',
      email: adminEmail,
      telegramUsername: '',
      passwordHash,
      profilePicture: '/avatar.png',
      isConfirmed: true,
      roles: ['admin'],
      createdAt: new Date(),
    };

    await userRepository.save(adminUser);
    console.log(`Seed: Admin user "${adminUsername}" created successfully.`);
  } catch (error) {
    console.error('Seed: Error seeding admin user:', error);
  }
}
