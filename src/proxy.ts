// Next.js 16 renamed the `middleware` file convention to `proxy`. This runs
// before routes render and gates the app behind the demo access cookie.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCookieName, getSessionToken, isAuthEnabled, isPublicPath } from '@/lib/demoAuth';

export function proxy(request: NextRequest) {
  // Auth off → behave exactly as before.
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(getCookieName())?.value;
  if (token && token === getSessionToken()) return NextResponse.next();

  const loginUrl = new URL('/demo-login', request.url);
  loginUrl.searchParams.set('next', pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run ONLY on real protected page routes. Listing them explicitly keeps the
  // proxy off Next internals (/_next/*, RSC/manifest fetches) and the public
  // auth/login/robots paths — intercepting those breaks the client-reference
  // manifest resolution on Turbopack production builds.
  matcher: [
    '/',
    '/demo/:path*',
    '/incidents/:path*',
    '/transcripts/:path*',
    '/units/:path*',
    '/codes/:path*',
    '/audit/:path*',
  ],
};
