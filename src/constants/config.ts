/**
 * Base URL of the HobbyApp backend.
 *
 * Defaults to the production server (real HTTPS via Caddy/Let's Encrypt, so it
 * works on any device with no cert workaround).
 *
 * For LOCAL development against a backend running on your machine, override with
 * the EXPO_PUBLIC_API_URL env var (inlined by Expo at build time), e.g. in a
 * `.env` file:  EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:5169
 * Use plain HTTP locally: the ASP.NET Core dev cert is only valid for
 * `localhost` and is untrusted on a phone.
 */
export const API_BASE_URL = 'https://hobbyapp.tech';
