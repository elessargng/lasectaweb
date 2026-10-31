import fs from 'fs';
import path from 'path';

/**
 * Utility to process user profile picture strings.
 * If the string is a Base64 encoded image (data:image/...;base64,...), it decodes and saves it
 * to disk in a date-structured hierarchy: <UPLOAD_DIR>/avatars/YYYY/MM/DD/HH/
 * Returns the public relative URL (e.g. /uploads/avatars/2026/07/20/10/avatar_123_456.png).
 */
export function processProfilePicture(profilePicture: string, userId: string): string {
  if (!profilePicture || !profilePicture.startsWith('data:image/')) {
    return profilePicture;
  }

  try {
    const matches = profilePicture.match(/^data:image\/([a-zA-Z0-9+\-+.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return profilePicture;
    }

    let extension = matches[1].toLowerCase();
    if (extension === 'jpeg') extension = 'jpg';
    if (extension === 'svg+xml') extension = 'svg';

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');

    // Get upload base directory from process.env.UPLOAD_DIR or default to process.cwd()/uploads
    const envUploadDir = process.env.UPLOAD_DIR || './uploads';
    const uploadBaseDir = path.isAbsolute(envUploadDir)
      ? envUploadDir
      : path.resolve(process.cwd(), envUploadDir);

    const relativeSubDir = path.join('avatars', year, month, day, hour);
    const targetDir = path.join(uploadBaseDir, relativeSubDir);

    // Ensure directory exists (recursive)
    fs.mkdirSync(targetDir, { recursive: true });

    const fileName = `avatar_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const filePath = path.join(targetDir, fileName);

    fs.writeFileSync(filePath, buffer);

    // Normalize slashes for public URL route
    const publicUrlPath = `/uploads/${relativeSubDir.replace(/\\/g, '/')}/${fileName}`;
    return publicUrlPath;
  } catch (error) {
    console.error('Error saving profile picture to filesystem:', error);
    return profilePicture;
  }
}
