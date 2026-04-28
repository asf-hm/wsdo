import type { Request, Response } from 'express';
import { login } from '../services/auth.service';

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = await login(req.body);
  res.status(200).json(result);
}
