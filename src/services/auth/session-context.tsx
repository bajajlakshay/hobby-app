import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { ApiError, request, type RequestOptions } from '@/services/api/client';

import { authApi } from './auth-api';
import { deleteStorageItem, getStorageItem, setStorageItem } from './storage';
import type { AuthTokens, User } from './types';

const TOKENS_KEY = 'hobby.auth.tokens';
/** Refresh slightly before expiry to avoid races with the server clock. */
const EXPIRY_SKEW_MS = 30_000;

interface SessionContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates the account and triggers an OTP email. Does NOT sign in yet. */
  signUp: (email: string, password: string) => Promise<void>;
  /** Verifies the emailed OTP; on success the session becomes authenticated. */
  verifyEmail: (email: string, code: string) => Promise<void>;
  /** Re-sends a verification code for an unverified account. */
  resendOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Authenticated request helper: injects the bearer token and refreshes on 401. */
  authFetch: <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within a <SessionProvider />');
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mirror of the tokens for use inside stable callbacks (avoids stale closures).
  const tokensRef = useRef<AuthTokens | null>(null);

  const persistTokens = useCallback(async (tokens: AuthTokens) => {
    tokensRef.current = tokens;
    await setStorageItem(TOKENS_KEY, JSON.stringify(tokens));
  }, []);

  const clearTokens = useCallback(async () => {
    tokensRef.current = null;
    await deleteStorageItem(TOKENS_KEY);
  }, []);

  const refreshTokens = useCallback(async (): Promise<AuthTokens> => {
    const current = tokensRef.current;
    if (!current) {
      throw new ApiError(401, ['Not authenticated.']);
    }
    const refreshed = await authApi.refresh(current.refreshToken);
    await persistTokens(refreshed);
    return refreshed;
  }, [persistTokens]);

  const getValidTokens = useCallback(async (): Promise<AuthTokens> => {
    const current = tokensRef.current;
    if (!current) {
      throw new ApiError(401, ['Not authenticated.']);
    }
    const expiresAt = new Date(current.accessTokenExpiresAt).getTime();
    if (Date.now() >= expiresAt - EXPIRY_SKEW_MS) {
      return refreshTokens();
    }
    return current;
  }, [refreshTokens]);

  const authFetch = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T> => {
      const tokens = await getValidTokens();
      try {
        return await request<T>(path, { ...options, token: tokens.accessToken });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const refreshed = await refreshTokens();
          return request<T>(path, { ...options, token: refreshed.accessToken });
        }
        throw error;
      }
    },
    [getValidTokens, refreshTokens],
  );

  // Bootstrap: restore a persisted session on app start.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await getStorageItem(TOKENS_KEY);
        if (!raw) {
          return;
        }
        tokensRef.current = JSON.parse(raw) as AuthTokens;
        const tokens = await getValidTokens();
        const me = await authApi.me(tokens.accessToken);
        if (active) {
          setUser(me);
        }
      } catch {
        // Token missing/expired/invalid — start unauthenticated.
        await clearTokens();
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [getValidTokens, clearTokens]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login({ email, password });
      await persistTokens(tokens);
      setUser(await authApi.me(tokens.accessToken));
    },
    [persistTokens],
  );

  const signUp = useCallback(async (email: string, password: string) => {
    // Creates the account and emails an OTP; the caller routes to verification.
    // No tokens are issued until the email is verified.
    await authApi.register({ email, password });
  }, []);

  const verifyEmail = useCallback(
    async (email: string, code: string) => {
      const tokens = await authApi.verifyEmail(email, code);
      await persistTokens(tokens);
      setUser(await authApi.me(tokens.accessToken));
    },
    [persistTokens],
  );

  const resendOtp = useCallback(async (email: string) => {
    await authApi.resendOtp(email);
  }, []);

  const signOut = useCallback(async () => {
    const current = tokensRef.current;
    if (current) {
      try {
        await authApi.logout(current.refreshToken, current.accessToken);
      } catch {
        // Best-effort; clear the local session regardless.
      }
    }
    await clearTokens();
    setUser(null);
  }, [clearTokens]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      signIn,
      signUp,
      verifyEmail,
      resendOtp,
      signOut,
      authFetch,
    }),
    [user, isLoading, signIn, signUp, verifyEmail, resendOtp, signOut, authFetch],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
