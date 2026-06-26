// Lightweight demo gate config. No DB, no accounts — a single shared access code
// exchanged for an httpOnly session cookie. Read from env with safe defaults so
// the app still runs if a value is missing (operators should set real secrets).

export const DEFAULT_COOKIE_NAME = 'mii_demo_access';
const DEFAULT_SESSION_TOKEN = 'mii-demo-session-token';
const DEFAULT_ACCESS_CODE = 'mii-demo';

// 8 hours.
export const SESSION_MAX_AGE = 60 * 60 * 8;

export function isAuthEnabled(): boolean {
  return process.env.DEMO_AUTH_ENABLED === 'true';
}

export function getCookieName(): string {
  return process.env.DEMO_COOKIE_NAME || DEFAULT_COOKIE_NAME;
}

export function getSessionToken(): string {
  return process.env.DEMO_SESSION_TOKEN || DEFAULT_SESSION_TOKEN;
}

export function getAccessCode(): string {
  return process.env.DEMO_ACCESS_CODE || DEFAULT_ACCESS_CODE;
}

// Public paths that must never be gated (login UI + its APIs + static assets).
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/demo-login' ||
    pathname.startsWith('/api/demo-auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/robots'
  );
}
