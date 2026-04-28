export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  country: string;
  libraries: string[];
  role: UserRole;
}
