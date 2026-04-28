import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { UserModel } from '../models';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/AppError';

interface LoginInput {
  username: string;
  password: string;
}

interface LoginResult {
  token: string;
  user: AuthUser;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await UserModel.findOne({ username: input.username }).select('+password');

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);

  if (!passwordMatches) {
    throw new AppError('Invalid credentials', 401);
  }

  const authUser: AuthUser = {
    id: user._id.toString(),
    username: user.username,
    country: user.country,
    libraries: user.libraries.map((libraryId) => libraryId.toString()),
    role: user.role ?? 'user'
  };

  const token = jwt.sign(authUser, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  } as SignOptions);

  return { token, user: authUser };
}
