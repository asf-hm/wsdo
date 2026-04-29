import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserModel } from '../models';
import type { Types } from 'mongoose';
import type { User } from '../models/user.model';
import type { AuthUser } from '../types/auth';
import { AppError } from '../utils/AppError';

type UserWithPassword = User & { _id: Types.ObjectId; password: string };

interface LoginInput {
  username: string;
  password: string;
}

interface LoginResult {
  token: string;
  user: AuthUser;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await UserModel.findOne({ username: input.username })
    .select('+password')
    .lean() as UserWithPassword | null;

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
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256'
  });

  return { token, user: authUser };
}
