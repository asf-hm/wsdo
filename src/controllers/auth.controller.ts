import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  res.status(200).json(result);
}
