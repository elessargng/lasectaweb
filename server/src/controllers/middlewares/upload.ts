import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Garantizar que exista la carpeta de almacenamiento para La Biblioteca
const getLibraryUploadPath = (): string => {
  const libraryDirSetting = process.env.LIBRARY_STORAGE_PATH || './uploads/library';
  const fullPath = path.isAbsolute(libraryDirSetting)
    ? libraryDirSetting
    : path.resolve(process.cwd(), libraryDirSetting);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
};

const storage = multer.diskStorage({
  destination: (req: Request, file: any, cb: (error: Error | null, destination: string) => void) => {
    cb(null, getLibraryUploadPath());
  },
  filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

export const libraryUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // Límite de 50MB por archivo
});
