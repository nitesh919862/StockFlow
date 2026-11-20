import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `product-${uniqueSuffix}${safeExt}`);
  },
});

export const uploadProductImage = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 MB
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ApiError(400, 'Only JPEG, PNG, WEBP, and GIF image files are allowed.'));
      return;
    }
    cb(null, true);
  },
});
