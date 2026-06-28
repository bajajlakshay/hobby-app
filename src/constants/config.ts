/**
 * Base URL of the HobbyApp backend.
 *
 * Use plain HTTP for local device development: the ASP.NET Core dev HTTPS
 * certificate is only valid for `localhost` and is untrusted on a phone, so
 * `https://<LAN-IP>` fails the TLS handshake. The backend binds 0.0.0.0:5169
 * and skips HTTPS redirection in Development, so HTTP works over the LAN.
 *
 * Set your machine's Wi-Fi LAN IP below (find it via `ipconfig`), or override
 * with the EXPO_PUBLIC_API_URL env var (inlined by Expo at build time).
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.4:5169';
