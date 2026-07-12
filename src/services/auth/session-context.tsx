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
/** Cached /me profile so the app can start signed-in while offline. */
const USER_KEY = 'hobby.auth.user';
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

  const persistUser = useCallback(async (me: User) => {
    setUser(me);
    await setStorageItem(USER_KEY, JSON.stringify(me));
  }, []);

  /** Drops the whole session (tokens + cached profile) and goes unauthenticated. */
  const clearSession = useCallback(async () => {
    await clearTokens();
    await deleteStorageItem(USER_KEY);
    setUser(null);
  }, [clearTokens]);

  // Refresh tokens rotate server-side (single use), so concurrent refreshes with
  // the same token race each other. Share one in-flight refresh between callers.
  const refreshInFlight = useRef<Promise<AuthTokens> | null>(null);

  const refreshTokens = useCallback((): Promise<AuthTokens> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        const current = tokensRef.current;
        if (!current) {
          throw new ApiError(401, ['Not authenticated.']);
        }
        try {
          const refreshed = await authApi.refresh(current.refreshToken);
          await persistTokens(refreshed);
          return refreshed;
        } catch (error) {
          if (error instanceof ApiError) {
            // The server explicitly rejected the refresh token — the session is
            // dead; sign out rather than failing every request from now on.
            // (Network failures are not ApiErrors and keep the session for
            // offline use.)
            await clearSession();
          }
          throw error;
        } finally {
          refreshInFlight.current = null;
        }
      })();
    }
    return refreshInFlight.current;
  }, [persistTokens, clearSession]);

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

  // Bootstrap: restore a persisted session on app start. The cached profile is
  // trusted immediately so the app starts signed-in even with no connectivity;
  // the session is re-validated against the server in the background.
  useEffect(() => {
    let active = true;

    const validateInBackground = async () => {
      try {
        const tokens = await getValidTokens();
        const me = await authApi.me(tokens.accessToken);
        if (active) {
          await persistUser(me);
        }
      } catch {
        // Offline or transient failure — keep the cached session. A refresh
        // token the server explicitly rejected has already cleared it.
      }
    };

    (async () => {
      try {
        const [rawTokens, rawUser] = await Promise.all([
          getStorageItem(TOKENS_KEY),
          getStorageItem(USER_KEY),
        ]);
        if (!rawTokens) {
          return;
        }
        tokensRef.current = JSON.parse(rawTokens) as AuthTokens;

        const cached = rawUser ? (JSON.parse(rawUser) as User) : null;
        if (cached) {
          if (active) {
            setUser(cached);
          }
          void validateInBackground();
          return;
        }

        // No cached profile (session persisted by an older app version):
        // validating online is the only option.
        const tokens = await getValidTokens();
        const me = await authApi.me(tokens.accessToken);
        if (active) {
          await persistUser(me);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          // The server rejected the session — start unauthenticated.
          await clearSession();
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [getValidTokens, persistUser, clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login({ email, password });
      await persistTokens(tokens);
      await persistUser(await authApi.me(tokens.accessToken));
    },
    [persistTokens, persistUser],
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
      await persistUser(await authApi.me(tokens.accessToken));
    },
    [persistTokens, persistUser],
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
    await clearSession();
  }, [clearSession]);

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
