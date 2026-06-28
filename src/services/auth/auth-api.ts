import { request } from '@/services/api/client';

import type { AuthResponse, User } from './types';

interface Credentials {
  email: string;
  password: string;
}

/** Typed wrappers over the backend's /api/auth endpoints. */
export const authApi = {
  register: (credentials: Credentials) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: credentials }),

  login: (credentials: Credentials) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: credentials }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>('/api/auth/refresh', { method: 'POST', body: { refreshToken } }),

  logout: (refreshToken: string, accessToken: string) =>
    request<void>('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      token: accessToken,
    }),

  me: (accessToken: string) => request<User>('/api/auth/me', { token: accessToken }),
};
