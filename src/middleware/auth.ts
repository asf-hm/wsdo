import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { authPayloadSchema } from '../validators/authPayload.validator';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    next(new AppError('Authentication required', 401));
    return;
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const parsed = authPayloadSchema.safeParse(decoded);

    if (!parsed.success) {
      next(new AppError('Authentication required', 401));
      return;
    }

    req.user = parsed.data;
    next();
  } catch {
    next(new AppError('Authentication required', 401));
  }
};
