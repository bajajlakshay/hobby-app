import { request } from '@/services/api/client';

import type { AuthResponse, User, VerificationRequired } from './types';

interface Credentials {
  email: string;
  password: string;
}

/** Typed wrappers over the backend's /api/auth endpoints. */
export const authApi = {
  // Register no longer returns tokens — the account must verify its email first.
  register: (credentials: Credentials) =>
    request<VerificationRequired>('/api/auth/register', { method: 'POST', body: credentials }),

  verifyEmail: (email: string, code: string) =>
    request<AuthResponse>('/api/auth/verify-email', { method: 'POST', body: { email, code } }),

  resendOtp: (email: string) =>
    request<VerificationRequired>('/api/auth/resend-otp', { method: 'POST', body: { email } }),

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
