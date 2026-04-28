import { Router } from 'express';
import { getFeedController } from '../controllers/feed.controller';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const feedRouter = Router();

feedRouter.get('/feed', requireAuth, asyncHandler(getFeedController));
