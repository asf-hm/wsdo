import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { authPayloadSchema } from '../validators/authPayload.validator';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const authorization = req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required', 401));
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const parsed = authPayloadSchema.safeParse(decoded);

    if (!parsed.success) {
      return next(new AppError('Authentication required', 401));
    }

    req.user = parsed.data;
    return next();
  } catch {
    return next(new AppError('Authentication required', 401));
  }
};
