import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, `API route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Uploaded image exceeds the 3 MB maximum size.'
          : err.message,
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      success: false,
      message: messages[0] || 'Validation failed',
      details: messages,
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: `Invalid identifier for field "${err.path}".`,
    });
    return;
  }

  const mongoErr = err as { code?: number; keyValue?: Record<string, unknown>; message?: string };
  if (mongoErr && mongoErr.code === 11000) {
    const field = Object.keys(mongoErr.keyValue || {})[0] || 'record';
    res.status(409).json({
      success: false,
      message: `A record with that ${field} already exists.`,
    });
    return;
  }

  console.error('[StockFlow Error]', err);
  res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === 'production'
        ? 'An unexpected server error occurred.'
        : (err as Error)?.message || 'Internal server error',
  });
}
