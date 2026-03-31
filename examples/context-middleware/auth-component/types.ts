export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  createdAt: string;
}

export interface AuthContext {
  token?: string;
  user?: User;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
  requireAuth: () => void;
  requireRole: (role: string) => void;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthPayload {
  token: string;
  user: User;
} 