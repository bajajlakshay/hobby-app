/** Mirrors the backend AuthResponse contract. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601 timestamp for when the access token expires. */
  accessTokenExpiresAt: string;
}

/** Tokens as persisted on the device. */
export type AuthTokens = AuthResponse;

/** Returned by register / resend: the account needs email OTP verification. */
export interface VerificationRequired {
  requiresVerification?: boolean;
  email: string;
}

/** Shape returned by GET /api/auth/me. */
export interface User {
  userId: string;
  email: string;
}
