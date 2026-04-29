import type { Request, Response } from 'express';
import * as feedService from '../services/feed.service';
import { AppError } from '../utils/AppError';

export async function getFeedController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const books = await feedService.getFeed(req.user);
  res.status(200).json(books);
}
