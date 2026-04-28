import { Router } from 'express';
import { loginController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { loginSchema } from '../validators/auth.validator';
import { asyncHandler } from '../utils/asyncHandler';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), asyncHandler(loginController));
